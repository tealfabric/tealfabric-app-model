# Process sandbox `tf` API reference

JavaScript and TypeScript process steps run in the **new sandbox** (`sandbox_mode: new-sandbox`). The platform injects a namespaced helper object, **`tf`**, alongside legacy root globals (`tenantDb`, `integration`, `api`, …) used by migrated snippets.

Use **`tf.*` in new steps**. Root globals remain available for migrated snippets and are mirrored on `tf` where noted below.

See also: [PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md), [PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md](PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md), [interface/v1/](interface/v1/).

---

## Two ways to call the same services

| Style | Example | When to use |
|-------|---------|-------------|
| **`tf` namespaced** | `tf.log("info", "started")`, `tf.connector.execute(...)`, `tf.datapool.query(...)` | **Preferred** for new TypeScript/JavaScript steps |
| **Root globals** | `log_message("info", "started")`, `integration.executeSync(...)`, `datapool.query(...)` | Migrated snippets; same objects are aliased on `tf` |

Both styles respect the same **sandbox capabilities**. If a capability is disabled, the matching method throws a clear error (for example `Connector capability is not enabled`).

---

## Sandbox capabilities

Each step run carries a capability list. Methods that need a capability are blocked when that capability is not granted.

| Capability | Unlocks |
|------------|---------|
| `context` | `tf.context.get`, `tf.context.set`, `tf.context.snapshot` |
| `logging` | `tf.log`, `log_message` |
| `data-access` | `tf.dataAccess`, `tf.tenantDb`, `tenantDb`, SQL helpers |
| `connector` | `tf.connector`, `tf.integration` (`execute`, `executeSync`, `executeAsync`, …) |
| `api` | `tf.api`, `tf.datapool`, `tf.email`, `tf.notification`, `tf.process`, `tf.operations`, OCR, image thumbnail, document review |
| `llm` | `tf.llm` (`callLLM`, `complete`) |
| `file` | `tf.files`, tenant file helpers (`read`, `write`, `file_get_contents`, `mkdir`, …) |
| `keystore` | `tf.keystore` (`get`, `set`, `list`) |

When `sandbox_capabilities` is omitted from a run, the platform applies a default set controlled by the worker setting `SANDBOX_LEGACY_DEFAULTS` (typically the full legacy helper surface: `context`, `logging`, `file`, `data-access`, `connector`, `keystore`, `api`, `llm`).

To restrict a step deliberately, pass an explicit `sandbox_capabilities` array when executing the process (see [PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md)).

HTTP-backed helpers (`api`, `datapool`, `integration.executeSync`, …) also require **internal HTTP context** on the execution payload: `app_url`, `user_id`, `execution_auth_key`, and `execution_auth_source_id`. Without that context you see `internal HTTP is not configured`. Normal process executions set these automatically; custom test harnesses must supply them.

---

## Core `tf` methods

These methods exist only on `tf` (there is no root-global alias).

### `tf.capabilities`

Array of enabled capability names for the current run. Use it to branch when a step may run with different profiles:

```typescript
if (!tf.capabilities.includes("connector")) {
  return { success: false, error: { code: "NO_CONNECTOR", message: "connector capability is disabled" } };
}
```

### `tf.log(level, message?, context?)`

Writes a structured line to the step execution log. Requires the `logging` capability.

```typescript
tf.log("info", "Normalizing order", { customer_id: process_input.customer_id });
tf.log("Order received"); // level defaults to info
```

`log_message(level, message, context?)` is the legacy alias with the same behavior.

### `tf.context`

Read and write values in the mutable execution context bag. Requires the `context` capability. Writes also require a writable sandbox profile (`minimal-readwrite` or `integration-bridge`).

| Method | Description |
|--------|-------------|
| `tf.context.get(path)` | Read a dotted path (for example `"order.id"`) |
| `tf.context.set(path, value)` | Write a value; throws if the path is invalid or profile is read-only |
| `tf.context.snapshot()` | Returns a shallow copy of the full context object |

```typescript
const prior = tf.context.get("enrichment.vendor");
tf.context.set("enrichment.vendor", "acme");
const all = tf.context.snapshot();
```

### `tf.utils`

Small deterministic helpers that do not require extra capabilities:

| Method | Description |
|--------|-------------|
| `tf.utils.nowIso()` | Current UTC timestamp as ISO-8601 string |
| `tf.utils.sha256(value)` | SHA-256 hex digest of a string or JSON-serialized value |
| `tf.utils.hmacSha256(message, secret)` | HMAC-SHA256 hex digest |
| `tf.utils.deterministicId(value)` | Stable hash-based ID from arbitrary input |

```typescript
const signature = tf.utils.hmacSha256(JSON.stringify(process_input), await keystore.get("webhook_secret"));
const id = tf.utils.deterministicId({ tenant_id, customer_id: process_input.customer_id });
```

### `tf.sleep(ms)` / `tf.wait(ms)`

