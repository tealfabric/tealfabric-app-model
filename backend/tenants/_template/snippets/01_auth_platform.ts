/**
 * app-model-auth-platform — platform credential check for WebApp JWT login.
 * Verifies email/password via product /auth/login. The router (WebApp entry)
 * then calls jwt.issueWebappAccess — nested processes lack webapp_id context.
 * Capabilities: api, logging
 */

const { action, payload } = parseBffEnvelope(process_input as Record<string, unknown>);
const apiBase = getPlatformApiBaseUrl();
if (!apiBase) {
  return appError("CONFIG_ERROR", "platform_api_base_url/app_url is not configured");
}

const authBase = `${apiBase}/auth`;

function platformAuthBody(result: Record<string, unknown>): Record<string, unknown> {
  return parseConfigRecord(result.data ?? result);
}

function platformAuthFailed(result: Record<string, unknown>, fallback: string): AppError {
  const body = platformAuthBody(result);
  return appError(
    String(body.error_code ?? result.error_code ?? "AUTH_FAILED"),
    String(body.message ?? result.message ?? fallback)
  );
}

if (action === "auth_login") {
  const email = String(payload.email ?? "").trim();
  const password = String(payload.password ?? "");
  if (!email || !password) {
    return appError("VALIDATION_ERROR", "email and password are required");
  }

  // Credential check only — do not use product tokens as the WebApp session.
  const result = (await api.post(`${authBase}/login`, { email, password })) as Record<
    string,
    unknown
  >;
  const body = platformAuthBody(result);
  if (result.success === false || body.success === false) {
    return platformAuthFailed(result, "Login failed");
  }

  const data =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : body;

  const productAccess = String(data.access_token ?? data.accessToken ?? "").trim();
  const productClaims = productAccess ? parseJwtPayload(productAccess) : null;
  const userId = String(
    data.user_id ?? data.id ?? productClaims?.sub ?? productClaims?.user_id ?? ""
  ).trim();
  const userEmail = String(data.email ?? productClaims?.email ?? email).trim();
  const role = String(
    data.role ?? data.global_role ?? productClaims?.role ?? productClaims?.global_role ?? "user"
  ).trim();
  const fullName = data.full_name ?? productClaims?.full_name;

  if (!userId) {
    return appError("AUTH_FAILED", "Login response missing user id");
  }

  const roleCheck = rejectAdminRole(role);
  if (!roleCheck.ok) return roleCheck.response;

  return {
    success: true,
    issue_webapp_access: true,
    data: {
      authenticated: true,
      user_id: userId,
      email: userEmail,
      full_name: fullName,
      role,
    },
  };
}

if (action === "auth_logout") {
  return {
    success: true,
    clear_auth_cookie: true,
    data: { logged_out: true },
  };
}

if (action === "auth_bootstrap" || action === "auth_session") {
  const session = await requireAppSession();
  if (!session.ok) {
    return session.response;
  }

  const user = session.user;
  return {
    success: true,
    data: {
      user_id: String(user.user_id ?? ""),
      email: String(user.email ?? ""),
      full_name: user.full_name,
      role: String(user.role ?? "user"),
      tenant_id: user.tenant_id ? String(user.tenant_id) : undefined,
    },
  };
}

return appError("INVALID_ACTION", "Unsupported auth action", action);
