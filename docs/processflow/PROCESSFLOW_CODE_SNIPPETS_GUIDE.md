# ProcessFlow Code Snippets Guide

## Overview

ProcessFlow code snippets are **TypeScript or JavaScript** code blocks that execute within individual process steps in the **backend-next** sandbox (`new-sandbox` mode). Each snippet receives input from the previous step, processes it, and returns a structured result for the next step.

**Language policy**

| Language | Use |
|----------|-----|
| **TypeScript** | Default for all new snippets |
| **JavaScript** | Supported in the same VM sandbox |

See [PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md) for execution modes, profiles, and capabilities.

## Table of Contents

1. [Basic Structure](#basic-structure)
2. [Input and Output](#input-and-output)
3. [Available Variables](#available-variables)
4. [Error Handling](#error-handling)
5. [Code Examples](#code-examples)
6. [Best Practices](#best-practices)
7. [Common Patterns](#common-patterns)

## Basic Structure

### ✅ Correct format (TypeScript)

```typescript
const processed = { ...process_input, status: "processed" };
tf.log("info", "Step completed");
return {
  success: true,
  data: processed,
  message: "Step completed",
};
```

### ❌ Incorrect format

```typescript
// WRONG — do not rely on console output for step data
console.log(process_input);
// No return — next step receives nothing useful
```

## Input and Output

### Input data

Each step receives data from the previous step as **`process_input`**:

```typescript
const customerName = process_input.name as string;
const customerEmail = process_input.email as string;
const orderAmount = Number(process_input.amount ?? 0);
```

### Output data

Each step must return an object with at least **`success`** and **`data`** (see [interface/v1/return-format.md](interface/v1/return-format.md)):

```typescript
return {
  success: true,
  data: {
    customer_id: "CUST_123",
    status: "processed",
    amount: orderAmount,
  },
};
```

## Available Variables

Prefer **`tf.*`**. Root globals remain for migration. Full contract: [interface/v1/variables.md](interface/v1/variables.md) and [PROCESSFLOW_SANDBOX_TF_API.md](PROCESSFLOW_SANDBOX_TF_API.md).

| Variable | Type | Description |
|----------|------|-------------|
| `process_input` | object | Data from previous step / trigger |
| `process_output` | object | Mutable output bag for the current step |
| `raw_input` | string | Raw POST/JSON body (WebApp / webhooks) |
| `tenant_id` | string | Current tenant ID |
| `user_id` | string | Current user ID |
| `webapp_tenant_id` | string | WebApp tenant ID (usually same as `tenant_id`) |
| `process_id` / `process_execution_id` | string | Process / workflow ids |
| `execution_auth_key` | string | HMAC key for internal API — **never log or return** |
| `execution_auth_source_id` | string | Source id for internal HTTP auth headers |
| `run_correlation_id` | string | Log / support correlation |
| `app_url` | string | Application base URL |
| `tenantDb` / `tf.tenantDb` | object | Tenant-scoped DB (**recommended**) |
| `db` / `process_db` | — | **`/root` only** — prefer `tenantDb` for tenant steps |
| `integration` / `tf.integration` | object | Integration queue API (**recommended**) |
| `connectors` | object | **Deprecated** — use `integration` / `tf.connector` |
| `api` / `tf.api` | object | Internal HTTP: **`get`**, **`post`**, **`put`** |
| `process` / `tf.process` | object | `execute(processId, input?, { async? })` |
| `operations` / `tf.operations` | object | My Work / human-gate helpers |
| `datapool` / `tf.datapool` | object | DataPool schemas and records |
| `llm` / `tf.llm` | object | `callLLM` / `complete` (`chat` blocked) |
| `email` / `tf.email` | object | `send` |
| `notification` / `tf.notification` | object | `send`, `dispatch`, `update`, `remove(id)` |
| `files` / `tf.files` | object \| null | Execution uploads: **`read`**, **`write`**, **`list`** |
| `keystore` / `tf.keystore` | object \| null | Process secrets |
| `jwt` / `tf.jwt` | object | `decodePayload`, `verify`, `issueWebappAccess` |
| `pdfOcr` / `imageOcr` / `image` / `documentReview` | object | OCR / thumbnail / review (require `api`) |
| `tf` | object | Modern SDK namespace (prefer for new steps) |
| `http_headers` / `request_method` / `request_uri` / `remote_addr` | — | WebApp request metadata |

Tenant storage helpers (when `file` capability is on): prefer `file_put_contents`, `mkdir`, and related unprefixed helpers — separate from `files.*` (execution uploads). `$`-prefixed aliases exist for migration.

### Example Usage

```typescript
// Use available variables
// ✅ RECOMMENDED: Use tenantDb for secure, tenant-scoped queries
const customer = await tenantDb.getOne(
  "SELECT * FROM Customers WHERE email = ?",
  [process_input.email]
);

// Access form data from WebApp
const customer_name = process_input.name;
const customer_email = process_input.email;

// Use WebApp tenant ID (same as tenant_id)
const webapp_tenant = webapp_tenant_id;

// Access request information (when triggered by WebApp)
const host = http_headers?.Host ?? "localhost";
const protocol =
  http_headers?.["X-Forwarded-Proto"] === "https" ? "https" : "http";
const baseUrl = `${protocol}://${host}`;

// Use app_url for API calls (recommended - uses APP_URL from .env)
const apiUrl = app_url; // e.g., "https://dev.tealfabric.io"

// Access raw input for signature verification (e.g., Stripe webhooks)
const rawPayload = raw_input ?? "";

// Use integration service (RECOMMENDED)
const result = await integration.executeSync(integrationId, data);

// Use API service to call internal or external APIs
const apiResult = await api.get("/api/v1/entities");
const entities = apiResult.success
  ? (apiResult.data?.entities ?? [])
  : [];

return {
  success: true,
  data: {
    customer,
    integration_result: result,
    entities,
    processed_by: user_id,
  },
};
```

### WebApp-Specific Variables

When a process is triggered by a WebApp form submission, the following additional variables are available:

- **`raw_input`**: Raw POST/JSON data (useful for webhook signature verification)
- **`http_headers`**: HTTP headers object (includes `Host`, `User-Agent`, `Content-Type`, etc.)
- **`request_method`**: HTTP method (`GET`, `POST`)
- **`request_uri`**: Request URI path
- **`remote_addr`**: Client IP address

**Example: Using app_url for API calls (Recommended)**

```typescript
// ✅ RECOMMENDED: Use app_url from environment (APP_URL from .env)
const apiUrl = `${app_url}/api/v1/registration/check-email`;
const result = await api.post(apiUrl, { email });
```

**Alternative: Getting base URL from WebApp request (when needed)**

```typescript
// Alternative: Get base URL from HTTP headers (only when triggered by WebApp)
const host = http_headers?.Host ?? "localhost";
const protocol =
  http_headers?.["X-Forwarded-Proto"] === "https" ? "https" : "http";
const baseUrl = `${protocol}://${host}`;

const apiUrl = `${baseUrl}/api/v1/registration/check-email`;
const result = await api.post(apiUrl, { email });
```

## Error Handling

### Standard Error Response Format

Always return this structure for errors:

```typescript
return {
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Human readable error message",
    details: "Additional error details (optional)",
  },
  data: null,
};
```

### Success Response Format

```typescript
return {
  success: true,
  data: {
    result: "processed_data",
    id: "generated_id",
    status: "completed",
  },
  message: "Operation completed successfully",
};
```

### Error Handling Examples

#### Validation Errors

```typescript
// Validate input data
if (!process_input.email) {
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Email is required",
      details: "Missing required field: email",
    },
    data: null,
  };
}

const email = String(process_input.email);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return {
    success: false,
    error: {
      code: "INVALID_EMAIL",
      message: "Invalid email format",
      details: "Email must be a valid email address",
    },
    data: null,
  };
}

// Continue with processing...
return { success: true, data: processed_data };
```

#### Database Errors

```typescript
try {
  const customer_id = await tenantDb.insert("Customers", {
    name: process_input.name,
    email: process_input.email,
  });

  if (!customer_id) {
    return {
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to save customer",
        details: "Database insert operation failed",
      },
      data: null,
    };
  }

  return {
    success: true,
    data: { customer_id },
    message: "Customer created successfully",
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: {
      code: "DATABASE_CONNECTION_ERROR",
      message: "Database operation failed",
      details: err.message,
    },
    data: null,
  };
}
```

#### External API Errors

```typescript
try {
  const result = await integration.executeSync("payment-gateway", process_input);

  if (!result.success) {
    return {
      success: false,
      error: {
        code: "PAYMENT_GATEWAY_ERROR",
        message: "Payment processing failed",
        details: result.error?.message ?? "Unknown payment error",
      },
      data: null,
    };
  }

  return {
    success: true,
    data: result.data,
    message: "Payment processed successfully",
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: {
      code: "CONNECTOR_ERROR",
      message: "External service unavailable",
      details: err.message,
    },
    data: null,
  };
}
```

## Code Examples

### Data Transformation

```typescript
// Transform customer data
const email = String(process_input.email ?? "");
const output = {
  customer_id: `CUST_${email.slice(0, 5).toUpperCase()}`,
  full_name: `${process_input.first_name} ${process_input.last_name}`,
  is_premium: Number(process_input.amount ?? 0) > 1000,
  processed_at: new Date().toISOString(),
};

return {
  success: true,
  data: output,
  message: "Data transformed successfully",
};
```

### Database Operations

#### Standard Tenant-Scoped Queries (Recommended)

For regular tenant processes, use `tenantDb` for secure, tenant-scoped database operations:

```typescript
// ✅ RECOMMENDED: Use tenantDb for tenant-scoped queries
const customer = await tenantDb.getOne(
  "SELECT * FROM Customers WHERE email = ?",
  [process_input.email]
);

let customerId: string | number;
if (!customer) {
  customerId = await tenantDb.insert("Customers", {
    name: process_input.full_name,
    email: process_input.email,
    created_by: user_id,
    // tenant_id is automatically added by tenantDb
  });
} else {
  customerId = customer.customer_id;
}

return {
  success: true,
  data: { customer_id: customerId },
};
```

#### Direct Database Access (Advanced - System-Level Processes Only)

For system-level processes (`/root` tenant) that need cross-tenant database access:

```typescript
// ⚠️ ADVANCED: Direct database access (only for /root tenant system processes)
try {
  const result = await db.query(
    "SELECT tenant_id FROM Subscriptions WHERE stripe_customer_id = ?",
    [stripeCustomerId]
  );

  if (!result) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Tenant not found" },
      data: null,
    };
  }

  return {
    success: true,
    data: { tenant_id: result.tenant_id },
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: {
      code: "DATABASE_ERROR",
      message: "Database operation failed",
      details: err.message,
    },
    data: null,
  };
}
```

**Important Notes:**
- Use try/catch for exception handling in all processes
- **`db`** is only available for `/root` tenant processes (system-level)
- For regular tenant processes, always use `tenantDb` for tenant-scoped queries

### Decision Logic

```typescript
// Make approval decision
const amount = Number(process_input.amount ?? 0);

