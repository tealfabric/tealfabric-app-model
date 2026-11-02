/**
 * Shared helpers for tealfabric-app-model process steps.
 * Deploy script concatenates this file before each handler snippet.
 *
 * Sandbox capabilities used across handlers:
 *   api, data-access, connector, file, context, logging
 */

const DATAPOOL_SCHEMA = "app_model_items";
const FILES_PREFIX = "app-model/uploads";

/** Injected at deploy time by deploy-platform.mjs */
declare const DEPLOYED_PROCESS_CONFIG: Record<string, unknown> | undefined;

/** Present on WebApp-entry processes (router); not inherited by subprocesses. */
declare const http_headers: Record<string, string> | undefined;

/** Platform sandbox JWT helpers (webapp_access issue/verify). */
declare const jwt: {
  issueWebappAccess: (input: {
    user_id: string;
    email?: string;
    role?: string;
    expires_in?: string;
  }) => { access_token: string; expires_at: string; token_type: string };
  verify: (token: string) => Record<string, unknown>;
  decodePayload?: (token: string) => Record<string, unknown> | null;
};

type AppError = {
  success: false;
  error: { code: string; message: string; details?: string };
  data: null;
};

type AppSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

function appError(code: string, message: string, details = ""): AppError {
  return {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    data: null,
  };
}

function parseConfigRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function resolveProcessConfig(): Record<string, unknown> {
  const deployed =
    typeof DEPLOYED_PROCESS_CONFIG !== "undefined"
      ? parseConfigRecord(DEPLOYED_PROCESS_CONFIG)
      : {};
  const fromInput = parseConfigRecord(
    process_input.process_config ?? process_input.configuration
  );
  return { ...deployed, ...fromInput };
}

function mergeRequestBody(input: Record<string, unknown>): Record<string, unknown> {
  const raw = input.request_body;
  if (typeof raw !== "string" || !raw.trim()) return input;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return input;
    return { ...input, ...(parsed as Record<string, unknown>) };
  } catch {
    return input;
  }
}

/**
 * Support AGENTS.md `{ action, payload }` and legacy flat `{ action, ...fields }`.
 * Nested payload wins on key conflicts.
 */
function parseBffEnvelope(input: Record<string, unknown>): {
  action: string;
  payload: Record<string, unknown>;
  raw: Record<string, unknown>;
} {
  const raw = mergeRequestBody(input);
  const action = String(raw.action ?? "").trim();
  const nested = parseConfigRecord(raw.payload);
  const reserved = new Set([
    "action",
    "payload",
    "process_config",
    "configuration",
    "request_headers",
    "request_body",
    "headers",
    "http_headers",
    "cookie",
    "Cookie",
    "app_user",
    "sales_user",
  ]);
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (reserved.has(key)) continue;
    flat[key] = value;
  }
  return { action, payload: { ...flat, ...nested }, raw };
}

function extractHandlerOutput(apiResult: Record<string, unknown>): Record<string, unknown> {
  const data = parseConfigRecord(apiResult.data);
  const candidates: unknown[] = [
    data.result,
    data.output_data,
    data,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const row = candidate as Record<string, unknown>;
    if ("success" in row || "error" in row || "data" in row) return row;
  }
  return data;
}

function getRequestHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  const sources: unknown[] = [
    typeof http_headers !== "undefined" ? http_headers : undefined,
    process_input.request_headers,
    process_input.headers,
    process_input.http_headers,
  ];

  for (const raw of sources) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      out[String(key)] = String(value);
    }
  }

  return out;
}

function getAuthorizationHeader(): string {
  const headers = getRequestHeaders();
  const auth =
    headers.Authorization ?? headers.authorization ?? headers.AUTHORIZATION ?? "";
  if (String(auth).trim()) return String(auth).trim();

  const runtimeToken = String(process_input.auth_token ?? "").trim();
  if (runtimeToken) {
    return /^Bearer\s+/i.test(runtimeToken) ? runtimeToken : `Bearer ${runtimeToken}`;
  }

  const { payload } = parseBffEnvelope(process_input as Record<string, unknown>);
  const token = String(payload.access_token ?? payload.accessToken ?? "").trim();
  if (!token) return "";
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
}

function rejectAdminRole(
  role: string
): { ok: true } | { ok: false; response: AppError } {
  const normalized = String(role ?? "user").trim();
  if (normalized === "tenant_admin" || normalized === "admin" || normalized === "super_admin") {
    return {
      ok: false,
      response: appError(
        "FORBIDDEN",
        "This application is for regular platform users only",
        `role=${normalized}`
      ),
    };
  }
  return { ok: true };
}

/** End-user principal injected by WebApp runtime after verifying `webapp_access`. */
function getRuntimeAuthUser(): Record<string, unknown> | null {
  const auth = process_input.auth;
  if (!auth || typeof auth !== "object" || Array.isArray(auth)) return null;
  const row = auth as Record<string, unknown>;
  const userId = String(row.user_id ?? row.sub ?? "").trim();
  const email = String(row.email ?? "").trim();
  if (!userId && !email) return null;
  return {
    user_id: userId,
    email,
    role: String(row.role ?? "user"),
    webapp_id: row.webapp_id ? String(row.webapp_id) : undefined,
  };
}

