# Integration Connector Usage

Integration connectors in ProcessFlow snippets. **TypeScript preferred**; see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

## Overview

The `integration` service provides a unified interface for executing configured integrations (APIs, databases, cloud services). Integrations are pre-configured in the admin panel with credentials and connection settings.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Code Snippet   │────▶│  integration     │────▶│  External       │
│  (Execute)      │     │  Service         │     │  Service        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Available Services

| Variable | Type | Description |
|----------|------|-------------|
| `integration` | IntegrationHelper | **Recommended** — execute integrations |
| `connectors` | ConnectorService | **Deprecated** — use `integration` instead |

## IntegrationHelper Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `execute(id, data, options?)` | object \| string | Execute sync or async |
| `executeSync(id, data, options?)` | object | Execute synchronously (wait) |
| `executeAsync(id, data, options?)` | string | Execute asynchronously (returns execution_id) |
| `getStatus(executionId)` | object | Get async execution status |
| `getResult(executionId)` | object \| null | Get async execution result |
| `cancel(executionId)` | boolean | Cancel pending execution |

---

## Example 1: Synchronous Integration Execution

Execute integration and wait for result:

```typescript
const integrationId = String(process_input.result?.integration_id ?? "");
const inputData = (process_input.result?.data ?? {}) as Record<string, unknown>;

if (!integrationId) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Integration ID required" }, data: null };
}

try {
  tf.log("info", `Executing integration: ${integrationId}`);

  const result = await integration.executeSync(integrationId, inputData);

  if (result.success) {
    tf.log("info", "Integration executed successfully");

    return {
      success: true,
      data: {
        integration_result: result.result ?? result.data,
        execution_time_ms: result.execution_time_ms ?? null,
      },
    };
  }

  tf.log("error", `Integration failed: ${result.error ?? "Unknown error"}`);

  return {
    success: false,
    error: { code: "CONNECTOR_ERROR", message: String(result.error ?? "Integration execution failed") },
    data: { error_details: result },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  tf.log("error", `Integration exception: ${message}`);

  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Integration error: ${message}` },
    data: null,
  };
}
```

---

## Example 2: Asynchronous Execution

Execute without waiting (for long-running operations):

```typescript
const integrationId = String(process_input.result?.integration_id ?? "");
const inputData = (process_input.result?.data ?? {}) as Record<string, unknown>;
const priority = String(process_input.result?.priority ?? "normal");
const callbackUrl = process_input.result?.callback_url as string | undefined;

if (!integrationId) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Integration ID required" }, data: null };
}

try {
  const options: Record<string, unknown> = { priority };
  if (callbackUrl) {
    options.callback_url = callbackUrl;
  }

  const executionId = await integration.executeAsync(integrationId, inputData, options);

  tf.log("info", `Integration queued with execution ID: ${executionId}`);

  return {
    success: true,
    data: {
      execution_id: executionId,
      status: "queued",
      integration_id: integrationId,
      message: "Integration execution queued. Use execution_id to check status.",
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Failed to queue integration: ${message}` },
    data: null,
  };
}
```

---

## Example 3: Check Async Execution Status

Poll for completion of async execution:

```typescript
const executionId = String(process_input.result?.execution_id ?? "");

if (!executionId) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Execution ID required" }, data: null };
}

try {
  const status = await integration.getStatus(executionId);

  if (!status.found) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Execution not found" },
      data: { execution_id: executionId },
    };
  }

  const response: Record<string, unknown> = {
    success: true,
    data: {
      execution_id: executionId,
      status: status.status,
      execution_time_ms: status.execution_time_ms ?? null,
      created_at: status.created_at ?? null,
    },
  };

  if (status.status === "completed") {
    const result = await integration.getResult(executionId);
    (response.data as Record<string, unknown>).result = result;
    response.route = "completed";
  } else if (status.status === "failed") {
    (response.data as Record<string, unknown>).error = status.error_message ?? "Unknown error";
    response.route = "failed";
  } else if (status.status === "pending" || status.status === "running") {
    response.route = "pending";
  }

  return response;
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Status check failed: ${message}` },
    data: null,
  };
}
```

---

## Example 4: REST API Integration

Execute a REST API integration:

```typescript
/**
 * Assumes an integration named "External CRM API" is configured
 * with base URL and authentication
 */