if (amount > 5000) {
  return {
    success: true,
    data: {
      approval_required: true,
      next_step: "manager_approval",
      reason: "High amount requires manager approval",
      amount,
    },
    message: "Approval required for high amount",
  };
}

return {
  success: true,
  data: {
    approval_required: false,
    next_step: "process_payment",
    reason: "Amount within auto-approval limit",
    amount,
  },
  message: "Auto-approved",
};
```

### API Service Usage

The `api` service provides methods to make HTTP requests to internal Tealfabric APIs or external services. All requests automatically include tenant and user context headers.

#### Available methods (backend-next)

**GET request:**
```typescript
const result = await api.get(url, headers?);
```

**POST request:**
```typescript
const result = await api.post(url, data?, headers?);
```

`put` and `delete` are **not** exposed on the current runtime. Use `post` with the appropriate API action and body (for example process execute or resource mutations).

#### Response Format

All methods return the same structure:
```typescript
{
  status_code: number,  // HTTP status code (200, 404, etc.)
  data: unknown,        // Decoded JSON response
  success: boolean,     // true if status 200-299
}
```

#### Example: Internal API Calls

```typescript
const result = await api.get("/api/v1/entities");

if (result.success) {
  const entities = result.data?.entities ?? [];
  return {
    success: true,
    data: { entities, count: entities.length },
  };
}

