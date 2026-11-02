# Interface v1 — Return Format

Every step **must** return an object. The platform uses it to decide success/failure and to pass data to the next step.

## Required keys

| Key | Type | Description |
|-----|------|-------------|
| `success` | bool | `true` if the step succeeded, `false` on error. |
| `data` | object \| null | Payload for the next step. On success, any object; on failure, typically `null`. |

## Optional keys

| Key | Type | Description |
|-----|------|-------------|
| `message` | string | Human-readable status (e.g. "Operation completed successfully"). |
| `error` | object | Required when `success === false`. See [error-format.md](error-format.md). |

## Success example

```typescript
return {
  success: true,
  data: {
    customer_id: customerId,
    status: "processed",
  },
  message: "Processing completed successfully",
};
```

## Failure example

```typescript
return {
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Email is required",
    details: "Missing required field: email",
  },
  data: null,
};
```

## Behavior

- **success = true:** Platform takes `data` and passes it as `process_input` to the next step.
- **success = false:** Platform stops the process, logs the error, and does not run subsequent steps.

Return a plain object with the required keys. Do not use `console.log` for step output; use `tf.log` for logging.
