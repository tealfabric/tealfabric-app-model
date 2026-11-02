# Interface v1 — Available Variables

Variables and globals injected at step runtime in the **TypeScript/JavaScript** sandbox (`new-sandbox`).

**Policy:** Author snippets in TypeScript. See [../../PROCESSFLOW_SANDBOX_TF_API.md](../../PROCESSFLOW_SANDBOX_TF_API.md) and [../../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

---

## Input and output

| Name | Type | Description |
|------|------|-------------|
| `process_input` | object | Data from previous step or trigger |
| `process_output` | object | Mutable output bag for the current step |
| `raw_input` | string | Raw POST/JSON body (WebApp / webhooks) |

---

## Identity and process metadata

| Name | Description |
|------|-------------|
| `tenant_id` | Current tenant (from context, not user input) |
| `user_id` | User who triggered the run, when available |
| `webapp_tenant_id` | WebApp tenant context (usually same as `tenant_id`) |
| `process_id` | Current process id |
| `process_execution_id` | Workflow execution id |
| `execution_auth_key` | HMAC key for internal API calls — **never log or return** |
| `execution_auth_source_id` | Source execution id for internal HTTP auth headers |
| `run_correlation_id` | Support and log correlation reference |
| `correlation_id` | Alias of `run_correlation_id` |
| `app_url` | Base URL of the Tealfabric app |

Prefer **`tf.context.get/set`** for structured reads/writes beyond `process_input` / `process_output`.

---

## Database and data

| Name | Description |
|------|-------------|
| `tenantDb` / `tf.tenantDb` | Tenant-scoped DB service (**recommended**) |
| `datapool` / `tf.datapool` | DataPool schemas and records |
| `db` / `tf.db` | Raw MySQL handle — **`/root` tenant only** |
| `process_db` | **`/root` tenant only** — raw MySQL handle for platform tables |

---

## Integrations and HTTP

| Name | Description |
|------|-------------|
| `integration` / `tf.integration` | Integration execution (**recommended**) |
| `connectors` / `tf.connectors` | **Deprecated** — use `integration` |
| `api` / `tf.api` | Internal HTTP: **`get`**, **`post`**, **`put`** (no `delete`) |
| `process` / `tf.process` | `execute(processId, input?, { async? })` — process-to-process |
| `operations` / `tf.operations` | My Work / human-gate helpers |

---

## Services

| Name | Description |
|------|-------------|
| `llm` / `tf.llm` | `callLLM` / `complete` (`chat` blocked) |
| `email` / `tf.email` | Email `send` |
| `notification` / `tf.notification` | `send`, `dispatch`, `update`, `remove(id)` |
| `jwt` / `tf.jwt` | `decodePayload`, `verify`, `issueWebappAccess` |
| `files` / `tf.files` | Execution-scoped `read`, `write`, `list`; may be null |
| `keystore` / `tf.keystore` | Process secrets; may be null |
| `pdfOcr` / `tf.pdfOcr` | PDF text extraction |
| `imageOcr` / `tf.imageOcr` | Image text extraction |
| `image` / `tf.image` | `thumbnail(...)` |
| `documentReview` / `tf.documentReview` | Document review workflows |

---

## WebApp request context

When triggered by WebApp:

| Name | Description |
|------|-------------|
| `http_headers` | Request headers |
| `request_method` | GET, POST, … |
| `request_uri` | URI path |
| `remote_addr` | Client IP |

Do not use server globals such as `$_SERVER` — they are blocked in the sandbox.

---

## Logging and `tf` namespace

| Name | Description |
|------|-------------|
| `tf` | Capability-aware sandbox API — see [../../PROCESSFLOW_SANDBOX_TF_API.md](../../PROCESSFLOW_SANDBOX_TF_API.md) |
| `log_message` | Legacy alias for `tf.log` |

Do not use `console.log` as the primary audit trail; use `tf.log`.

---

## Tenant file helpers

When the **`file`** capability is enabled, these **functions** are injected (not objects on a service). Prefer unprefixed names in TypeScript; `$`-prefixed aliases exist for migration:

`file_get_contents`, `file_put_contents`, `file_exists`, `mkdir`, `read`, `write`, `unlink`, `copy`, `rename`, `glob`, `fopen`, `fread`, `fwrite`, `fclose`, and related helpers.

Paths must stay inside tenant storage boundaries. Do not confuse these with **`files` / `tf.files`**, which are **execution-scoped uploads** only.

---

## Capability gating

Services may throw or be `null` if the run's **`sandbox_capabilities`** omit the required category (for example `connector`, `file`). Normal UI executes with platform **legacy defaults** (broad capabilities) unless options override.

Check `tf.capabilities.includes("…")` when a step may run with restricted profiles.