Pauses the step for `ms` milliseconds. No capability required. `setTimeout` / `setInterval` are **not** available in the step VM. The delay counts against the step execution timeout.

```typescript
await tf.sleep(Number(process_input.delay_ms ?? 0));
```

### `tf.dataAccess` (read-only)

A read-only subset of tenant database access. Requires `data-access`. For inserts and updates, use `tf.tenantDb` instead.

| Method | Description |
|--------|-------------|
| `tf.dataAccess.getRecord(collection, id)` | Fetch one record by ID |
| `tf.dataAccess.findRecords(collection, filter?)` | Query records with an optional filter object |

```typescript
const row = await tf.dataAccess.getRecord("Customers", process_input.customer_id);
const open = await tf.dataAccess.findRecords("Orders", { status: "open" });
```

### `tf.connector`

Execute a configured integration connector synchronously. Requires `connector`. This is the recommended entry point for connector calls in new code.

```typescript
const result = await tf.connector.execute(
  "slack-api-v1-0-0",
  "post_message",
  { channel: "#alerts", text: "Order processed" }
);

if (!result?.success) {
  return { success: false, error: { code: "CONNECTOR_ERROR", message: String(result?.error ?? "failed") } };
}

return { success: true, data: result.result ?? result.data };
```

Arguments: `(integrationId, operation, payload?)`. The `operation` can also be supplied inside `payload.operation` when migrating older snippets.

---

## Services aliased on `tf`

These root globals are copied onto `tf` when available (for example `tf.tenantDb === tenantDb`).

| Root global | `tf` alias | Capability | Notes |
|-------------|------------|------------|-------|
| `tenantDb` | `tf.tenantDb` | `data-access` | `query`, `getOne`, `insert`, `update`, `delete`, `getRecord`, `findRecords` |
| `integration` | `tf.integration` | `connector` | Full async queue API (below) |
| `connectors` | `tf.connectors` | `connector` | Deprecated alias of `integration` |
| `api` | `tf.api` | `api` | Internal HTTP (`get`, `post`, `put`) — not for arbitrary external hosts |
| `process` | `tf.process` | `api` | `execute(processId, input?, { async? })` |
| `operations` | `tf.operations` | `api` | My Work: gates, approvals, actions, exceptions |
| `datapool` | `tf.datapool` | `api` | DataPool CRUD, schemas, timeseries, virtual tables |
| `llm` | `tf.llm` | `llm` | `callLLM` / `complete`; `chat` is not supported |
| `email` | `tf.email` | `api` | `send` |
| `notification` | `tf.notification` | `api` | `send`, `dispatch`, `update`, `remove(id)` |
| `jwt` | `tf.jwt` | — | `decodePayload`, `verify`, `issueWebappAccess` |
| `files` | `tf.files` | `file` | Execution-scoped file service; `null` when disabled |
| `keystore` | `tf.keystore` | `keystore` | Process-scoped secrets; `null` when disabled |
| `pdfOcr` / `imageOcr` | `tf.pdfOcr` / `tf.imageOcr` | `api` | `extractText` |
| `image` | `tf.image` | `api` | `thumbnail(...)` |
| `documentReview` | `tf.documentReview` | `api` | `createReviewFromProcessFlow` |
| `db` | `tf.db` | `data-access` | **`/root` tenant only** — raw MySQL handle |

### `tf.process.execute`

Preferred process-to-process call (same tenant). Requires `api` + internal HTTP context.

```typescript
const syncResult = await tf.process.execute("handler-process-id", process_input ?? {});
const queued = await tf.process.execute(
  "notify-process-id",
  { order_id: process_input.order_id },
  { async: true }
);
```

### `tf.operations` (My Work)

Publish governed work. Prefer these helpers over raw operations HTTP. Methods: `createApprovalGate`, `getApprovalGate`, `openApproval`, `openAction`, `openException`, `updateProgress`, `complete`, `validate`.

### `tf.image.thumbnail`

```typescript
const thumb = await tf.image.thumbnail({
  source_path: "uploads/shot.png",
  dest_path: "CDN/video-reel/clip-thumb.jpg",
  width: 320,
  height: 180,
  fit: "cover",
  quality: 85,
});
```

### `tf.integration` (queue-backed connectors)

`tf.connector.execute` is the simple synchronous path. `tf.integration` exposes the full integration worker API:

| Method | Description |
|--------|-------------|
| `execute` / `executeSync` | Run connector synchronously (same backend as `tf.connector.execute`) |
| `executeAsync` | Enqueue to the integration worker; returns `execution_id` |
| `getStatus(executionId)` | Poll queue status |
| `getResult(executionId)` | Fetch completed output |
| `cancel(executionId)` | Cancel a queued run |
| `getPendingCount()` | Tenant integration queue depth |

