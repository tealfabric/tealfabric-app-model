# ProcessFlow Code Snippets Quick Reference

**TypeScript-first (interface v1.0.4).** Full contract: [PROCESSFLOW_SANDBOX_TF_API.md](PROCESSFLOW_SANDBOX_TF_API.md), [PROCESSFLOW_CODE_SNIPPETS_GUIDE.md](PROCESSFLOW_CODE_SNIPPETS_GUIDE.md), [PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md), [interface/v1/](interface/v1/).

Use `process_input` (from previous step). Prefer **`tf.*`** in new steps. Prefer `tf.connector` / `tf.integration` over deprecated `connectors`.

---

## Basic template (TypeScript)

```typescript
try {
  const email = process_input.email as string;
  if (!email) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Email required" },
      data: null,
    };
  }

  tf.log("info", "Processing", { email });

  return {
    success: true,
    data: { email, status: "processed" },
    message: "Operation completed",
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: err.message },
    data: null,
  };
}
```

---

## Common patterns

### Validation

```typescript
if (!process_input.email) {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Email required" },
    data: null,
  };
}
const email = String(process_input.email);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return {
    success: false,
    error: { code: "INVALID_EMAIL", message: "Invalid email format" },
    data: null,
  };
}
return { success: true, data: { ...process_input, email } };
```

### Tenant database (legacy global)

```typescript
const row = await tenantDb.getOne(
  "SELECT * FROM Customers WHERE email = ?",
  [process_input.email]
);
if (!row) {
  return {
    success: false,
    error: { code: "NOT_FOUND", message: "Customer not found" },
    data: null,
  };
}
return { success: true, data: row };
```

### Internal API

```typescript
const result = await api.get("/api/v1/entities");
if (!result.success) {
  return {
    success: false,
    error: {
      code: "API_ERROR",
      message: "Failed to fetch entities",
      details: String(result.status_code),
    },
    data: null,
  };
}
return { success: true, data: { entities: result.data } };
```

### Integration

```typescript
const result = await integration.executeSync("integration_id_here", {
  key: process_input.value,
});
return { success: true, data: result };
```

### Notification

```typescript
await notification.send({
  title: "Order complete",
  message: `Order ${process_input.order_id} finished`,
  type: "success",
  user_id: process_input.user_id,
});
return { success: true, data: { notified: true } };
```

### Uploaded files

```typescript
if (!files) {
  return { success: true, data: { files: [], count: 0 } };
}
const names = await files.list();
const contents: Record<string, string> = {};
for (const name of names) {
  contents[name] = await files.read(name);
}
return { success: true, data: { files: contents, count: names.length } };
```

### Async process (prefer `tf.process.execute`)

```typescript
const result = await tf.process.execute(
  "process_target_id",
  { source_id: process_input.id },
  { async: true }
);
return {
  success: true,
  data: { result, status: "queued" },
};
```

---

## Modern `tf` helpers (preferred on new snippets)

See [PROCESSFLOW_SANDBOX_TF_API.md](PROCESSFLOW_SANDBOX_TF_API.md) for the full reference.

```typescript
if (!tf.capabilities.includes("connector")) {
  return { success: false, error: { code: "NO_CONNECTOR", message: "connector disabled" } };
}
tf.log("info", "Step started");
tf.context.set("last_run", tf.utils.nowIso());
const signature = tf.utils.hmacSha256(payload, secret);
const id = tf.utils.deterministicId(process_input);
await tf.sleep(100);
```
