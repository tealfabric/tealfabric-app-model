# API contract

BFF actions accepted by `app-model-router`. Protected actions require a valid WebApp JWT (`type: webapp_access`) in `Authorization: Bearer` (or `payload.access_token`).

## Request envelope

```typescript
type BffRequest = {
  action: string;
  payload?: Record<string, unknown>; // preferred (AGENTS.md)
};
```

The SPA may call `callBff({ action, …fields })`; the client wraps fields into `payload` and attaches the Bearer token. The router also accepts legacy flat bodies.

Public actions: `health`, `ping`, `auth_login`, `auth_logout`, `auth_bootstrap`, `auth_session`.

## Auth actions

### `auth_login` (public)

**Request:** `{ "action": "auth_login", "payload": { "email": "…", "password": "…" } }`

Verifies credentials against platform `/api/v1/auth/login`. The WebApp entry router then issues a WebApp JWT with `jwt.issueWebappAccess` (nested handler processes cannot mint tokens):

```json
{
  "success": true,
  "access_token": "<webapp_access JWT>",
  "token_type": "Bearer",
  "expires_at": "…",
  "data": {
    "authenticated": true,
    "user_id": "…",
    "email": "…",
    "role": "user",
    "expires_at": "…"
  }
}
```

Do not treat the product login `access_token` as the browser session — only the issued `webapp_access` JWT.

The platform currently redacts `access_token` in ProcessFlow execute responses. Login also returns the same JWT as `webapp_access` (unredacted alias). The SPA accepts either field.

### `auth_logout` (public)

Returns `{ success: true, clear_auth_cookie: true, data: { logged_out: true } }`. With `auth_transport: "bearer"` the SPA clears its stored token; `clear_auth_cookie` is harmless if no cookie was set.

### `auth_bootstrap` / `auth_session` (public at router; Bearer required in handler)

**Request:** `{ "action": "auth_bootstrap", "payload": {} }`

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "...",
    "email": "user@example.com",
    "full_name": "User Name",
    "role": "user",
    "tenant_id": "..."
  }
}
```

## Business actions

### `health` (public)

**Request:** `{ "action": "health" }`

### `list_items`

**Request:** `{ "action": "list_items", "payload": { "limit": 50, "offset": 0, "status": "draft" } }`

### `create_item`

**Request:** `{ "action": "create_item", "payload": { "title": "My item", "description": "…", "status": "draft" } }`

## Error codes

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | Missing/invalid/expired WebApp JWT |
| `FORBIDDEN` | Admin roles not allowed |
| `VALIDATION_ERROR` / `VALIDATION_FAILED` | Bad input |
| `INVALID_ACTION` | Unknown or unmapped action |
| `HANDLER_FAILED` | Downstream process failure |

## Platform auth (BFF-proxied)

| Endpoint / API | Method | Notes |
|----------------|--------|-------|
| `/api/v1/auth/login` | POST | Credential check only inside `auth_login` |
| `jwt.issueWebappAccess` | sandbox | Issues browser session JWT |

Browser session is the WebApp `webapp_access` JWT — never a product `type: access` console token.