return {
  success: false,
  error: {
    code: "API_ERROR",
    message: "Failed to fetch entities",
    details: `HTTP ${result.status_code}`,
  },
  data: null,
};
```

#### Example: Create Resource via API

```typescript
const notificationData = {
  title: "Order Created",
  message: `Order #${process_input.order_id} has been created`,
  type: "success",
};

const result = await api.post("/api/v1/notifications", notificationData);

if (result.success) {
  return {
    success: true,
    data: {
      notification_id: result.data?.notification_id,
      status: "created",
    },
  };
}

return {
  success: false,
  error: {
    code: "NOTIFICATION_ERROR",
    message: "Failed to create notification",
  },
  data: null,
};
```

#### Example: Update or delete via API

Use **`api.post`** with the platform action or endpoint that performs the mutation (there is no `put` or `delete` on the snippet `api` object):

```typescript
const entityId = process_input.entity_id;
const result = await api.post(`/api/v1/entities/${entityId}?action=update`, {
  name: process_input.new_name,
  metadata: process_input.metadata ?? {},
});
return result.success
  ? { success: true, data: { updated: true } }
  : { success: false, error: { code: "UPDATE_ERROR", message: "Update failed" }, data: null };
```

#### Example: External API Calls

```typescript
try {
  const apiData = {
    name: process_input.full_name,
    email: process_input.email,
    amount: process_input.amount,
  };

  const result = await api.post("https://api.example.com/payment", apiData, {
    Authorization: `Bearer ${apiKey}`,
    "X-Custom-Header": "value",
  });

  if (result.success) {
    return {
      success: true,
      data: {
        payment_id: result.data?.payment_id,
        status: result.data?.status,
      },
    };
  }

  return {
    success: false,
    error: {
      code: "PAYMENT_FAILED",
      message: "Payment processing failed",
      details: `HTTP ${result.status_code}`,
    },
    data: null,
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: {
      code: "API_EXCEPTION",
      message: "API call failed",
      details: err.message,
    },
    data: null,
  };
}
```

#### Custom Headers

You can add custom headers to any request, which will be merged with the automatic headers:

```typescript
const result = await api.get("/api/v1/entities", {
  Authorization: "Bearer YOUR_TOKEN",
  "X-Custom-Header": "value",
});