const integrationId = String(process_input.result?.integration_id ?? "");
const endpoint = String(process_input.result?.endpoint ?? "/customers");
const method = String(process_input.result?.method ?? "GET").toUpperCase();
const payload = (process_input.result?.payload ?? {}) as Record<string, unknown>;
const queryParams = (process_input.result?.query_params ?? {}) as Record<string, unknown>;

try {
  const requestData: Record<string, unknown> = {
    endpoint,
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (Object.keys(queryParams).length > 0) {
    requestData.query = queryParams;
  }

  if (["POST", "PUT", "PATCH"].includes(method) && Object.keys(payload).length > 0) {
    requestData.body = payload;
  }

  const result = await integration.executeSync(integrationId, requestData);

  if (!result.success) {
    return {
      success: false,
      error: { code: "CONNECTOR_ERROR", message: String(result.error ?? "API call failed") },
      data: {
        status_code: result.status_code ?? null,
        response: result.response ?? null,
      },
    };
  }

  return {
    success: true,
    data: {
      response: result.result ?? result.data,
      status_code: result.status_code ?? 200,
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `API integration error: ${message}` },
    data: null,
  };
}
```

---

## Example 5: Database Integration

Execute a database integration query:

```typescript
/**
 * Assumes an integration configured for external database
 */

const integrationId = String(process_input.result?.integration_id ?? "");
const operation = String(process_input.result?.operation ?? "query");
const query = String(process_input.result?.query ?? "");
const params = (process_input.result?.params ?? []) as unknown[];

if (!integrationId) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Integration ID required" }, data: null };
}

try {
  const requestData = {
    operation,
    query,
    parameters: params,
  };

  const result = await integration.executeSync(integrationId, requestData, {
    timeout: 30000,
  });

  if (!result.success) {
    return {
      success: false,
      error: { code: "CONNECTOR_ERROR", message: String(result.error ?? "Database query failed") },
    data: null,
    };
  }

  const rows = (result.result as Record<string, unknown>)?.rows ?? [];

  return {
    success: true,
    data: {
      records: rows,
      affected_rows: (result.result as Record<string, unknown>)?.affected_rows ?? null,
      insert_id: (result.result as Record<string, unknown>)?.insert_id ?? null,
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Database integration error: ${message}` },
    data: null,
  };
}
```

---

## Example 6: Cloud Storage Integration

Execute cloud storage operations (S3, Azure Blob):

```typescript
/**
 * Assumes S3 or Azure Blob integration configured
 */

const integrationId = String(process_input.result?.integration_id ?? "");
const operation = String(process_input.result?.operation ?? "list");
const bucket = String(process_input.result?.bucket ?? "");
const key = String(process_input.result?.key ?? "");
const content = process_input.result?.content;

if (!integrationId) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Integration ID required" }, data: null };
}

try {
  const requestData: Record<string, unknown> = { operation, bucket };

  switch (operation) {
    case "list":
      requestData.prefix = key;
      break;

    case "get":
      requestData.key = key;
      break;

    case "put":
      if (!key || content === undefined || content === null) {
        return { success: false, error: { code: "VALIDATION_ERROR", message: "Key and content required for put" }, data: null };
      }
      requestData.key = key;
      requestData.content =
        typeof content === "object" ? JSON.stringify(content) : String(content);
      requestData.content_type =
        String(process_input.result?.content_type ?? "application/octet-stream");
      break;

    case "delete":
      if (!key) {
        return { success: false, error: { code: "VALIDATION_ERROR", message: "Key required for delete" }, data: null };
      }
      requestData.key = key;
      break;

    default:
      return { success: false, error: { code: "VALIDATION_ERROR", message: `Unknown operation: ${operation}` }, data: null };
  }

  const result = await integration.executeSync(integrationId, requestData);

  return {
    success: result.success,
    data: {
      operation,
      result: result.result ?? null,
      error: result.error ? { code: "CONNECTOR_ERROR", message: String(result.error) } : null,
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Storage integration error: ${message}` },
    data: null,
  };
}
```

---

## Example 7: Message Queue Integration

Send messages to SQS, Azure Service Bus, or Kafka:

```typescript
/**
 * Assumes queue integration configured
 */

