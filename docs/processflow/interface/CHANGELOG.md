# Interface Changelog

ProcessFlow step contract changes by version. Non-breaking rules: patch = clarifications/optional additions; minor = new optional variables/keys; major = breaking changes with migration path.

## [1.0.4] — platform sandbox sync (2026-11)

Aligned with current `dev.tealfabric.io` backend-next Node VM sandbox (`process-sandbox-js-globals.factory.ts`, public `41_process-sandbox-tf-api.md`).

- **`tf.process` / `process`:** `execute(processId, input?, { async? })` — preferred process-to-process calls (requires `api`).
- **`tf.operations`:** My Work helpers — `createApprovalGate`, `getApprovalGate`, `openApproval`, `openAction`, `openException`, `updateProgress`, `complete`, `validate` (requires `api`).
- **`tf.image`:** `thumbnail({ source_path, dest_path, width, height, fit?, quality? })` (requires `api`).
- **`tf.sleep` / `tf.wait`:** Millisecond delay helpers (no `setTimeout` in VM).
- **`api.put`:** Documented as supported for internal HTTP (alongside `get` / `post`). `api.delete` still not exposed on the client.
- **`jwt.issueWebappAccess`:** Documented alongside `decodePayload` / `verify`.
- **Tenant file helpers:** Both unprefixed (`file_put_contents`, `mkdir`, …) and `$`-prefixed (`$file_put_contents`, `$mkdir`, …) aliases are injected.
- **`notification.remove(notificationId)`:** Positional string id (not an options object).
- **Docs/examples:** Prefer `tf.*`; category guides use structured `{ code, message }` errors; outbound webhooks via connectors.
- **Docs/examples naming:** Prefer TypeScript-style unprefixed tenant file helpers; `$`-prefixed aliases documented for migration only.

## [1.0.3] — backend-next / public docs alignment

- **`tf` API:** Documented `tf.capabilities`, `tf.utils.hmacSha256`, full `tf.integration` async surface, `files.write`, OCR/document review services.
- **Variables:** `process_output`, `execution_auth_source_id`, `run_correlation_id`, `/root` `process_db` and `db`.
- **Guardrails:** Blocked patterns aligned with public sandbox doc (`fetch`, `child_process`, `process.env`, execution timeout bounds).
- **Docs:** New [PROCESSFLOW_SANDBOX_TF_API.md](../PROCESSFLOW_SANDBOX_TF_API.md).

## [1.0.2] — TypeScript-only authoring (docs)

- All examples and category guides use TypeScript.
- Single reference prototype: `cursor-process-step-code-snippet_prototype.ts`.

## [1.0.1] — backend-next sandbox alignment (docs)

- **Language policy:** TypeScript preferred; JavaScript supported.
- **Modern SDK:** Documented `tf.context`, `tf.log`, `tf.dataAccess`, `tf.connector`, `tf.integration`, `tf.utils`.
- **API:** `api.get` / `api.post` (and later `put` in 1.0.4).
- **Files:** `files.read` / `write` / `list`.
- **Notification:** `send`, `dispatch`, `update`, `remove`.
- **Compatibility matrix:** See `docs/processflow/PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md`.

## [1.0.0] — Initial

- **Variables:** `process_input`, `raw_input` (WebApp), `tenant_id`, `user_id`, `tenantDb`, `datapool`, `integration`, `api`, `execution_auth_key`, `llm`, `email`, `notification`, `files` (when execution_id set), `http_headers`, `request_method`, `request_uri`, `remote_addr`, `app_url`. Raw database drivers are not available in standard tenant context.
- **Return format:** Object with required `success` (bool) and `data` (object or null). Optional `message` (string). On failure, `error` (object) with `code`, `message`, `details`.
- **Logging:** `tf.log(level, message, ctx?)` — structured audit logging.
- **Compatibility:** Platform sandbox implementing this contract is compatible with snippets written for interface v1.0.x.
