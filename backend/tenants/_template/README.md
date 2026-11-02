# App Model — tenant template

Canonical BFF + WebApp template for Tealfabric App Model.

## Contents

| Path | Purpose |
|------|---------|
| `snippets/` | ProcessFlow steps (router, auth, items, files, integrations) |
| `lib/app-helpers.ts` | Shared helpers concatenated into steps at deploy time |
| `scripts/deploy-platform.mjs` | Create/update processes, WebApp, CDN upload |
| `config/defaults.json` | App name, public URI, CDN path |
| `config/integration.json.example` | Optional integration id for the demo probe |
| `WEBAPP.md` | Shell WebApp HTML/JS definition |

## Usage

```bash
cp -r backend/tenants/_template backend/tenants/tenant-<TENANT_UUID>
# edit config; set env vars; then:
node backend/tenants/tenant-<TENANT_UUID>/scripts/deploy-platform.mjs
```

Do not commit `platform-ids.generated.json` or `config/integration.json` with secrets.

Reusable ProcessFlow patterns that are **not** part of this demo BFF live in repo-root [`examples/`](../../../examples/README.md).
