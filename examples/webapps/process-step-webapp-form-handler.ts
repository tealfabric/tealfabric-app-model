/**
 * WebApp → ProcessFlow form handler (interface v1.0.4)
 *
 * Attach this step as the first (or only) step of a process linked to a
 * published WebApp of type `webapp`. The browser POSTs a form/JSON body;
 * the runtime flattens that body into `process_input` and injects HTTP
 * sandbox globals beside it.
 *
 * ---------------------------------------------------------------------------
 * INBOUND ENVELOPE (what this step sees)
 * ---------------------------------------------------------------------------
 *
 * A) process_input  — flat map of submitted fields + optional auth / uploads
 *    {
 *      // Form / JSON fields (same names as the browser sent):
 *      email: string,
 *      name: string,
 *      message?: string,
 *
 *      // When WebApp auth_require verified a webapp_access JWT:
 *      auth_token?: string,
 *      auth?: {
 *        user_id: string,
 *        email: string,
 *        role: string,
 *        webapp_id: string,
 *        type: "webapp_access"
 *      },
 *
 *      // Uploads / correlation (when present):
 *      _attachments?: unknown[],
 *      _storage_path?: string | null,
 *      _execution_id?: string
 *    }
 *
 * B) Sandbox HTTP globals (NOT nested under process_input):
 *    raw_input          — raw body string (signature verification)
 *    http_headers       — request headers
 *    request_method     — "POST" (typical for HTML webapps)
 *    request_uri        — path (+ query when present)
 *    remote_addr        — client IP
 *    webapp_tenant_id   — tenant for this WebApp host
 *    app_url, tenant_id, user_id, process_id, process_execution_id, …
 *
 * Note: `user_id` is the WebApp service account (webapp_user_id).
 * End-user identity is in process_input.auth when auth is enabled.
 *
 * Capabilities: logging (optional: data-access, notification, api)
 */

type WebAppAuth = {
  user_id?: string;
  email?: string;
  role?: string;
  webapp_id?: string;
  type?: string;
};

const email = String(process_input.email ?? "").trim();
const name = String(process_input.name ?? "").trim();
const message = String(process_input.message ?? "").trim();
const auth = process_input.auth as WebAppAuth | undefined;

// --- Sandbox envelope (HTTP metadata) ---
const method = String(typeof request_method !== "undefined" ? request_method : "");
const uri = String(typeof request_uri !== "undefined" ? request_uri : "");
const clientIp = String(typeof remote_addr !== "undefined" ? remote_addr : "");
const contentType =
  typeof http_headers !== "undefined"
    ? String((http_headers as Record<string, string>)["Content-Type"] ?? (http_headers as Record<string, string>)["content-type"] ?? "")
    : "";
const rawBody =
  typeof raw_input !== "undefined" && raw_input != null ? String(raw_input) : "";

tf.log("info", "WebApp form received", {
  method,
  uri,
  client_ip: clientIp,
  content_type: contentType,
  has_auth: Boolean(auth?.user_id),
  raw_body_bytes: rawBody.length,
  execution_id: process_execution_id,
});

if (!email) {
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "email is required",
      details: "Submit field `email` in the WebApp form or JSON body",
    },
    data: null,
  };
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return {
    success: false,
    error: {
      code: "INVALID_EMAIL",
      message: "Invalid email format",
    },
    data: null,
  };
}

// Optional: require a signed-in end user when the WebApp has auth_require
// if (!auth?.user_id) {
//   return {
//     success: false,
//     error: { code: "UNAUTHORIZED", message: "End-user auth required" },
//     data: null,
//   };
// }

// Optional: authorize by role from process_input.auth (not execution user_id)
// if (auth?.role !== "tenant_admin") {
//   return {
//     success: false,
//     error: { code: "FORBIDDEN", message: "Admin role required" },
//     data: null,
//   };
// }

return {
  success: true,
  data: {
    // Business payload → next step / WebApp result.output_data
    received: {
      email,
      name: name || null,
      message: message || null,
    },
    // Echo envelope for debugging (trim in production)
    envelope: {
      process_input_keys: Object.keys(process_input ?? {}),
      auth_user_id: auth?.user_id ?? null,
      auth_role: auth?.role ?? null,
      request_method: method || null,
      request_uri: uri || null,
      remote_addr: clientIp || null,
      webapp_tenant_id:
        typeof webapp_tenant_id !== "undefined" ? String(webapp_tenant_id) : null,
      tenant_id: typeof tenant_id !== "undefined" ? String(tenant_id) : null,
      // Execution identity = WebApp service account, not end user
      execution_user_id: typeof user_id !== "undefined" ? String(user_id) : null,
      process_id: typeof process_id !== "undefined" ? String(process_id) : null,
      process_execution_id:
        typeof process_execution_id !== "undefined" ? String(process_execution_id) : null,
      has_raw_input: rawBody.length > 0,
      attachment_count: Array.isArray(process_input._attachments)
        ? process_input._attachments.length
        : 0,
    },
  },
  message: "WebApp submission accepted",
};
