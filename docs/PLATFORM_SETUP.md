# Platform setup

## Prerequisites

1. TealFabric tenant with API access
2. API key with permissions to create processes, webapps, and upload documents
3. At least one **regular platform user** (`role: user`) for testing login
4. Optional: one integration UUID for `integration_status` demos

## Steps

### 1. Copy tenant template

```bash
cp -r backend/tenants/_template backend/tenants/tenant-<TENANT_UUID>
```

Update `WEBAPP.md` CDN path with your tenant ID.

### 2. Configure integration (optional)

```bash
cp backend/tenants/tenant-<id>/config/integration.json.example \
   backend/tenants/tenant-<id>/config/integration.json
# set example_integration_id
```

### 3. Build and deploy

```bash
cd frontend && npm install && npm run build && cd ..

export TEALFABRIC_API_KEY=...
export TEALFABRIC_API_URL=https://dev.tealfabric.io
export TEALFABRIC_TENANT_ID=<tenant-uuid>
export TEALFABRIC_WEBAPP_USER_ID=<platform-user-uuid>

node backend/tenants/tenant-<id>/scripts/deploy-platform.mjs
```

### 4. Create test user

In the platform admin UI (or API), create a user with:

- `role`: `user` (not `tenant_admin`)
- Tenant membership for your test tenant

### 5. Verify

1. Open `https://<platform>/app-model`
2. Sign in with the test user (JWT stored in browser storage)
3. Visit Items, Files, Integrations pages
4. Confirm BFF health on Home

## WebApp configuration

| Field | Value |
|-------|-------|
| Name | `app-model` |
| Public URI | `/app-model` |
| Process | `app-model-router` |
| CSP | Deploy sets `custom_security_policy` for CDN |
| `webapp_user_id` | Platform user for execution impersonation |

See `WEBAPP.md` for shell HTML and CDN loader JS.

## Local development

```bash
cd frontend
cp .env.example .env.local
npm install && npm run dev
```

Auth is Bearer JWT (`Authorization` header). On localhost, set `VITE_BFF_URL` to a deployed WebApp URL; the SPA stores `webapp_access` in memory/sessionStorage. Deploy sets `auth_transport: "bearer"`.

```bash
# frontend/.env.local
VITE_BFF_URL=https://dev.tealfabric.io/app-model
VITE_ROUTER_BASENAME=/app-model
```
