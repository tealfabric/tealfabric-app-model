# Webhook Calls

This guide covers making outbound webhook calls and handling inbound webhook context from ProcessFlow code snippets. **TypeScript preferred** — see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

## Overview

Webhooks enable real-time communication with external systems.

**Important:** `api` / `tf.api` is for **internal** platform HTTP only (authenticated calls to your TealFabric APIs). It is **not** a general-purpose client for arbitrary external hosts.

For **outbound** webhooks to external URLs, use a configured connector via `tf.connector.execute` or `tf.integration` / `integration.executeSync` — not `api.post(externalUrl, ...)`.

When a step is triggered by a **WebApp** or inbound webhook, use `http_headers`, `request_method`, and `raw_input` for verification and routing.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Code Snippet   │────▶│ tf.connector /   │────▶│  External       │
│  (Outbound)     │     │ tf.integration   │     │  Webhook        │
└─────────────────┘     └──────────────────┘     └─────────────────┘

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Code Snippet   │────▶│ tf.api / api     │────▶│  Internal       │
│  (Platform)     │     │                  │     │  Platform APIs  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Available Services

| Variable | Type | Description |
|----------|------|-------------|
| `tf.api` / `api` | TenantAPIService | **Internal** platform HTTP (`get` / `post` / `put`; no `delete`) |
| `tf.connector` / `tf.integration` | Connector helpers | **Outbound** HTTP to external systems via configured connectors |
| `http_headers` | Record<string, string> | Request headers (WebApp / webhook triggers) |
| `request_method` | string | HTTP method (`GET`, `POST`, …) |
| `raw_input` | string | Raw POST body (signature verification) |

---

## Example 1: Outbound webhook via connector (preferred)

Send data to an external endpoint through a configured REST/webhook connector (requires `connector` capability):

```typescript
const integrationId = String(process_input.result?.integration_id ?? "");
const operation = String(process_input.result?.operation ?? "send");
const payload = { ...(process_input.result?.payload ?? {}) } as Record<string, unknown>;

if (!integrationId) {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Integration ID required for outbound webhook" },
    data: null,
  };
}

payload.timestamp = new Date().toISOString();
payload.source = "processflow";
payload.tenant_id = tenant_id;

try {
  tf.log("info", "Calling outbound webhook via connector", { integrationId, operation });

  // Preferred shorthand:
  const result = await tf.connector.execute(integrationId, operation, payload);

  // Equivalent: await tf.integration.executeSync(integrationId, { operation, ...payload });

  if (!result?.success) {
    return {
      success: false,
      error: {
        code: "CONNECTOR_ERROR",
        message: String(result?.error ?? "Outbound webhook failed"),
      },
      data: null,
    };
  }

  return {
    success: true,
    data: {
      integration_id: integrationId,
      result: result.result ?? result.data,
    },
  };
} catch (e) {
  tf.log("error", "Webhook failed", { message: e instanceof Error ? e.message : String(e) });

  return {
    success: false,
    error: {
      code: "RUNTIME_ERROR",
      message: `Webhook call failed: ${e instanceof Error ? e.message : String(e)}`,
    },
    data: null,
  };
}
```

> Do **not** use `api.post("https://hooks.example.com/...", payload)` for external hosts. Configure a connector (for example a generic REST connector) and call it with `tf.connector.execute` / `tf.integration`.

---

## Note on examples 2+

Examples below may still show `api.post(webhookUrl, …)` for payload/header illustration. **Do not** call arbitrary external hosts with `api` / `tf.api`. Wire the same payload through `tf.connector.execute` or `tf.integration.executeSync` on a configured connector (see Example 1). Use `tf.api` only for internal platform routes.

## Example 2: Webhook with Authentication

Include authentication headers:

```typescript
const webhookUrl = String(process_input.result?.webhook_url ?? "");
const payload = process_input.result?.payload ?? {};
const authType = String(process_input.result?.auth_type ?? "bearer");
const authValue = String(process_input.result?.auth_value ?? "");
const apiKeyHeader = String(process_input.result?.api_key_header ?? "X-API-Key");

if (!webhookUrl || !authValue) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Webhook URL and auth value required" }, data: null };
}

const headers: Record<string, string> = { "Content-Type": "application/json" };

switch (authType) {
  case "bearer":
    headers.Authorization = `Bearer ${authValue}`;
    break;
  case "basic":
    headers.Authorization = `Basic ${Buffer.from(authValue).toString("base64")}`;
    break;
  case "api_key":
    headers[apiKeyHeader] = authValue;
    break;
}

try {
  const response = await api.post(webhookUrl, payload, headers);

  return {
    success: response.success,
    data: {
      status_code: response.status_code,
      response: response.data,
    },
  };
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Webhook error: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 3: Webhook with Signature

Sign webhook payload for verification (outbound) or verify inbound signatures using `raw_input`:

```typescript
const webhookUrl = String(process_input.result?.webhook_url ?? "");
const payload = { ...(process_input.result?.payload ?? {}) } as Record<string, unknown>;
const secretKey = String(process_input.result?.secret_key ?? "");
const signatureHeader = String(process_input.result?.signature_header ?? "X-Webhook-Signature");
const verifyInbound = Boolean(process_input.result?.verify_inbound);