// Custom headers are merged with automatic headers:
// - X-Tenant-ID (automatic)
// - X-User-ID (automatic)
// - Content-Type: application/json (automatic)
// - User-Agent: ProcessFlow/1.0 (automatic)
// - Authorization: Bearer YOUR_TOKEN (custom)
// - X-Custom-Header: value (custom)
```

**Note**: Custom headers override automatic headers if they have the same name.

#### Error Handling

```typescript
try {
  const result = await api.get("/api/v1/entities");

  if (!result.success) {
    switch (result.status_code) {
      case 400:
        return { success: false, error: { code: "BAD_REQUEST", message: "Bad request" }, data: null };
      case 401:
        return { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" }, data: null };
      case 404:
        return { success: false, error: { code: "NOT_FOUND", message: "Not found" }, data: null };
      case 429:
        return { success: false, error: { code: "RATE_LIMIT", message: "Rate limited" }, data: null };
      default:
        return { success: false, error: { code: "API_ERROR", message: "API error" }, data: null };
    }
  }

  return { success: true, data: result.data };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: {
      code: "EXCEPTION",
      message: err.message,
    },
    data: null,
  };
}
```

#### Timeout and Limits

The `api` service has the following built-in limits:

- **Request timeout**: 30 seconds (total time for request)
- **Connection timeout**: 10 seconds (time to establish connection)
- **Maximum redirects**: 3 (automatically follows redirects)
- **JSON handling**: Automatic encoding/decoding (no manual conversion needed)
- **SSL verification**: Disabled by default (for development; should be enabled in production)

**Note**: These limits are hardcoded in the `TenantAPIService` class.

For more detailed API usage examples, see the WebApp API Usage Guide in the **platform repository**.

### Files Service Usage

The `files` service provides secure access to files uploaded via WebApp forms. The service is only available when an `execution_id` is set (typically when files are uploaded through a WebApp).

**Note:** The `files` service may be `null` if no files were uploaded or if the process step is not part of a file upload workflow.

#### Available methods (backend-next)

**List uploads:**
```typescript
const paths = await files.list();
```

**Read file content:**
```typescript
const content = await files.read(relativePath);
```

Requires sandbox capability **`file`** and an execution with uploads. `files` may be **`null`** when no files were uploaded.

Legacy methods `getFiles()`, `getFile()`, `readFile()`, `getFileInfo()`, and `uploadToExternal()` are **not** available on the current runtime.

#### Example: access uploaded files

```typescript
if (!files) {
  return { success: true, data: { files: {}, count: 0 } };
}
try {
  const paths = await files.list();
  const out: Record<string, string> = {};
  for (const p of paths) {
    out[p] = await files.read(p);
  }
  return { success: true, data: { files: out, count: paths.length } };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: { code: "FILE_ERROR", message: err.message },
    data: null,
  };
}
```

#### Example: Read File Content

```typescript
if (files) {
  try {
    const paths = await files.list();
    const fileContent = paths[0] ? await files.read(paths[0]) : "";

    // Process file content
    // ... your processing logic ...

    return {
      success: true,
      data: { processed: true, size: fileContent.length },
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      success: false,
      error: {
        code: "FILE_READ_ERROR",
        message: err.message,
      },
      data: null,
    };
  }
}
```

#### Example: forward file content to an integration

Read with `files.read`, then call `integration.executeSync` (or `api.post`) to upload to an external system — do not use removed `uploadToExternal` helpers:

```typescript
if (!files) {
  return { success: true, data: { uploaded: false, reason: "no_files" } };
}
const paths = await files.list();
const first = paths[0];
if (!first) {
  return { success: true, data: { uploaded: false } };
}
const content = await files.read(first);
const result = await integration.executeSync("your_gitlab_integration_id", {
  path: first,
  content_base64: Buffer.from(content).toString("base64"),
});
return { success: true, data: { uploaded: true, result } };
```

#### Security Considerations

1. **Relative Paths Only**: All file paths in metadata are relative to prevent exposing server full paths.
2. **Tenant Isolation**: Files are stored in tenant-scoped directories (`storage/tenantdata/{tenant_id}/processdata/{execution_id}/`).
3. **Execution Scoping**: Files are scoped to a specific execution ID, ensuring process isolation.
4. **Path Validation**: The service validates all file paths to prevent directory traversal attacks.

For more detailed file upload documentation, see the WebApp File Upload Guide in the platform repository.

---

## Tenant File Operations

Process step code snippets have access to **tenant-scoped** file and directory operations. Prefer unprefixed injected helpers (e.g. `file_get_contents`, `file_put_contents`, `mkdir`, `is_dir`). `$`-prefixed aliases exist for migration.

All operations are scoped to `storage/tenantdata/<tenant_id>/` with automatic path validation to prevent directory traversal.

**Authoritative reference:** For the full list of available file closures, syntax, and examples, see [File Operations](Code_Snippets/File_Operations.md) in this repo.

### Debug Logging

Use **`tf.log(level, message, ctx?)`** for debugging and logging. Logs are written to the execution log and persisted for the step run.

#### Usage

```typescript
// Log a simple message
tf.log("info", "Processing customer data");

