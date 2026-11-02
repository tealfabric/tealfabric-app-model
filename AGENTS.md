# Tealfabric App Model — agent guide

This repository is a **single full-stack app model** for the Tealfabric IO platform (frontend SPA + ProcessFlow BFF). It is not an apps monorepo.

## Before you change code

1. Read [README.md](README.md) and the relevant docs under `docs/`.
2. **Tenant boundaries** — production snippets live under `backend/tenants/tenant-<uuid>/`. Template sources are in `backend/tenants/_template/`; copy, don’t edit tenant folders in place unless deploying that tenant.
3. **Never commit secrets** — `.env`, `.env.local`, API keys, `platform-ids.generated.json`, `config/integration.json`.

## Platform execution model

- **No standalone backend server.** HTTP APIs are Tealfabric **WebApps** bound to **ProcessFlow** router processes.
- BFF handlers are **TypeScript snippets** in the ProcessFlow sandbox (`new-sandbox`). Use platform APIs only: `api`, `datapool`, `integration`, `tf.*`, `context`, `logging`, `file`, `connector`, …
- **Do not** use raw `fetch`, Node drivers, `eval`, or `process.env` mutation in snippets. See [docs/SANDBOX_COMPLIANCE.md](docs/SANDBOX_COMPLIANCE.md) and [docs/processflow/PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md](docs/processflow/PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md).
- Frontends are **static SPAs** published to tenant CDN and loaded by shell WebApps. Keep Vite `base: './'` and router basenames aligned with [backend/tenants/_template/WEBAPP.md](backend/tenants/_template/WEBAPP.md).

## Shared BFF conventions

| Topic | Convention |
|-------|------------|
| Request envelope | `{ "action": "<name>", "payload": { ... } }` — flat payload, max two levels |
| Auth | WebApp JWT Bearer (`auth_transport: "bearer"`). Login verifies platform credentials then `jwt.issueWebappAccess`. Client stores `webapp_access` and sends `Authorization: Bearer`. Keep `auth_require: false` on the login WebApp. |
| Errors | `{ success: false, error: { code, message, details? } }` |
| Router | `00_router.ts` maps `action` → handler process via `route_map` in deploy config |
| Helpers | Concatenated from `lib/app-helpers.ts` at deploy time via `deploy-platform.mjs` |
| CDN shell CSP | Set `custom_security_policy` allowing `https://cdn.tealfabric.io` |

## Where to put new ProcessFlow examples

- **App BFF handlers** (this product’s router actions) → `backend/tenants/_template/snippets/`
- **Reusable reference patterns** (not wired into the demo app) → `examples/<category>/`
- **Contract / sandbox docs** → `docs/processflow/`

## Deploy and build

- Deploy entrypoint: `backend/tenants/tenant-<uuid>/scripts/deploy-platform.mjs` (or `_template` while prototyping)
- Requires: `TEALFABRIC_API_KEY`, `TEALFABRIC_TENANT_ID` (recommended), `TEALFABRIC_WEBAPP_USER_ID`
- Frontend build: `frontend/dist/` → CDN path from `config/defaults.json` (default `CDN/app-model`)