if (verifyInbound && secretKey) {
  const incomingSignature = http_headers?.[signatureHeader] ?? http_headers?.[signatureHeader.toLowerCase()] ?? "";
  const payloadString = raw_input ?? JSON.stringify(process_input);
  const expected = tf.utils.sha256(`${secretKey}:${payloadString}`);

  if (!incomingSignature || !incomingSignature.includes(expected)) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid webhook signature" }, data: null };
  }

  tf.log("info", "Inbound webhook verified", { method: request_method });
  return { success: true, data: { verified: true, method: request_method } };
}

if (!webhookUrl || !secretKey) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Webhook URL and secret key required" }, data: null };
}

payload.timestamp = Math.floor(Date.now() / 1000);
payload.nonce = tf.utils.deterministicId(`${Date.now()}-${tenant_id}`);

const payloadString = JSON.stringify(payload);
const signature = tf.utils.sha256(`${secretKey}:${payloadString}`);

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  [signatureHeader]: `sha256=${signature}`,
  "X-Webhook-Timestamp": String(payload.timestamp),
};

try {
  const response = await api.post(webhookUrl, payload, headers);

  return {
    success: response.success,
    data: {
      status_code: response.status_code,
      response: response.data,
      signature,
    },
  };
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Signed webhook failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 4: Webhook with Retry

Retry failed webhook calls:

```typescript
const webhookUrl = String(process_input.result?.webhook_url ?? "");
const payload = process_input.result?.payload ?? {};
const maxRetries = Number(process_input.result?.max_retries ?? 3);

if (!webhookUrl) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Webhook URL required" }, data: null };
}

const retryableCodes = [408, 429, 500, 502, 503, 504];
const attempts: Array<Record<string, unknown>> = [];
let lastError: string | null = null;

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    const response = await api.post(webhookUrl, payload);
    const statusCode = response.status_code ?? 0;

    attempts.push({ attempt, status_code: statusCode, success: response.success });

    if (response.success && statusCode < 400) {
      return {
        success: true,
        data: {
          status_code: statusCode,
          response: response.data,
          attempts,
          total_attempts: attempt,
        },
      };
    }

    if (!retryableCodes.includes(statusCode)) {
      return {
        success: false,
        error: { code: "RUNTIME_ERROR", message: "Non-retryable error" },
        data: {
          status_code: statusCode,
          response: response.data,
          attempts,
        },
      };
    }

    lastError = `HTTP ${statusCode}`;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    attempts.push({ attempt, error: lastError });
  }
}

return {
  success: false,
  error: { code: "RUNTIME_ERROR", message: `Max retries exceeded: ${lastError}` },
  data: { attempts, total_attempts: maxRetries },
};
```

---

## Example 5: Event Webhook

Send event notification:

```typescript
const webhookUrl = String(process_input.result?.webhook_url ?? "");
const eventType = String(process_input.result?.event_type ?? "");
const eventData = process_input.result?.event_data ?? {};
const eventId = String(process_input.result?.event_id ?? tf.utils.deterministicId(`${eventType}-${Date.now()}`));

if (!webhookUrl || !eventType) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Webhook URL and event type required" }, data: null };
}

const payload = {
  id: eventId,
  type: eventType,
  created: Math.floor(Date.now() / 1000),
  data: eventData,
  api_version: "2024-01-01",
  livemode: true,
  object: "event",
};

try {
  const response = await api.post(webhookUrl, payload, {
    "Content-Type": "application/json",
    "X-Event-Type": eventType,
    "X-Event-ID": eventId,
  });

  tf.log("info", "Event webhook sent", { eventType, eventId });

  return {
    success: response.success,
    data: {
      event_id: eventId,
      event_type: eventType,
      status_code: response.status_code,
      delivered: response.success,
    },
  };
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Event webhook failed: ${e instanceof Error ? e.message : String(e)}` },
    data: { event_id: eventId },
  };
}
```

---

## Example 6: Slack Webhook

Send Slack notification:

```typescript
const slackWebhookUrl = String(process_input.result?.slack_webhook_url ?? "");
const message = String(process_input.result?.message ?? "");
const channel = process_input.result?.channel as string | undefined;
const username = String(process_input.result?.username ?? "ProcessFlow Bot");
const iconEmoji = String(process_input.result?.icon_emoji ?? ":robot_face:");
const attachments = (process_input.result?.attachments ?? []) as Array<Record<string, unknown>>;

if (!slackWebhookUrl || !message) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Slack webhook URL and message required" }, data: null };
}

const payload: Record<string, unknown> = {
  text: message,
  username,
  icon_emoji: iconEmoji,
};

if (channel) {
  payload.channel = channel;
}