const integrationId = String(process_input.result?.integration_id ?? "");
const operation = String(process_input.result?.operation ?? "send");
const queueName = String(process_input.result?.queue_name ?? "");
const message = process_input.result?.message ?? {};

if (!integrationId) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Integration ID required" }, data: null };
}

try {
  const requestData: Record<string, unknown> = {
    operation,
    queue: queueName,
  };

  switch (operation) {
    case "send":
      requestData.message =
        typeof message === "object" ? JSON.stringify(message) : String(message);
      requestData.message_attributes = process_input.result?.attributes ?? {};
      break;

    case "receive":
      requestData.max_messages = Number(process_input.result?.max_messages ?? 10);
      requestData.wait_time_seconds = Number(process_input.result?.wait_time ?? 0);
      break;

    case "delete":
      requestData.receipt_handle = String(process_input.result?.receipt_handle ?? "");
      break;
  }

  const result = await integration.executeSync(integrationId, requestData);

  if (!result.success) {
    return {
      success: false,
      error: { code: "CONNECTOR_ERROR", message: String(result.error ?? "Queue operation failed") },
    data: null,
    };
  }

  return {
    success: true,
    data: {
      operation,
      queue: queueName,
      result: result.result,
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Queue integration error: ${message}` },
    data: null,
  };
}
```

---

## Example 8: Batch Integration Execution

Execute multiple integrations in sequence or parallel:

```typescript
const executions = (process_input.result?.executions ?? []) as Array<{
  integration_id: string;
  data?: Record<string, unknown>;
}>;
const mode = String(process_input.result?.mode ?? "sequential");
const stopOnError = Boolean(process_input.result?.stop_on_error ?? true);

if (executions.length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No executions provided" }, data: null };
}

const results: Array<{ success: boolean; result?: unknown; error?: string | null }> = [];
let hasErrors = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  if (mode === "parallel") {
    const executionIds: Record<number, string> = {};
    for (let index = 0; index < executions.length; index++) {
      const exec = executions[index];
      executionIds[index] = await integration.executeAsync(
        exec.integration_id,
        exec.data ?? {}
      );
    }

    const pending = new Map(Object.entries(executionIds).map(([k, v]) => [Number(k), v]));
    const maxWaitSeconds = 60;
    const startTime = Date.now();

    while (pending.size > 0 && Date.now() - startTime < maxWaitSeconds * 1000) {
      for (const [index, execId] of [...pending.entries()]) {
        const status = await integration.getStatus(execId);

        if (status.status === "completed") {
          results[index] = {
            success: true,
            result: await integration.getResult(execId),
          };
          pending.delete(index);
        } else if (status.status === "failed") {
          results[index] = {
            success: false,
            error: status.error_message ?? "Failed",
          };
          hasErrors = true;
          pending.delete(index);
        }
      }

      if (pending.size > 0) {
        await sleep(500);
      }
    }

    for (const [index] of pending.entries()) {
      results[index] = {
        success: false,
        error: { code: "TIMEOUT_ERROR", message: "Timeout waiting for completion" },
        data: null,
      };
      hasErrors = true;
    }
  } else {
    for (let index = 0; index < executions.length; index++) {
      const exec = executions[index];
      const result = await integration.executeSync(exec.integration_id, exec.data ?? {});

      results[index] = {
        success: result.success,
        result: result.result ?? null,
        error: result.error ? { code: "CONNECTOR_ERROR", message: String(result.error) } : null,
      };

      if (!result.success) {
        hasErrors = true;
        if (stopOnError) break;
      }
    }
  }

  return {
    success: !hasErrors,
    data: {
      mode,
      total_executions: executions.length,
      completed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Batch execution error: ${message}` },
    data: null,
  };
}
```

---

## Example 9: Integration with Retry Logic

Execute with automatic retry on transient failures:

```typescript
const integrationId = String(process_input.result?.integration_id ?? "");
const inputData = (process_input.result?.data ?? {}) as Record<string, unknown>;
const maxRetries = Number(process_input.result?.max_retries ?? 3);
const retryDelay = Number(process_input.result?.retry_delay_ms ?? 1000);

