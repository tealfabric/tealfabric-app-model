# Notifications

Send in-app and system notifications from ProcessFlow steps. **TypeScript preferred**; see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

## Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Code Snippet   │────▶│  notification    │────▶│  Users          │
│  (Notify)       │     │  / email         │     │  (In-App)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Services

| Name | Description |
|------|-------------|
| `notification` | In-app / process notifications (`send`, `dispatch`, `update`, `remove`) |
| `email` | Email via `email.send(payload)` |
| `integration` | SMS/push via connectors |

## Notification methods (backend-next)

| Method | Description |
|--------|-------------|
| `send(payload)` | Create notification via process notification config |
| `dispatch(payload)` | Send notification through integration path |
| `update(payload)` | Update existing notification |
| `remove(notificationId)` | Delete by notification id string |

**Removed:** `createNotification`, `createSystemNotification`, `createAdminNotification` — do not use in new snippets.

---

## Example: notify user (TypeScript)

```typescript
const userId = String(process_input.result?.user_id ?? "");
const title = String(process_input.result?.title ?? "");
const message = String(process_input.result?.message ?? "");

if (!userId || !title || !message) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "user_id, title, message required" }, data: null };
}

await notification.dispatch({
  process_id: process_id,
  title,
  message,
  type: process_input.result?.type ?? "info",
  user_id: userId,
  tenant_id: tenant_id,
});

tf.log("info", "Notification sent", { userId });
return { success: true, data: { user_id: userId, title } };
```

## Example: email

```typescript
await email.send({
  to: process_input.email as string,
  subject: "Process complete",
  text: `Hello ${process_input.name}`,
  process_id: process_id,
});
return { success: true, data: { sent: true } };
```

## Removed APIs

Do not use `createNotification`, `createSystemNotification`, or `createAdminNotification` — they are not available on backend-next. Use `notification.send` or `notification.dispatch`.