if (attachments.length > 0) {
  payload.attachments = attachments.map((att) => ({
    color: att.color ?? "#36a64f",
    title: att.title ?? "",
    text: att.text ?? "",
    fields: ((att.fields ?? []) as Array<Record<string, unknown>>).map((f) => ({
      title: f.title ?? "",
      value: f.value ?? "",
      short: f.short ?? false,
    })),
    footer: att.footer ?? "ProcessFlow",
    ts: Math.floor(Date.now() / 1000),
  }));
}

try {
  const response = await api.post(slackWebhookUrl, payload);

  return {
    success: response.status_code === 200,
    data: {
      delivered: response.status_code === 200,
      channel,
    },
  };
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Slack webhook failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 7: Microsoft Teams Webhook

Send Teams notification:

```typescript
const teamsWebhookUrl = String(process_input.result?.teams_webhook_url ?? "");
const title = String(process_input.result?.title ?? "");
const message = String(process_input.result?.message ?? "");
const themeColor = String(process_input.result?.theme_color ?? "0076D7");
const facts = (process_input.result?.facts ?? {}) as Record<string, string>;

if (!teamsWebhookUrl || !message) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Teams webhook URL and message required" }, data: null };
}

const payload = {
  "@type": "MessageCard",
  "@context": "http://schema.org/extensions",
  themeColor,
  summary: title || message.slice(0, 50),
  sections: [
    {
      activityTitle: title,
      text: message,
      facts: Object.entries(facts).map(([name, value]) => ({ name, value })),
      markdown: true,
    },
  ],
};

try {
  const response = await api.post(teamsWebhookUrl, payload);

  return {
    success: response.status_code === 200,
    data: {
      delivered: response.status_code === 200,
      title,
    },
  };
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Teams webhook failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 8: Batch Webhooks

Send to multiple endpoints:

```typescript
const webhooks = (process_input.result?.webhooks ?? []) as Array<
  string | { url?: string; headers?: Record<string, string>; name?: string }
>;
const payload = process_input.result?.payload ?? {};
const continueOnError = Boolean(process_input.result?.continue_on_error ?? true);

if (webhooks.length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Webhooks list required" }, data: null };
}

const results: {
  success: Array<{ name: string; url: string; status_code: number }>;
  failed: Array<{ name: string; url: string; error?: string; status_code?: number }>;
} = { success: [], failed: [] };

for (let index = 0; index < webhooks.length; index++) {
  const webhook = webhooks[index];
  const url = typeof webhook === "string" ? webhook : String(webhook.url ?? "");
  const headers = typeof webhook === "object" ? (webhook.headers ?? {}) : {};
  const name = typeof webhook === "object" ? String(webhook.name ?? `Webhook ${index}`) : `Webhook ${index}`;

  if (!url) {
    results.failed.push({ name, url, error: { code: "VALIDATION_ERROR", message: "Missing URL" } });
    continue;
  }

  try {
    const response = await api.post(url, payload, headers);

    if (response.success && response.status_code < 400) {
      results.success.push({ name, url, status_code: response.status_code });
    } else {
      results.failed.push({
        name,
        url,
        status_code: response.status_code,
        error: {
          code: "WEBHOOK_ERROR",
          message: String((response.data as { error?: string })?.error ?? "Request failed"),
        },
      });
      if (!continueOnError) break;
    }
  } catch (e) {
    results.failed.push({
      name,
      url,
      error: { code: "RUNTIME_ERROR", message: e instanceof Error ? e.message : String(e) },
    });
    if (!continueOnError) break;
  }
}

const allSucceeded = results.failed.length === 0;

tf.log("info", "Batch webhooks complete", {
  succeeded: results.success.length,
  failed: results.failed.length,
});

return {
  success: allSucceeded,
  data: {
    total: webhooks.length,
    succeeded: results.success.length,
    failed: results.failed.length,
    results,
  },
};
```

---

## Best Practices

### 1. Validate URLs

```typescript
try {
  new URL(url);
} catch {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid URL" }, data: null };
}
```

### 2. Use Timeouts

Default API timeout is 30 seconds. For long-running delivery, queue a follow-up process step.

### 3. Log All Webhook Calls

```typescript
tf.log("info", "Webhook call", { url, status_code: response.status_code });
```

### 4. Verify Inbound Webhooks

```typescript
const body = raw_input ?? JSON.stringify(process_input);
const signature = http_headers?.["X-Webhook-Signature"] ?? "";
// Compare signature against body using shared secret
```

### 5. Handle Failures Gracefully

Queue for retry if a webhook fails, or notify an admin via `notification.dispatch`.

---

## Security Considerations

| Warning | Solution |
|---------|----------|
| Don't log secrets | Mask authentication values in logs |
| Validate SSL | Use HTTPS endpoints |
| Sign payloads | Include signatures; verify with `raw_input` |
| Rate limiting | Implement backoff for rate-limited endpoints |

---

## See Also

- [Process-to-Process Communication](Process_Communication.md)
- [Integration Connectors](Integration_Connectors.md)
- [ProcessFlow Event Handling Guide](../PROCESSFLOW_EVENT_HANDLING_GUIDE.md)
