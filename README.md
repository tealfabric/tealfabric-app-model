# Tealfabric App Model

**v0.1.0** — Public reference model for building a **full application** on the [Tealfabric IO](https://tealfabric.io) platform: Vite + React frontend, WebApp shell, and ProcessFlow BFF (TypeScript / `new-sandbox`).

Use this repository when you need both UI and backend processes. For **ProcessFlow-only** work (no frontend), use a ProcessFlow snippets repository instead.

## What this demonstrates

| Layer | Pattern |
|-------|---------|
| **UI** | Client-only React SPA (Vite) published to tenant CDN |
| **Shell** | Platform WebApp loads CDN bundle; URL stays on `/app-model` |
| **Auth** | Regular platform users (`role: user`) via BFF login → WebApp JWT Bearer (`webapp_access`) |
| **BFF** | ProcessFlow action router bound to the WebApp |
| **Data** | DataPool schemas (`app_model_items`, `app_model_files`) |
| **Files** | Tenant storage via sandbox `file` capability |
| **Integrations** | Connector listing + health probe via `connector` / `api` |
| **Sandbox** | TypeScript steps in `new-sandbox` — no raw `fetch`, `eval`, or direct DB drivers |

## Repository layout

```
tealfabric-app-model/
├── frontend/                      # Vite + React SPA → CDN
├── backend/tenants/_template/     # BFF snippets, deploy script, WebApp spec
├── docs/                          # App architecture, API contract, setup
│   └── processflow/               # ProcessFlow authoring guides + interface
├── examples/                      # Shared ProcessFlow reference snippets
├── reference/                     # Agent prototype step template
├── spec/                          # Machine-readable step contract
├── INTERFACE_VERSION              # ProcessFlow step contract version (e.g. 1.0.4)
└── VERSION                        # This repository version (0.1.0)
```

Copy `backend/tenants/_template/` to `backend/tenants/tenant-<your-tenant-id>/` before deploying production tenant code.

## Quick start (local frontend)

```bash
cd frontend
npm install
cp .env.example .env.local   # adjust URLs
npm run dev
```

## Deploy to platform

```bash
export TEALFABRIC_API_KEY=...
export TEALFABRIC_TENANT_ID=...
export TEALFABRIC_WEBAPP_USER_ID=...   # platform user for webapp execution context
# optional: EXAMPLE_INTEGRATION_ID=...

node backend/tenants/_template/scripts/deploy-platform.mjs
```

See [docs/PLATFORM_SETUP.md](docs/PLATFORM_SETUP.md) for prerequisites.

## Documentation

### App (frontend + BFF)

- [Architecture](docs/ARCHITECTURE.md)
- [API contract](docs/API_CONTRACT.md)
- [DataPool schema](docs/DATAPOOL_SCHEMA.md)
- [Platform setup](docs/PLATFORM_SETUP.md)
- [Sandbox compliance](docs/SANDBOX_COMPLIANCE.md)
- [WebApp shell](backend/tenants/_template/WEBAPP.md)

### ProcessFlow (backend steps)

- [ProcessFlow docs index](docs/processflow/README.md)
- [WebApp ↔ ProcessFlow envelope](examples/webapps/README.md)
- [Examples](examples/README.md)
- [Step contract](spec/v1/step-contract.json)

## Versioning

| File | Meaning |
|------|---------|
| `VERSION` | App Model repository release (**0.1.0**) |
| `INTERFACE_VERSION` | ProcessFlow step interface the snippets target |

## License

MIT — see [LICENSE](LICENSE).