function getPlatformApiBaseUrl(): string {
  const cfg = resolveProcessConfig();
  const configured = String(cfg.platform_api_base_url ?? cfg.platform_api_base ?? "").trim();
  if (configured) return configured.replace(/\/$/, "");
  const base = String(app_url ?? "").replace(/\/$/, "");
  return base ? `${base}/api/v1` : "";
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = String(token ?? "").split(".");
  if (parts.length < 2) return null;
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  try {
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Resolve end-user from WebApp JWT auth.
 * Prefer `app_user` (router → handler), then runtime `process_input.auth`,
 * then `jwt.verify` of `auth_token` / Bearer.
 */
async function requireAppSession(): Promise<
  | { ok: true; user: Record<string, unknown> }
  | { ok: false; response: AppError }
> {
  const fromInput = process_input.app_user;
  if (fromInput && typeof fromInput === "object" && !Array.isArray(fromInput)) {
    const user = fromInput as Record<string, unknown>;
    if (String(user.user_id ?? user.id ?? "").trim() || String(user.email ?? "").trim()) {
      const roleCheck = rejectAdminRole(String(user.role ?? "user"));
      if (!roleCheck.ok) return roleCheck;
      return { ok: true, user };
    }
  }

  const runtimeUser = getRuntimeAuthUser();
  if (runtimeUser) {
    const roleCheck = rejectAdminRole(String(runtimeUser.role ?? "user"));
    if (!roleCheck.ok) return roleCheck;
    return { ok: true, user: runtimeUser };
  }

  const token = String(getAuthorizationHeader()).replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { ok: false, response: appError("UNAUTHORIZED", "Authentication required") };
  }

  if (typeof jwt === "undefined" || typeof jwt.verify !== "function") {
    return { ok: false, response: appError("UNAUTHORIZED", "Invalid or expired token") };
  }

  try {
    const verified = jwt.verify(token);
    const role = String(verified.role ?? "user");
    const roleCheck = rejectAdminRole(role);
    if (!roleCheck.ok) return roleCheck;
    return {
      ok: true,
      user: {
        user_id: String(verified.user_id ?? verified.sub ?? ""),
        email: String(verified.email ?? ""),
        role,
        webapp_id: verified.webapp_id ? String(verified.webapp_id) : undefined,
        tenant_id: verified.tenantId ? String(verified.tenantId) : undefined,
      },
    };
  } catch {
    return { ok: false, response: appError("UNAUTHORIZED", "Invalid or expired token") };
  }
}

/** @deprecated Prefer requireAppSession — kept as alias for existing handlers. */
async function requirePlatformBearer(): Promise<
  | { ok: true; user: Record<string, unknown> }
  | { ok: false; response: AppError }
> {
  return requireAppSession();
}

/**
 * Mint `webapp_access` on the WebApp entry process (router). Nested handler
 * executions do not receive `context.webapp_id`, so jwt.issueWebappAccess fails there.
 */
function findLoginPrincipal(root: unknown): Record<string, unknown> | null {
  const queue: unknown[] = [root];
  let visited = 0;
  while (queue.length > 0 && visited < 40) {
    const node = queue.shift();
    visited += 1;
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    const row = node as Record<string, unknown>;
    const userId = String(row.user_id ?? row.id ?? "").trim();
    if (userId && row.authenticated === true) {
      return row;
    }
    for (const key of ["data", "result", "output", "output_data"]) {
      if (row[key]) queue.push(row[key]);
    }
  }
  return null;
}

function attachWebappAccessToken(output: Record<string, unknown>): Record<string, unknown> {
  const principal = findLoginPrincipal(output);
  const userId = String(principal?.user_id ?? principal?.id ?? "").trim();
  const email = String(principal?.email ?? "").trim();
  const role = String(principal?.role ?? "user").trim();
  if (!userId) {
    return appError("AUTH_FAILED", "Login response missing user id");
  }
  if (typeof jwt === "undefined" || typeof jwt.issueWebappAccess !== "function") {
    return appError("CONFIG_ERROR", "jwt.issueWebappAccess is not available in this sandbox");
  }
  try {
    const issued = jwt.issueWebappAccess({ user_id: userId, email, role });
    const body = {
      success: true,
      access_token: issued.access_token,
      webapp_access: issued.access_token,
      token_type: issued.token_type || "Bearer",
      expires_at: issued.expires_at,
      data: {
        authenticated: true,
        user_id: userId,
        email,
        full_name: principal?.full_name,
        role,
        access_token: issued.access_token,
        webapp_access: issued.access_token,
        token_type: issued.token_type || "Bearer",
        expires_at: issued.expires_at,
      },
    };
    return body;
  } catch (err) {
    return appError(
      "CONFIG_ERROR",
      "jwt.issueWebappAccess failed",
      String(err instanceof Error ? err.message : err)
    );
  }
}

function isPublicAction(action: string): boolean {
  return [
    "health",
    "ping",
    "auth_login",
    "auth_logout",
    "auth_bootstrap",
    "auth_session",
  ].includes(action);
}

function resolveIntegrationId(): string {
  const cfg = resolveProcessConfig();
  return String(
    process_input.integration_id ?? cfg.example_integration_id ?? ""
  ).trim();
}
