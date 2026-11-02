/**
 * App Model — action router (WebApp BFF entry).
 * Capabilities: api, data-access, context, logging
 *
 * process_config (embedded at deploy as DEPLOYED_PROCESS_CONFIG):
 * {
 *   "route_map": { "list_items": "<uuid>", ... },
 *   "platform_api_base_url": "https://…/api/v1",
 *   "example_integration_id": "<uuid>"
 * }
 *
 * Auth: WebApp JWT Bearer (`webapp_access`) via Authorization header.
 * Runtime injects process_input.auth when the token is valid.
 * Regular users only — tenant_admins are rejected.
 */

const { action, payload } = parseBffEnvelope(process_input as Record<string, unknown>);
const cfg = resolveProcessConfig();
const routeMap = (cfg.route_map ?? {}) as Record<string, string>;

if (!action) {
  return appError("MISSING_ACTION", "action is required");
}

const session = await requireAppSession();
if (!isPublicAction(action)) {
  if (!session.ok) {
    return session.response;
  }
  tf.context.set("app.user", session.user);
} else if (session.ok) {
  tf.context.set("app.user", session.user);
}

const handlerProcessId = String(routeMap[action] ?? "").trim();
if (!handlerProcessId) {
  return appError("INVALID_ACTION", "Unsupported or unconfigured action", action);
}

if (action === "health" || action === "ping") {
  return {
    success: true,
    data: {
      status: "ok",
      app: "app-model",
      timestamp: tf.utils.nowIso(),
    },
  };
}

const base = String(app_url ?? "").replace(/\/$/, "");
const executeUrl = `${base}/api/v1/processflow?action=execute-process`;

const result = (await api.post(executeUrl, {
  process_id: handlerProcessId,
  input_data: {
    ...payload,
    action,
    payload,
    process_config: cfg,
    request_headers: getRequestHeaders(),
    auth: process_input.auth,
    auth_token: process_input.auth_token,
    app_user: tf.context.get("app.user") ?? undefined,
  },
  async: false,
})) as Record<string, unknown>;

if (!result.success) {
  return appError(
    "HANDLER_FAILED",
    "Handler process execution failed",
    String(result.status_code ?? result.message ?? "")
  );
}

const handlerOutput = extractHandlerOutput(result);
if (action === "auth_login" && handlerOutput.success !== false) {
  return attachWebappAccessToken(handlerOutput);
}
if (typeof handlerOutput.success === "boolean") {
  return handlerOutput;
}
return handlerOutput;
