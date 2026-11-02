# Process Communication

Trigger other processes and call internal APIs from snippet code. **TypeScript preferred.**

## Prefer `tf.process.execute`

Recommended way to call another process from a step:

```typescript
const result = await tf.process.execute(
  "process_target_id",
  {
    source: process_input,
    tenant_id: tenant_id,
  },
  { async: true }
);

if (!result?.success) {
  return {
    success: false,
    error: {
      code: "PROCESS_EXECUTE_ERROR",
      message: String(result?.error?.message ?? result?.error ?? "Failed to execute process"),
    },
    data: null,
  };
}

return {
  success: true,
  data: {
    queue_id: result.data?.queue_id ?? result.queue_id,
    status: result.data?.status ?? (result.async ? "queued" : "completed"),
    execution_id: result.data?.execution_id ?? result.execution_id,
  },
};
```

| Argument | Description |
|----------|-------------|
| `processId` | Target process id (string) |
| `input?` | Input payload passed to the target process |
| `options.async?` | When `true`, queue asynchronously; when `false`/omitted, run according to platform default |

Prefer this helper over raw HTTP. It uses the same execution auth context as other `tf.*` services.

## API service (`api` / `tf.api`)

HTTP client for **internal** platform URLs, with automatic execution authorization when running inside a process execution.

| Method | Supported |
|--------|-----------|
| `get(url, headers?)` | Yes |
| `post(url, data?, headers?)` | Yes |
| `put(url, data?, headers?)` | Yes |
| `delete` | **No** |

Response shape: `{ success: boolean, status_code: number, data: unknown }`.

## Fallback: raw `api.post(...execute-process)`

If you need advanced execute options not exposed on `tf.process.execute`, you can still call the platform API directly:

```typescript
const base = app_url ?? `https://${http_headers?.Host ?? "localhost"}`;
const result = await tf.api.post(`${base}/api/v1/processflow?action=execute-process`, {
  process_id: "process_target_id",
  input_data: {
    source: process_input,
    tenant_id: tenant_id,
  },
  async: true,
  options: {
    priority: "normal",
    execution_strategy: "sequential",
  },
});

if (!result.success) {
  return {
    success: false,
    error: { code: "API_ERROR", message: "Failed to queue process", details: String(result.status_code) },
    data: null,
  };
}

return {
  success: true,
  data: { queue_id: result.data?.queue_id, status: "queued" },
};
```

Actions:

- `execute-process` — simple async/sync execute
- `execute-process-advanced` — same with `options.priority`, `execution_strategy`, sandbox overrides

See [WEBAPP_ASYNC_PROCESS_TRIGGER_GUIDE.md](../WEBAPP_ASYNC_PROCESS_TRIGGER_GUIDE.md).

## Synchronous internal GET

```typescript
const result = await tf.api.get("/api/v1/entities");
return result.success
  ? { success: true, data: result.data }
  : { success: false, error: { code: "API_ERROR", message: "Request failed" }, data: null };
```

## API restrictions

Use `api.get` / `api.post` / `api.put` only. `api.delete` is not available in the sandbox. Prefer `tf.api` and `tf.process.execute` in new steps.
