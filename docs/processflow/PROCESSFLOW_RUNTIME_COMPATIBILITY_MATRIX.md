# ProcessFlow Runtime Compatibility Matrix

Authoritative reference for snippet authors. Describes how **backend-next** (`dev.tealfabric.io/backend-next`) runs process steps in the sandbox.

**Related docs**

| Topic | Location |
|-------|----------|
| Snippet authoring | [PROCESSFLOW_CODE_SNIPPETS_GUIDE.md](PROCESSFLOW_CODE_SNIPPETS_GUIDE.md) |
| `tf` API reference | [PROCESSFLOW_SANDBOX_TF_API.md](PROCESSFLOW_SANDBOX_TF_API.md) |
| Guardrails and blocked patterns | [PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md](PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md) |
| Interface v1 contract | [interface/v1/](interface/v1/) |

---

## Language policy

Supported languages: TypeScript (preferred) and JavaScript. Other languages are not supported.

| Language | Status | Execution mode |
|----------|--------|----------------|
| **TypeScript** | **Preferred** | `new-sandbox` (Node VM) |
| **JavaScript** | Supported | `new-sandbox` (Node VM) |

---

## Execution mode

| Mode | Languages | Runtime |
|------|-----------|---------|
| `new-sandbox` | TypeScript, JavaScript | Node `vm` runner, capability gates, `tf.*` SDK + compatibility globals |

Worker default: `SANDBOX_EXECUTION_MODE=new-sandbox` (see platform `.env.defaults`).

---

## Sandbox profiles

Passed as `options.sandbox_profile` on process execute (API, triggers, queue).

| Profile | Typical capabilities (when list is empty) | Context writable? |
|---------|-------------------------------------------|-------------------|
| `minimal-readonly` | `context`, `logging` | No — `tf.context.set` blocked |
| `minimal-readwrite` | `context`, `logging` | Yes |
| `integration-bridge` | `context`, `logging`, `data-access`, `connector` | Yes |
| `legacy-compat-s1` | `context`, `logging` | No |

**Normal process runs** with `SANDBOX_LEGACY_DEFAULTS=true` (platform default): profile **`minimal-readwrite`** and a **full legacy capability list** even when the UI omits sandbox options. See § Capabilities below.

---

## Capabilities (`options.sandbox_capabilities`)

When **omitted** on execute and `SANDBOX_LEGACY_DEFAULTS=true`:

`context`, `logging`, `file`, `data-access`, `connector`, `keystore`, `api`, `llm`

When **present** (including `[]`): that list is used exactly.

| Capability | Enables (`new-sandbox`) |
|------------|-------------------------|
| `context` | `tf.context.*`, step context reads/writes (subject to profile) |
| `logging` | `tf.log` |
| `data-access` | `tf.dataAccess.*`, `tenantDb` query helpers |
| `connector` | `tf.connector.execute`, `integration.executeSync` / async helpers |
| `file` | `files.read` / `files.write` / `files.list`, tenant `file_*` helpers (`$`-prefixed aliases for migration) |
| `keystore` | Keystore object (when `process_id` set) |
| `api` | Internal HTTP `api` / `process` / `operations` / datapool / email / notification / OCR / image (needs auth context) |
| `llm` | Mediated LLM surface (`callLLM` / `complete`; `chat` blocked) |
| `network` | Reserved; direct network blocked |
| `system` | Reserved; always blocked |

If a step logs `files is null` or `Connector capability is not enabled`, check capabilities and `SANDBOX_LEGACY_DEFAULTS` — not only the profile name.

---

## Modern SDK (`tf` object)

Primary API for snippets in `new-sandbox`:

```typescript
// Context (requires "context" capability + writable profile for set)
const name = tf.context.get("customer.name");
tf.context.set("status", "processed");
const snap = tf.context.snapshot();

// Logging (requires "logging")
tf.log("info", "Processing order", { orderId: process_input.order_id });

// Capabilities (always available)
if (!tf.capabilities.includes("connector")) { /* handle restricted profile */ }

// Utilities (always available)
const now = tf.utils.nowIso();
const hash = tf.utils.sha256(payload);
const sig = tf.utils.hmacSha256(body, secret);

// Data access (requires "data-access")
const row = await tf.dataAccess.getRecord("customers", id);
const rows = await tf.dataAccess.findRecords("customers", { status: "active" });

// Connectors / integrations (requires "connector")
await tf.connector.execute("connector-id", "operation", { key: "value" });
await tf.integration.execute("integration-id", { input: data });
```

Snippets are wrapped as `(async () => { … })()`; use `return` with the standard step result shape (see [interface/v1/return-format.md](interface/v1/return-format.md)).

---

## Compatibility globals

The VM also injects shorthand globals when capabilities and execution context allow:

| Preferred | Compatibility alias |
|-----------|---------------------|
| `process_input` | Top-level context keys |
| `tf.context` | `process_output`, spread context keys |
| `tenantDb` | Tenant-scoped SQL helpers |
| `integration` | `connectors` (deprecated) |
| `notification.send` / `dispatch` / `update` / `remove` | Old `create*Notification` names **not** available |