// Log with context
tf.log("info", "Rows to process", { count: rows.length });

// Log complex data
tf.log("debug", "Request headers", { headers });
```

#### Log File Structure

Each execution creates a separate JSON file containing all log entries:

**File Path:** `storage/tenantdata/<tenant_id>/processflows/<process_id>/<execution_id>.json`

**File Format:**
```json
[
  {
    "timestamp": "2025-11-11 05:15:17",
    "level": "info",
    "message": "Full log message here...",
    "execution_id": "step_exec_..."
  },
  {
    "timestamp": "2025-11-11 05:15:18",
    "level": "info",
    "message": "Another log message...",
    "execution_id": "step_exec_..."
  }
]
```

#### Important Notes

- **Full Logs in Files**: Complete, untruncated log messages are stored in JSON files
- **Truncated DB Logs**: Database logs are limited to 1000 bytes to save space (messages longer than 1000 bytes are truncated with `... [truncated]` suffix)
- **Per-Execution Files**: Each execution gets its own JSON file, making it easy to purge old logs by deleting old files
- **Error Handling**: If file logging fails, execution continues (logging is non-blocking)
- **Tenant Isolation**: Log files are stored in tenant-scoped directories

#### Example: Debugging Data Processing

```typescript
tf.log("info", "Starting data processing");
tf.log("debug", "Input data keys", { keys: Object.keys(process_input) });

