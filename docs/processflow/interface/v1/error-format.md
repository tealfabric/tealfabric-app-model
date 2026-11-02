# Interface v1 — Error Format

When a step returns `success: false`, it must include an `error` key with the following structure.

## Required error keys

| Key | Type | Description |
|-----|------|-------------|
| `code` | string | Machine-readable error code (e.g. `VALIDATION_ERROR`, `DATABASE_ERROR`). |
| `message` | string | Human-readable error message. |

## Optional error keys

| Key | Type | Description |
|-----|------|-------------|
| `details` | string | Additional context (e.g. exception message, trace, or field list). |

## Example (TypeScript)

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

## Common error codes (convention)

| Code | Typical use |
|------|-------------|
| `VALIDATION_ERROR` | Invalid or missing input. |
| `DATABASE_ERROR` | DB operation failed. |
| `CONNECTOR_ERROR` / `INTEGRATION_ERROR` | External service/API failure. |
| `BUSINESS_RULE_ERROR` | Business logic violation. |
| `PERMISSION_ERROR` | Access denied. |
| `TIMEOUT_ERROR` | Operation timed out. |
| `RESOURCE_ERROR` | Resource not available. |
| `UNKNOWN_ERROR` | Unexpected failure. |

Prefer returning this structure over throwing. Uncaught exceptions may still fail the step but are harder for the platform to classify — use try/catch and return `success: false` when possible.