---

## Service method matrix (authoring)

### API (`api` / `tf.api`)

| Method | Supported | Notes |
|--------|-----------|-------|
| `get(url, headers?)` | Yes | Internal auth headers when execution context is present |
| `post(url, data?, headers?)` | Yes | Mutations and many platform actions |
| `put(url, data?, headers?)` | Yes | Prefer service helpers when available |
| `delete` | **No** | Use service helpers (for example `datapool.remove`) |

Internal URLs only. External systems: `tf.connector` / `tf.integration`.

### Process (`process` / `tf.process`)

| Method | Supported |
|--------|-----------|
| `execute(processId, input?, { async? })` | Yes — preferred over raw execute-process HTTP |

### Operations (`operations` / `tf.operations`)

| Method | Supported |
|--------|-----------|
| `createApprovalGate`, `getApprovalGate`, `openApproval`, `openAction`, `openException`, `updateProgress`, `complete`, `validate` | Yes |

### Files (`files`)

| Method | Supported |
|--------|-----------|
| `read(relativePath)` | Yes |
| `write(relativePath, content)` | Yes |
| `list()` | Yes |
| `getFiles()`, `getFile()`, `readFile()`, `getFileInfo()`, `uploadToExternal()` | **No** — use `files.read` / `files.write` / `files.list` |

Requires capability **`file`**. Service may be `null` when no execution upload context.

Tenantdata helpers: prefer unprefixed **`file_*`** names (`file_put_contents`, `mkdir`, …); `$`-prefixed aliases exist for migration (see [Code_Snippets/File_Operations.md](Code_Snippets/File_Operations.md)).

### Notification (`notification`)

| Method | Description |
|--------|-------------|
| `send(payload)` | Create notification (process-scoped config) |
| `dispatch(payload)` | Send via notification integration path |
| `update(payload)` | Update existing notification |
| `remove(notificationId)` | Delete by id string |

Legacy methods `createNotification`, `createSystemNotification`, `createAdminNotification` are **not** supported on backend-next.

### Integration (`integration`)

| Method | Notes |
|--------|-------|
| `executeSync(id, data, options?)` | Blocking |
| `execute(id, data, options?)` | Per integration config |
| `executeAsync(id, data, options?)` | Returns job/execution id |
| `getStatus(executionId)` | Poll async runs |
| `getResult(executionId)` | Fetch completed async output |
| `cancel(executionId)` | Cancel queued run |
| `getPendingCount()` | Tenant integration queue depth |

Prefer `tf.connector.execute` for simple sync calls; `integration` / `tf.integration` for the full queue API. Deprecated: `connectors`.

---

## Documented but not supported (avoid in snippets)

| Pattern | Why |
|---------|-----|
| `require`, dynamic `import()`, `eval`, `Function` | Blocked in validator |
| Raw DB drivers / low-level DB APIs in snippet | Blocked; use `tenantDb` / `tf.dataAccess` |
| `BackgroundJobQueueService` in snippet | Internal only; use `tf.process.execute(..., { async: true })` |
| `api.delete` | Not exposed on the client |
| Direct `fetch` / shell / `process.env` mutation | Blocked |
| `files.getFiles()` and related legacy file helpers | Use `files.read` / `write` / `list` |
| `notification.createAdminNotification()` etc. | Use `notification.send` / `dispatch` |
| `llm.chat` / `llm.callLLMStream` | Use `llm.callLLM` / `complete` |

---

## Configure runs (summary)

```json
{
  "process_id": "process_…",
  "input_data": {},
  "async": false,
  "options": {
    "sandbox_mode": "new-sandbox",
    "sandbox_profile": "minimal-readwrite",
    "sandbox_capabilities": ["context", "logging", "file", "connector"],
    "sandbox_language": "typescript"
  }
}
```

Triggers: map `execution_options` to the same `options` shape.

UI **Execute Process** modal typically omits sandbox keys → platform applies `SANDBOX_LEGACY_DEFAULTS` parity.

---

## Troubleshooting (snippet author view)

| Symptom | Likely cause |
|---------|----------------|
| `Context write is not allowed by active sandbox profile` | `minimal-readonly` or explicit caps; need `minimal-readwrite` or legacy defaults |
| `files is null` / file helpers missing | Missing `file` capability or no upload on execution |
| `Connector capability is not enabled` | Explicit minimal `sandbox_capabilities` without `connector` |
| `api.post` fails auth / `internal HTTP is not configured` | Missing `app_url`, `user_id`, `execution_auth_key`, or `execution_auth_source_id` |
| `llm.chat` rejected | Use `llm.callLLM` / `tf.llm.callLLM` |
| `tf.keystore` is `null` | `keystore` capability off or missing `process_id` |

Full `tf` method lists: [PROCESSFLOW_SANDBOX_TF_API.md](PROCESSFLOW_SANDBOX_TF_API.md).