const processed: unknown[] = [];
for (const item of process_input.items as unknown[]) {
  tf.log("debug", "Processing item", { item });
  processed.push(processItem(item));
}

tf.log("info", "Processing complete", { count: processed.length });
return { success: true, data: processed };
```

### Business Logic Validation

```typescript
// Validate business rules
const errors: string[] = [];

if (!process_input.email) {
  errors.push("Email is required");
}

if (!process_input.amount) {
  errors.push("Amount is required");
}

const email = String(process_input.email ?? "");
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  errors.push("Invalid email format");
}

const amount = Number(process_input.amount ?? 0);
if (process_input.amount) {
  if (amount < 0) {
    errors.push("Amount cannot be negative");
  }
  if (amount > 100000) {
    errors.push("Amount exceeds maximum limit");
  }
}

if (errors.length > 0) {
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: errors.join(", "),
    },
    data: null,
  };
}

return {
  success: true,
  data: {
    validated: true,
    amount,
    email,
  },
  message: "Validation passed",
};
```

## Best Practices

### 1. Always Return Objects
```typescript
// ✅ Good
return { success: true, data: result };

// ❌ Bad
return result; // Not the required shape
// No return — next step receives nothing useful
```

### 2. Use Descriptive Keys
```typescript
// ✅ Good - Clear structure
return {
  success: true,
  data: {
    customer_id: id,
    order_status: "pending",
    total_amount: amount,
  },
};

// ❌ Bad - Unclear structure
return {
  success: true,
  data: {
    a: id,
    b: "pending",
    c: amount,
  },
};
```

### 3. Handle Errors Gracefully
```typescript
try {
  const result = processData(process_input);
  return { success: true, data: result };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: {
      code: "PROCESSING_ERROR",
      message: err.message,
    },
    data: null,
  };
}
```

### 4. Keep Steps Atomic
Each step should do one thing well:

```typescript
// ✅ Good - Single responsibility
// Step 1: Validate input
if (!process_input.email) {
  return { success: false, error: { code: "MISSING_EMAIL", message: "Email required" }, data: null };
}

// Step 2: Save to database (use tenantDb for tenant-scoped inserts)
await tenantDb.insert("customers", { email: process_input.email });

// Step 3: Send notification
await email.send({
  to: process_input.email,
  subject: "Welcome!",
  html: "Your account is created",
});
```

### 5. Use Consistent Error Codes
```typescript
const ERROR_CODES = {
  VALIDATION_ERROR: "Input validation failed",
  DATABASE_ERROR: "Database operation failed",
  CONNECTOR_ERROR: "External service error",
  BUSINESS_RULE_ERROR: "Business logic violation",
  PERMISSION_ERROR: "Access denied",
  TIMEOUT_ERROR: "Operation timed out",
  RESOURCE_ERROR: "Resource not available",
  UNKNOWN_ERROR: "Unexpected error",
} as const;
```

## Spawning Async Processes from Process Steps

You can spawn asynchronous process executions from within a process step code snippet. This is useful when you need to trigger long-running processes without blocking the current step execution.

**Recommended Approach: API Call with Execution Authorization Key** - The simplest and most secure method using the built-in `api` service with automatic authentication.

### Approach 1: API Call with Execution Authorization Key (RECOMMENDED)

**API action:** Both `action=execute-process` and `action=execute-process-advanced` are valid. Use `execute-process` for simple async trigger; use `execute-process-advanced` when you need options such as `priority` or `execution_strategy`. The examples below use `execute-process-advanced` for flexibility.

**Pros:**
- ✅ **Simplest code** - Just use `api.post()` with automatic authentication
- ✅ **Automatic headers** - Execution auth key is automatically included
- ✅ **Secure** - Uses HMAC-SHA256 hash based on execution context
- ✅ **No manual setup** - Works out of the box
- ✅ **Consistent** - Same pattern as other API calls

**How it works:**
The `api` service automatically includes an `X-Process-Authorization-Key` header generated from your execution context. This key is a strong HMAC-SHA256 hash of `execution_id|tenant_id|user_id` signed with the system secret.

```typescript
const host = http_headers?.Host ?? "localhost";
const protocol =
  http_headers?.["X-Forwarded-Proto"] === "https" ? "https" : "http";
