# WebApp ↔ ProcessFlow examples

When a **published WebApp** is linked to a ProcessFlow (`process_id`), an executable HTTP request runs that process **synchronously** as the WebApp’s `webapp_user_id` service account.

This folder documents the **inbound envelope** the first step sees, plus a sample form-handler step.

## Inbound envelope (what the process sees)

There are two layers:

1. **`process_input`** — flattened HTTP payload passed as ProcessFlow `input_data`
2. **Sandbox HTTP metadata** — injected globals beside `process_input` (not nested under it)

```text
Browser / partner  →  Published WebApp URL
                         │
                         ▼
              Build process_input + sandbox envelope
                         │
                         ▼
              executeProcess(process_id, input_data)   // sync by default
                         │
                         ▼
              First step reads process_input + raw_input / http_headers / …
```

### A. `process_input` (form / JSON / webhook GET)

For a normal WebApp **POST** (HTML form, `application/x-www-form-urlencoded`, multipart, or `application/json`), field names land as **top-level keys** on `process_input`:

```json
{
  "email": "user@example.com",
  "name": "Ada Lovelace",
  "message": "Please contact me",
  "auth_token": "<raw JWT when auth_require is on>",
  "auth": {
    "user_id": "user_…",
    "email": "user@example.com",
    "role": "tenant_user",
    "webapp_id": "webapp_…",
    "type": "webapp_access"
  },
  "_attachments": [],
  "_storage_path": null,
  "_execution_id": "uuid-from-client-or-runtime"
}
```

| Source | Maps to `process_input` |
|--------|-------------------------|
| Form fields / JSON body | Same key names as submitted |
| Query string (`webhook` / `callback` GET) | Query keys (top-level) |
| Verified end-user JWT (`auth_require`) | `auth_token`, `auth` (`user_id`, `email`, `role`, `webapp_id`, `type`) |
| File uploads | `_attachments` (metadata), `_storage_path` |
| Client correlation | `_execution_id` |

**Important:** Process execution still runs as **`webapp_user_id`**. End-user identity is in `process_input.auth` — authorize in step code (for example check `process_input.auth.role`) when needed.

### B. Sandbox envelope (HTTP metadata)

Injected **alongside** `process_input` for WebApp-triggered runs:

| Variable | Meaning |
|----------|---------|
| `raw_input` | Raw request body string (use for signature verification) |
| `http_headers` | Incoming headers (title-cased names) |
| `request_method` | HTTP method (`GET`, `POST`, …) |
| `request_uri` | Request URI path (and query when present) |
| `remote_addr` | Client IP |
| `webapp_tenant_id` | Tenant resolved for the WebApp host |
| `app_url` | Application base URL |
| `tenant_id` / `user_id` | Execution identity (`user_id` is the WebApp service user) |
| `process_id` / `process_execution_id` | Linked process / this run |

Example mental model inside a step:

```typescript
// Form field from the browser
const email = String(process_input.email ?? "");

// End-user JWT claims (when auth_require verified the token)
const auth = process_input.auth as { user_id?: string; role?: string } | undefined;

// HTTP envelope (sandbox globals — not under process_input)
const method = request_method;       // "POST"
const headers = http_headers;        // { "Content-Type": "...", ... }
const rawBody = raw_input;           // raw string for HMAC / Stripe-style verify
```

### C. `api_router` processes (`/api/*` on the WebApp)

When the linked process is an **`api_router`**, `process_input` is a **routing envelope** instead of flat form fields. See [webhooks/webapp-api-router-process-template.ts](../webhooks/webapp-api-router-process-template.ts).

```json
{
  "request_uri": "/api/your/route",
  "request_method": "POST",
  "request_headers": { "Authorization": "Bearer …", "Content-Type": "application/json" },
  "request_body": "{ … raw string … }",
  "query_string": "limit=10",
  "token": "<optional>",
  "auth_token": "<optional>",
  "auth": { "user_id": "…", "email": "…", "role": "…", "webapp_id": "…", "type": "webapp_access" },
  "tenant_id": "<TENANT_ID>",
  "webapp_id": "<WEBAPP_ID>",
  "process_config": {}
}
```

### D. Outbound HTTP response (what the browser sees)

Step return `{ success, data, message?, error? }` is mapped into a WebApp JSON wrapper, roughly:

```json
{
  "success": true,
  "result": {
    "success": true,
    "execution_id": "<EXECUTION_ID>",
    "process_id": "<PROCESS_ID>",
    "output_data": { },
    "data": { }
  },
  "execution_time_ms": 42
}
```

Business fields for the client live under **`result.output_data`** / **`result.data`** (platform maps step `data` into that layer).

## Files in this folder

| File | Purpose |
|------|---------|
| [process-step-webapp-form-handler.ts](process-step-webapp-form-handler.ts) | First-step handler for a typical HTML WebApp POST (reads envelope + returns structured `data`) |

## Related docs in this repo

- [docs/processflow/WEBAPP_ASYNC_PROCESS_TRIGGER_GUIDE.md](../../docs/processflow/WEBAPP_ASYNC_PROCESS_TRIGGER_GUIDE.md) — stub process so HTTP returns immediately
- [docs/processflow/interface/v1/variables.md](../../docs/processflow/interface/v1/variables.md) — sandbox variables
- [examples/webhooks/webapp-api-router-process-template.ts](../webhooks/webapp-api-router-process-template.ts) — `/api/*` router envelope
