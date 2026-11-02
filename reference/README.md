# Reference — ProcessFlow Step Prototype

Reference file for agents (Cursor, etc.) and authors. Runtime: **backend-next** TypeScript/JavaScript (`new-sandbox`).

## File

**`cursor-process-step-code-snippet_prototype.ts`** — canonical starting point for new snippets. It demonstrates:

- Return contract: `{ success, data, error?, message? }`
- Input: `process_input` from the previous step
- Logging: `tf.log(level, message, ctx?)` — not `console.log`
- Database: `tf.tenantDb` / `tf.dataAccess` — no raw drivers
- HTTP: `tf.api.get` / `post` / `put` (internal only; no `delete`)
- Process-to-process: `tf.process.execute(..., { async?: true })`
- Integrations: `tf.connector.execute` / `tf.integration.*`
- Files: `files.read` / `write` / `list` for uploads; unprefixed `file_*` helpers for tenantdata (`$`-prefixed aliases for migration)
- Notifications: `notification.send` / `dispatch`

Tied to **interface v1.0.4**; see `docs/processflow/interface/v1/` and `docs/processflow/PROCESSFLOW_SANDBOX_TF_API.md`.

## Agent workflow

1. Read this prototype and [docs/processflow/PROCESSFLOW_QUICK_REFERENCE.md](../docs/processflow/PROCESSFLOW_QUICK_REFERENCE.md).
2. Pick a category guide from [docs/processflow/Code_Snippets/](../docs/processflow/Code_Snippets/README.md) if relevant.
3. Cross-check guardrails in [docs/processflow/PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md](../docs/processflow/PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md).
4. Copy patterns from [examples/](../examples/README.md) when building multi-step flows.