const baseUrl = `${protocol}://${host}`;

const result = await api.post(
  `${baseUrl}/api/v1/processflow?action=execute-process-advanced`,
  {
    process_id: "process_abc123",
    input_data: {
      customer_id: process_input.customer_id,
      order_amount: process_input.amount,
    },
    async: true,
    options: {
      priority: "normal",
    },
  }
);

if (result.success && result.data?.queue_id) {
  return {
    success: true,
    data: {
      async_process_queue_id: result.data.queue_id,
      async_process_status: "queued",
    },
    message: "Async process queued successfully",
  };
}

return {
  success: false,
  error: {
    code: "API_ERROR",
    message: "Failed to queue async process",
    details: result.data?.error ?? "Unknown error",
  },
  data: null,
};
```

**Note:** The `execution_auth_key` variable is also available directly if you need it for custom headers:

```typescript
const customHeaders = {
  "X-Custom-Header": "value",
  "X-Process-Authorization-Key": execution_auth_key,
};
const result = await api.post(url, data, customHeaders);
```

### Example: triggering follow-up process (TypeScript)

```typescript
const base = app_url ?? `https://${http_headers?.Host ?? "localhost"}`;
const result = await api.post(`${base}/api/v1/processflow?action=execute-process`, {
  process_id: "process_order_fulfillment",
  input_data: {
    order_id: process_input.order_id,
    customer_id: process_input.customer_id,
    items: process_input.items,
  },
  async: true,
});
return {
  success: true,
  data: {
    order_processed: true,
    fulfillment_queue_id: result.data?.queue_id ?? null,
    status: result.success ? "order_queued_for_fulfillment" : "queue_failed",
  },
};
```

### Example: conditional async spawning

```typescript
const amount = Number(process_input.amount ?? 0);
const spawned: Record<string, string> = {};
const base = app_url ?? `https://${http_headers?.Host ?? "localhost"}`;

if (amount > 1000) {
  const fraud = await api.post(`${base}/api/v1/processflow?action=execute-process-advanced`, {
    process_id: "process_fraud_check",
    input_data: { order_id: process_input.order_id, amount, customer_id: process_input.customer_id },
    async: true,
    options: { priority: "urgent" },
  });
  if (fraud.data?.queue_id) spawned.fraud_check = String(fraud.data.queue_id);
}
return { success: true, data: { amount, async_processes: spawned, spawned_count: Object.keys(spawned).length } };
```

> **Removed:** Direct `BackgroundJobQueueService` / `require` imports are not available in sandbox snippets. Prefer **`tf.process.execute(processId, input, { async: true })`**; raw `api.post(...execute-process...)` remains a fallback for advanced options.

### Important Notes

1. **Always use `async: true`**: When spawning from code snippets, always set `async: true` in options
2. **Tenant ID**: Always use `tenant_id` variable (not hardcoded values)
3. **Error Handling**: Consider whether async queue failures should fail the current step or just log warnings
4. **Queue ID Tracking**: Store `queue_id` in output if you need to track the spawned process later
5. **Priority Levels**: Use appropriate priority:
   - `urgent` - Critical business operations
   - `high` - Important background tasks
   - `normal` - Standard operations (default)
   - `low` - Non-critical tasks

### Checking async process status

Poll via platform API (exact path depends on deployment), for example:

```typescript
const queueId = process_input.async_process_queue_id;
if (!queueId) {
  return { success: true, data: { async_status: "unknown" } };
}
const status = await api.get(`/api/v1/processflow?action=execution-status&queue_id=${queueId}`);
return { success: true, data: { async_status: status.data } };
```

### Use Cases

- **Long-running operations**: Spawn processes with LLM calls or heavy computation
- **Follow-up workflows**: Trigger downstream processes after main process completes
- **Parallel processing**: Spawn multiple processes to run concurrently
- **Scheduled tasks**: Queue processes to execute at specific times
- **Background notifications**: Send emails/notifications without blocking main flow

## Common Patterns

### 1. Data Transformation Pipeline
```typescript
// Transform and enrich data
const output = { ...process_input };

