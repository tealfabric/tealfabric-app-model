# ProcessFlow Sandbox Restrictions

Practical restrictions for code snippets executed in the **backend-next** process sandbox. See [PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md) for languages, modes, profiles, and service APIs. For the full `tf` surface, see [PROCESSFLOW_SANDBOX_TF_API.md](PROCESSFLOW_SANDBOX_TF_API.md).

**Language policy:** Supported languages: TypeScript (preferred) and JavaScript. Other languages are not supported.

---

## 1) Runtime model

| Path | Languages | Where code runs |
|------|-----------|-----------------|
| **`new-sandbox`** | TypeScript, JavaScript | Node.js `vm` with capability gates and static validation |

- Code is validated **before** execution (static content checks) and restricted **at runtime**.
- A **tenant context** is required.
- **Capabilities** and **sandbox profile** control which helpers are available (see compatibility matrix).
- Design snippets around approved service objects (`tf.tenantDb`, `tf.connector`, `tf.api`, `tf.keystore`, `tf.files`, …) or their legacy root aliases.

---

## 2) Blocked in TypeScript / JavaScript (`new-sandbox`)

Static validation rejects snippet source containing:

### Dynamic execution

- `eval(...)`, `create_function`, variable function calls
- `Function(...)`
- `child_process` and similar process-control APIs
- `process.exit` and host `process` global access

### Module loading

- `require(...)`
- Dynamic `import(...)`
- `include` / `include_once` (tenant-scoped steps)

### Blocked low-level DB / system APIs

Static checks reject low-level database and host APIs such as:

- Direct DB drivers: `mysql_connect`, `mysqli_*`, `pg_*`, `sqlite_*`, `PDO`, and similar patterns
- System command execution: `exec`, `system`, `shell_exec`, `passthru`, `proc_open`, `popen`
- Reflection / native XML / SOAP-style APIs: `ReflectionClass`, `DOMDocument`, `SoapClient`, and similar

Use **`tf.dataAccess`**, **`tf.tenantDb`**, **`api`**, or **`integration`** instead of raw drivers.

### Direct network primitives

- Direct `fetch` to arbitrary hosts
- Raw sockets
- Unauthorized `curl_*` calls

Use **`tf.api`** or **`tf.integration`** instead.

### Runtime/config mutation

`ini_set`, `putenv`, `set_time_limit`, writing to `process.env`, and similar host mutation patterns.

### Unsafe structure

Defining custom functions or classes inside snippets when not supported by your runtime profile.

### Raw server globals

Reading request environment outside injected context (`http_headers`, `request_method`, `request_uri`, `remote_addr`, …).

---

## 3) File access

When the **`file`** capability is enabled:

- **`files.read` / `files.write` / `files.list`** — execution-scoped uploads
- **Tenant file helpers** — prefer unprefixed names for tenantdata: `file_get_contents`, `file_put_contents`, `read`, `write`, `mkdir`, `glob`, `fopen`, and related helpers (`$`-prefixed aliases exist for migration)

Requires capability **`file`**, tenant id, and execution id where applicable. The **`files`** service may be **`null`** if file capability is off. Do not confuse tenant helpers with execution-scoped `files.read` / `write` / `list`.

Keep file paths tenant-relative; reject directory traversal (`..`, absolute paths outside tenant storage).

Do not use undocumented methods such as `getFiles()` in snippets.

---

## 4) Context variables

Top-level names include: `process_input`, `process_output`, `raw_input`, `tenant_id`, `user_id`, `process_id`, `process_execution_id`, `execution_auth_source_id`, `run_correlation_id`, `app_url`, WebApp request metadata, plus capability-gated services.

Prefer **`tf.context.get/set`** for structured context access. Inspect **`tf.capabilities`** when a step may run with a restricted profile.

---

## 5) Step configuration limits

| Setting | Guidance |
|---------|----------|
| `execution_timeout` | **1** to **86 400** seconds (24 hours). Default per step is **1 hour** unless configured otherwise. |
| `memory_limit` | Per-step memory input; default **64 MB**. The JS/TS VM runner does not hard-cap process memory to this value today — treat it as a planning hint. |
| Retries | Bounded by executor policy (typically up to **3** retries for transient failures). |

Invalid or out-of-range configuration fails validation at save or execute time.

---

## 6) Schema restrictions

When input/output schemas are defined:

- Field names: `[a-zA-Z_][a-zA-Z0-9_]*`
- Types: `string`, `integer`, `int`, `float`, `double`, `boolean`, `bool`, `array`, `object`, `null`, `mixed`

---

## 7) Common rejection reasons

| Symptom | Typical cause |
|---------|----------------|
| Blocked function/class | Direct system/network/DB call in snippet |
| `require` / `import` / `eval` | Disallowed module or dynamic execution |
| `… capability is not enabled` | Step profile omits required capability |
| `internal HTTP is not configured` | Missing `app_url` / auth context in custom test harness |
| `Context write is not allowed` | Read-only profile; use `minimal-readwrite` or legacy defaults |
| `files is null` / `tf.keystore is null` | Missing capability or no execution context |
| `llm.chat` rejected | Use `callLLM` / `complete` instead |
| Invalid syntax | Fix before save; TS is transpiled then checked |

---

## 8) Authoring checklist

- Write steps in **TypeScript** (or JavaScript).
- Use **`tf.*`** and documented service methods.
- Do not **`require`** platform classes or Node modules in snippets.
- Trigger async processes via **`api.post`** to execute-process endpoints, not internal queue imports.
- For capability-dependent features, confirm profile/capabilities or rely on platform legacy defaults (`SANDBOX_LEGACY_DEFAULTS`).
- Return structured results: `{ success: true, data: … }` or `{ success: false, error: { code, message } }`.
- Never log `execution_auth_key` or keystore values.
- See [PROCESSFLOW_CODE_SNIPPETS_GUIDE.md](PROCESSFLOW_CODE_SNIPPETS_GUIDE.md), [PROCESSFLOW_SANDBOX_TF_API.md](PROCESSFLOW_SANDBOX_TF_API.md), and [interface/v1/](interface/v1/) for return shapes and examples.
