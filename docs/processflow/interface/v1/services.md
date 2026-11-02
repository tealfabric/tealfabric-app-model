# Interface v1 — Services Summary

Services available in the step execution context. Steps run in `new-sandbox` with the `tf` object plus compatibility globals.

See [variables.md](variables.md), [../../PROCESSFLOW_SANDBOX_TF_API.md](../../PROCESSFLOW_SANDBOX_TF_API.md), [../../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

---

## Modern SDK (`tf`) — TypeScript / JavaScript

| Member | Capability | Description |
|--------|------------|-------------|
| `tf.capabilities` | — | Array of enabled capability names for this run |
| `tf.context.get(path)` | `context` | Read context value |
| `tf.context.set(path, value)` | `context` + writable profile | Write context value |
| `tf.context.snapshot()` | `context` | Shallow copy of context |
| `tf.log(level, message, ctx?)` | `logging` | Structured log (`debug` \| `info` \| `warn` \| `error`) |
| `tf.utils.nowIso()` | — | ISO timestamp |
| `tf.utils.sha256(value)` | — | SHA-256 hash |
| `tf.utils.hmacSha256(message, secret)` | — | HMAC-SHA256 hex digest |
| `tf.utils.deterministicId(value)` | — | Stable id from value |
| `tf.sleep(ms)` / `tf.wait(ms)` | — | Pause step (no `setTimeout` in VM; counts against step timeout) |
| `tf.dataAccess.getRecord(collection, id)` | `data-access` | Single record (read-only) |
| `tf.dataAccess.findRecords(collection, filter?)` | `data-access` | Query records (read-only) |
| `tf.connector.execute(id, operation, payload?)` | `connector` | Synchronous connector operation (preferred) |

`log_message(level, message, context?)` is the legacy logging alias for `tf.log`.

---

## TenantDatabaseService (`tenantDb` / `tf.tenantDb`)

Tenant-scoped database operations. Enforces tenant isolation. Requires **`data-access`** capability.

| Method | Description |
|--------|-------------|
| `getTenantId()` | Current tenant id |
| `getOne(sql, params?)` | Single row or null |
| `query(sql, params?)` | Multiple rows |
| `insert(table, data)` | Insert; returns id |
| `update(table, data, conditions?)` | Update; returns affected count |
| `delete(table, conditions?)` | Delete rows |
| `getRecord(table, id)` | Fetch one record by id |
| `findRecords(table, filter?)` | Query with filter object |
| `getRawConnection()` | **`/root` tenant only** — raw MySQL handle |

Use prepared parameters. Never concatenate user input into SQL.

---

## DataPool (`datapool` / `tf.datapool`)

Schema-based storage via internal HTTP. Requires **`api`** capability and execution auth context.

| Method | Description |
|--------|-------------|
| `listSchemas(schemaName?)` | List schemas |
| `getSchema(schemaName)` | Fetch one schema |
| `createSchema(payload)` | Create schema |
| `query(schema, queryText, params?)` | Query records |
| `insert(schema, data, options?)` | Insert record(s) |
| `update(payload)` | Update records |
| `remove` / `delete(schema, dataId, payload?)` | Delete record |
| `bulkInsert(schema, dataArray, options?)` | Bulk insert |
| `table(schema)` | Fluent query builder |
| `cache(action?, payload?)` | Cache management |
| `performance(action?, options?)` | Performance stats |
| `timeseries.query/insert/remove` | Timeseries operations |
| `virtual.list/get/query/create/update/remove` | Virtual table helpers |

---

## Integration (`integration` / `tf.integration`)

Requires **`connector`** capability.

| Method | Description |
|--------|-------------|
| `executeSync(integrationId, data, options?)` | Run and wait |
| `execute(integrationId, data, options?)` | Alias of `executeSync` |
| `executeAsync(integrationId, data, options?)` | Queue; returns `execution_id` |
| `getStatus(executionId)` | Poll async execution |
| `getResult(executionId)` | Fetch completed output |
| `cancel(executionId)` | Cancel queued run |
| `getPendingCount()` | Tenant integration queue depth |

Deprecated: **`connectors`** — use `integration`.

`tf.connector.execute(id, operation, payload?)` is the recommended shorthand for synchronous calls.

---

## API (`api` / `tf.api`)

HTTP to **internal** platform URLs. Execution auth and tenant/user headers added when execution context is present. Requires **`api`** capability plus `app_url`, `user_id`, `execution_auth_key`, and `execution_auth_source_id`.

| Method | Supported |
|--------|-----------|
| `get(url, headers?)` | Yes |
| `post(url, data?, headers?)` | Yes |
| `put(url, data?, headers?)` | Yes — prefer service helpers (`datapool.update`, `tf.operations.*`) when available |
| `delete` | **No** — use service-specific helpers |

Response shape: `{ success: boolean, status_code: number, data: unknown }`.

Do **not** use `api` for arbitrary external hosts. Outbound calls to third parties go through **`tf.connector` / `tf.integration`**.

---

## Process (`process` / `tf.process`)

Requires **`api`** capability. Preferred process-to-process entry point (instead of raw `api.post(...execute-process)`).

| Method | Description |
|--------|-------------|
| `execute(processId, input?, { async? })` | Run another process in the same tenant; set `async: true` to queue |

---

## Operations / My Work (`operations` / `tf.operations`)

Requires **`api`** capability. Publish governed work into Operations My Work.

| Method | Description |
|--------|-------------|
| `createApprovalGate(payload)` | Create pending human gate; returns `human_request_id` |
| `getApprovalGate(humanRequestId)` | Read gate status / decision |
| `openApproval(payload)` | Card with `attention: approval` (strict pending gate) |
| `openAction(payload)` | Card with `attention: action_required` |
| `openException(payload)` | Card with `attention: blocked` |
| `updateProgress(payload)` | Upsert journey / checks without forcing kind |
| `complete(payload)` | Mark done |
| `validate(payload)` | Dry-run validation |

Prefer these helpers over raw `api.put("/api/v1/operations/requests", …)`.

---

## LLM (`llm` / `tf.llm`)

Requires **`llm`** capability.

| Method | Description |
|--------|-------------|
| `callLLM(prompt, options?)` | Call platform LLM |
| `complete(prompt, options?)` | Alias of `callLLM` |
| `chat(...)` | **Blocked** — not supported |

---

## Email (`email` / `tf.email`)

Requires **`api`** capability.

**send(payload)** — Queue transactional email. Required fields: `to`, `subject`, and at least one of `text` / `html`.

---

## Notification (`notification` / `tf.notification`)

Requires **`api`** capability.

| Method | Description |
|--------|-------------|
| `send(payload)` | Create notification (process-scoped) |
| `dispatch(payload)` | Send via notification integration |
| `update(payload)` | Update notification |
| `remove(notificationId)` | Delete by notification id **string** |

Legacy methods **`createNotification`**, **`createSystemNotification`**, **`createAdminNotification`** are **not** supported. Use **send** / **dispatch**.

---

## Files (`files` / `tf.files`)

Requires **`file`** capability. May be **`null`** when capability is off or no execution context.

| Method | Description |
|--------|-------------|
| `read(relativePath)` | Read execution-scoped file content |
| `write(relativePath, content)` | Write execution-scoped file |
| `list()` | List execution-scoped relative paths |

**Tenant storage** (tenantdata) uses injected **functions**, not `files.*`. When `file` is enabled, prefer unprefixed helpers; `$`-prefixed aliases exist for migration:

- `file_get_contents`, `file_put_contents`
- `mkdir`, `file_exists`, `read`, `write`
- `glob`, `fopen` / `fread` / `fwrite` / `fclose`, and related path utilities

Legacy **`getFiles()`**, **`getFile()`**, **`readFile()`**, **`uploadToExternal()`** are removed — do not use in new snippets.

---

## Keystore (`keystore` / `tf.keystore`)

Process-scoped secrets. Requires **`keystore`** capability and a valid `process_id`. May be **`null`** when disabled.

| Method | Description |
|--------|-------------|
| `get(key)` | Read secret value |
| `set(key, value)` | Store secret |
| `list()` | List key names |

---

## JWT (`jwt` / `tf.jwt`)

| Method | Description |
|--------|-------------|
| `decodePayload(token)` | Decode JWT payload without verification |
| `verify(token)` | Verify stack-issued HS256 access tickets |
| `issueWebappAccess(payload?)` | Mint WebApp access ticket when WebApp context allows |

---

## OCR, image, and document review

Requires **`api`** capability.

| Service | Method | Description |
|---------|--------|-------------|
| `pdfOcr` / `tf.pdfOcr` | `extractText(filePath, options?)` | Extract text from PDF in tenant storage |
| `imageOcr` / `tf.imageOcr` | `extractText(filePath, options?)` | Extract text from image in tenant storage |
| `image` / `tf.image` | `thumbnail({ source_path, dest_path, width, height, fit?, quality? })` | Write JPEG thumbnail into tenant storage |
| `documentReview` / `tf.documentReview` | `createReviewFromProcessFlow(payload)` | Start document review workflow |

Paths must be tenant-relative (for example `platforms/25/receipts/invoice.pdf`).

---

All services are injected by the platform. Do not instantiate database clients, call `fetch` to arbitrary hosts, or import platform source files into snippets.