output.full_name = `${process_input.first_name} ${process_input.last_name}`;
output.email_domain = String(process_input.email).split("@")[1] ?? "";
output.is_vip = Number(process_input.total_orders ?? 0) > 10;

output.processed_at = new Date().toISOString();
output.processed_by = user_id;

return { success: true, data: output };
```

### 2. Conditional Processing
```typescript
let output: Record<string, unknown>;

if (process_input.customer_type === "premium") {
  output = {
    discount_rate: 0.15,
    priority: "high",
    support_level: "dedicated",
  };
} else if (process_input.customer_type === "standard") {
  output = {
    discount_rate: 0.05,
    priority: "normal",
    support_level: "standard",
  };
} else {
  return {
    success: false,
    error: {
      code: "INVALID_CUSTOMER_TYPE",
      message: "Unknown customer type",
    },
    data: null,
  };
}

return { success: true, data: output };
```

### 3. Batch Processing
```typescript
const results: unknown[] = [];
const errors: Array<{ item: unknown; error: string }> = [];

for (const item of process_input.items as unknown[]) {
  try {
    results.push(processItem(item));
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    errors.push({ item, error: err.message });
  }
}

if (errors.length > 0) {
  return {
    success: false,
    error: {
      code: "BATCH_PROCESSING_ERROR",
      message: "Some items failed to process",
      details: errors,
    },
    data: { processed: results },
  };
}

return {
  success: true,
  data: {
    processed_items: results,
    total_count: results.length,
  },
};
```

## Error Code Reference

| Error Code | Description | When to Use |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | Input validation failed | Missing or invalid input data |
| `DATABASE_ERROR` | Database operation failed | SQL errors, connection issues |
| `CONNECTOR_ERROR` | External service error | API failures, service unavailable |
| `BUSINESS_RULE_ERROR` | Business logic violation | Rule violations, policy breaches |
| `PERMISSION_ERROR` | Access denied | Insufficient permissions |
| `TIMEOUT_ERROR` | Operation timed out | Long-running operations |
| `RESOURCE_ERROR` | Resource not available | File not found, service down |
| `UNKNOWN_ERROR` | Unexpected error | Catch-all for unexpected issues |

## Process Flow Behavior

The ProcessFlow system handles your return values as follows:

### Success Case (`success: true`)
1. Extracts the `data` field
2. Passes it as `process_input` to the next step
3. Continues process execution
4. Logs success message

### Error Case (`success: false`)
1. Logs the error details
2. Stops process execution
3. Returns error information to the user
4. Does not proceed to next steps

This ensures that errors are handled gracefully and don't crash the entire process.

## Security Considerations

1. **Input Validation**: Always validate input data
2. **SQL Injection**: Use prepared statements via `tenantDb`
3. **XSS Prevention**: Escape output data
4. **Resource Limits**: Respect memory and time limits
5. **Tenant Isolation**: Always use `tenant_id` in queries

## Performance Tips

1. **Keep Steps Light**: Avoid heavy operations in single steps
2. **Use Indexes**: Ensure database queries use proper indexes
3. **Batch Operations**: Process multiple items together when possible
4. **Cache Results**: Store frequently accessed data
5. **Monitor Resources**: Track memory and execution time usage

---

**See also** (these documents live in the **platform repository**, not in this snippets repo): ProcessFlow Architecture Guide, ProcessFlow API Reference, ProcessFlow Security Guide.