const retryableErrors = ["TIMEOUT", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "CONNECTION_ERROR"];

if (!integrationId) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Integration ID required" }, data: null };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let attempt = 0;
let lastError: string | null = null;
const attempts: Array<{ attempt: number; success: boolean; error?: string | null }> = [];

while (attempt < maxRetries) {
  attempt++;

  try {
    tf.log("info", `Integration attempt ${attempt}/${maxRetries}`);

    const result = await integration.executeSync(integrationId, inputData);

    attempts.push({
      attempt,
      success: result.success,
      error: result.error ? { code: "CONNECTOR_ERROR", message: String(result.error) } : null,
    });

    if (result.success) {
      return {
        success: true,
        data: {
          result: result.result ?? result.data,
          attempts,
          total_attempts: attempt,
        },
      };
    }

    const errorCode = String(result.error_code ?? "");
    if (!retryableErrors.includes(errorCode)) {
      return {
        success: false,
        error: { code: "CONNECTOR_ERROR", message: String(result.error ?? "Integration failed") },
        data: { attempts },
      };
    }

    lastError = result.error ?? null;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    attempts.push({ attempt, success: false, error: lastError });
  }

  if (attempt < maxRetries) {
    const delay = retryDelay * Math.pow(2, attempt - 1);
    await sleep(delay);
  }
}

return {
  success: false,
  error: { code: "RUNTIME_ERROR", message: `Max retries exceeded. Last error: ${lastError}` },
  data: { attempts, total_attempts: attempt },
};
```

---

## Best Practices

### 1. Use Meaningful Timeout Values

```typescript
await integration.executeSync(id, data, {
  timeout: 30000,
});
```

### 2. Handle Both Success and Failure

```typescript
if (!result.success) {
  tf.log("error", String(result.error));
  return { success: false, error: { code: "CONNECTOR_ERROR", message: String(result.error ?? "failed") }, data: null };
}
```

### 3. Use Async for Long Operations

```typescript
const execId = await integration.executeAsync(id, data);
// Check status later or use callback
```

### 4. Log Integration Calls

```typescript
tf.log("info", `Calling integration: ${integrationId}`);
// ... execute
tf.log("info", "Integration response received");
```

---

## Error Handling

| Error Code | Description | Retry? |
|------------|-------------|--------|
| `TIMEOUT` | Request timed out | Yes |
| `RATE_LIMITED` | Too many requests | Yes (with backoff) |
| `SERVICE_UNAVAILABLE` | Service down | Yes |
| `AUTHENTICATION_FAILED` | Invalid credentials | No |
| `INVALID_REQUEST` | Bad request data | No |
| `NOT_FOUND` | Resource not found | No |

---

## See Also

- [ProcessFlow Code Snippets Guide](../PROCESSFLOW_CODE_SNIPPETS_GUIDE.md) (API service, HTTP calls)

Related topics (cloud storage, queue operations) may be covered in platform or planned docs.
