/**
 * WebApp API router — JWT validation, endpoint allowlist, request proxy.
 *
 * Process configuration (Processes.configuration JSON):
 * {
 *   "allowed_endpoints": ["/api/v1/document-reviews/*"],
 *   "token_types": ["document_review"],
 *   "rate_limit": { "requests_per_minute": 60 }
 * }
 *
 * Capabilities: api, context (jwt service injected when configured)
 */
const requestUri = String(process_input.request_uri ?? "");
const method = String(process_input.request_method ?? "GET");
const headers = (process_input.request_headers ?? {}) as Record<string, string>;
const body = process_input.request_body ?? "";
const token = String(process_input.token ?? "");

const processConfig = (process_input.process_config ?? {}) as {
  allowed_endpoints?: string[];
  token_types?: string[];
};
const allowedEndpoints = processConfig.allowed_endpoints ?? [];
const allowedTokenTypes = processConfig.token_types ?? ["document_review"];

function jsonError(httpCode: number, error: string, extra?: Record<string, unknown>) {
  return {
    success: false,
    http_code: httpCode,
    body: JSON.stringify({ success: false, error, ...extra }),
    headers: { "Content-Type": "application/json" },
    data: null,
  };
}

function matchPattern(pattern: string, uri: string): boolean {
  const regex = new RegExp(
    `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`
  );
  return regex.test(uri);
}

if (!token) {
  return jsonError(401, "Missing authentication token");
}

if (typeof jwt === "undefined" || !jwt) {
  return jsonError(500, "JWT validation service not available");
}

const payload = await jwt.validateAccessToken(token);
if (!payload) {
  return jsonError(401, "Invalid or expired token");
}

const tokenType = (payload as Record<string, unknown>).type;
if (!allowedTokenTypes.includes(String(tokenType))) {
  return jsonError(403, "Token type not allowed for this endpoint", {
    token_type: tokenType,
    allowed_types: allowedTokenTypes,
  });
}

const isAllowed = allowedEndpoints.some((pattern) => matchPattern(pattern, requestUri));
if (!isAllowed) {
  return jsonError(403, "Endpoint not allowed", {
    requested_endpoint: requestUri,
    allowed_patterns: allowedEndpoints,
  });
}

const baseUrl = String(app_url ?? "https://dev.tealfabric.io").replace(/\/$/, "");
let apiUrl = `${baseUrl}${requestUri}`;
if (process_input.query_string) {
  apiUrl += `?${process_input.query_string}`;
}

const apiHeaders: Record<string, string> = {};
for (const [name, value] of Object.entries(headers)) {
  const lower = name.toLowerCase();
  if (["content-type", "authorization", "accept", "x-requested-with"].includes(lower)) {
    apiHeaders[name] = value;
  }
}

apiHeaders["X-Tenant-ID"] = String(tenant_id);
if (process_input.webapp_id) {
  apiHeaders["X-WebApp-ID"] = String(process_input.webapp_id);
}

const apiResponse =
  method.toUpperCase() === "GET"
    ? await api.get(apiUrl, apiHeaders)
    : await api.post(apiUrl, body, apiHeaders);

const httpCode = apiResponse.status_code ?? 200;
const responseBody = String(
  (apiResponse as { body?: string; raw_response?: string }).body ??
    (apiResponse as { raw_response?: string }).raw_response ??
    JSON.stringify(apiResponse.data ?? {})
);

let responseHeaders = (apiResponse as { headers?: Record<string, string> }).headers ?? {};
if (typeof responseHeaders !== "object" || Array.isArray(responseHeaders)) {
  responseHeaders = { "Content-Type": "application/json" };
}
if (!responseHeaders["Content-Type"] && !responseHeaders["content-type"]) {
  responseHeaders["Content-Type"] = "application/json";
}

const authPayload: Record<string, unknown> = {};
try {
  const decoded = JSON.parse(responseBody) as Record<string, unknown>;
  for (const field of [
    "session_token",
    "token",
    "access_token",
    "expires_at",
    "cookie_name",
    "cookie_path",
    "cookie_domain",
    "cookie_secure",
    "cookie_httponly",
    "cookie_samesite",
  ]) {
    if (field in decoded) {
      authPayload[field] = decoded[field];
    }
  }
} catch {
  // body is not JSON — skip auth field extraction
}

return {
  success: true,
  http_code: httpCode,
  headers: responseHeaders,
  body: responseBody,
  data: authPayload,
};
