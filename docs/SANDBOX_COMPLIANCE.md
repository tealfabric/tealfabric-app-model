# Sandbox compliance

Process steps in this app model target the **new sandbox** (`sandbox_mode: new-sandbox`) with TypeScript snippets.

## Capabilities used

| Capability | Used in | APIs |
|------------|---------|------|
| `api` | router, auth_platform, list_integrations | `api.get`, `api.post` |
| `context` | router | `tf.context.set` |
| `logging` | all handlers | `tf.log` |
| `data-access` | auth sessions, list/create items, upload metadata | `datapool.query`, `datapool.insert`, `datapool.update` |
| `file` | list/upload files | `tf.files.list`, `$file_put_contents` |
| `connector` | integration_status | `integration.executeSync` |

## Rules followed

- No `eval`, `Function()`, dynamic `import()`, or `require()`
- No direct DB drivers (`mysql`, `PDO`, `pg_connect`, …)
- No arbitrary external `fetch` — HTTP via `api` / `tf.api` only
- No `child_process`, shell commands, or `process.env` mutation
- No custom end-user password tables — platform `/auth/login` for credential check only; `jwt.issueWebappAccess` for browser session (`webapp_access` JWT)
- Return shape matches `spec/v1/step-contract.json`

## Blocked capabilities (not used)

| Capability | Reason |
|------------|--------|
| `network` | Reserved — blocked |
| `system` | Always blocked |
| `llm` | Not needed for app model prototype |

## Validating snippets

Before deploy, ensure snippets pass platform save-time validation. Reference:

- `dev.tealfabric.io/docs/PROCESS_SANDBOX_CAPABILITIES.md`
- `dev.tealfabric.io/public/docs/main/02_automations-and-processflow/40_sandbox-guardrails.md`
- `dev.tealfabric.io/public/docs/main/02_automations-and-processflow/41_process-sandbox-tf-api.md`

## Explicit capability restriction (production)

For tighter security in production handlers, set `sandbox_capabilities` on process execution:

```json
["context", "logging", "data-access", "api"]
```

Omit capabilities the step does not need (e.g. drop `connector` from item CRUD handlers).