```typescript
const executionId = await tf.integration.executeAsync("restapi-generic-v1-0-0", {
  operation: "send",
  method: "POST",
  endpoint: "/hooks/acme",
  body: process_input,
});

const status = await tf.integration.getStatus(executionId);
if (status.status === "completed") {
  const output = await tf.integration.getResult(executionId);
  return { success: true, data: output?.result ?? null };
}
```

### `tf.tenantDb` (read/write SQL)

```typescript
const row = await tf.tenantDb.getOne(
  "SELECT id, email FROM Users WHERE id = ?",
  [process_input.user_id]
);

await tf.tenantDb.insert("AuditLog", {
  action: "order_created",
  entity_id: process_input.order_id,
  created_at: tf.utils.nowIso(),
});
```

Use parameterized queries. Avoid string concatenation for user-controlled values.

### `tf.datapool`

```typescript
const schemas = await tf.datapool.listSchemas();
const hits = await tf.datapool.query("orders", "status:open", []);
await tf.datapool.insert("orders", { order_id: "O-100", status: "open" });
const builder = tf.datapool.table("orders").sort("created_at", "desc").limit(10);
const page = await builder.get();
```

Additional methods: `getSchema`, `createSchema`, `update`, `remove` / `delete`, `bulkInsert`, `cache`, `performance`, `timeseries` (`query`, `insert`, `remove`), and `virtual` (`list`, `get`, `query`, `create`, `update`, `remove`).

### `tf.llm`

```typescript
const out = await tf.llm.callLLM("Summarize this ticket in three bullet points.", {
  model: "gpt-4o-mini",
  temperature: 0.2,
});
return { success: true, data: { summary: out.data?.text ?? out.text } };
```

`llm.chat` is blocked at save time and runtime. Use `callLLM` or `complete`.

### `tf.files` and tenant file helpers

When the `file` capability is enabled:

- **`files` / `tf.files`** (execution-scoped uploads): `read(relativePath)`, `write(relativePath, content)`, `list()`
- **Tenant helpers** (tenantdata): prefer unprefixed injected functions — `file_get_contents`, `file_put_contents`, `mkdir`, `read`, `write`, `glob`, stream helpers, etc. `$`-prefixed aliases exist for migration.

Paths must stay tenant-relative. Reject directory traversal (`..`, absolute paths outside tenant storage).

### `/root` only: `process_db` and `tf.db`

Platform maintenance steps running under tenant `/root` receive `process_db` — a raw MySQL handle for global tables and `ProcessStepLogs`. `tf.db` and `tenantDb.getRawConnection()` expose the same handle in that context only. Tenant-scoped steps should use `tf.tenantDb`, not raw handles.

---

## Complete step example

```typescript
type StepInput = { integration_id?: string; payload?: Record<string, unknown> };

async function run(input: StepInput): Promise<Record<string, unknown>> {
  const integrationId = String(input.integration_id ?? "").trim();
  if (!integrationId) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "integration_id is required" } };
  }

  tf.log("info", "Calling connector", { integration_id: integrationId, tenant_id });

  try {
    const result = await tf.connector.execute(
      integrationId,
      String(input.payload?.operation ?? "default"),
      input.payload ?? {}
    );

    return {
      success: true,
      data: {
        integration_id: integrationId,
        output: (result as { result?: unknown })?.result ?? result,
      },
    };
  } catch (err) {
    tf.log("error", "Connector call failed", { message: String(err) });
    return { success: false, error: { code: "CONNECTOR_ERROR", message: String(err) } };
  }
}

return run(process_input as StepInput);
```

---

## Authoring guidelines

1. **Prefer `tf.*`** over bare globals so capability boundaries are obvious in new code.
2. **Check capabilities** when a step may run with restricted profiles (`tf.capabilities.includes(...)`).
3. **Return structured objects** — `{ success, data }` or `{ success: false, error: { code, message } }` — not thrown exceptions for business failures.
4. **Use `tf.connector.execute`** for simple connector calls; use `tf.integration.executeAsync` when the parent process should not wait for the external system.
5. **Use `tf.process.execute`** to call another process (prefer over raw execute-process HTTP).
6. **Never log** `execution_auth_key` or keystore values.
7. **Do not use** `eval`, dynamic `import`, raw database drivers, or direct `fetch` — these are blocked at save time. See [PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md](PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md).
8. **Language:** Supported languages: TypeScript (preferred) and JavaScript. Other languages are not supported.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| `… capability is not enabled` | Step profile omits the required capability | Add capability to `sandbox_capabilities` or use a less restricted profile |
| `internal HTTP is not configured` | Missing `app_url` / auth context in a custom test | Run through normal process execution or set execution auth fields |
| `llm.chat` rejected at save | Unsupported API | Use `tf.llm.callLLM` |
| `tf.keystore` is `null` | `keystore` capability off | Enable capability; store secrets in keystore, not source code |
| Connector timeout | Long external call | Use `tf.integration.executeAsync` and poll `getStatus` |
| `Context write is not allowed` | Read-only sandbox profile | Use `minimal-readwrite` or platform legacy defaults |
