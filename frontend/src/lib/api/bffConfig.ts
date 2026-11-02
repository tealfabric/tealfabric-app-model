/**
 * WebApp shell path helpers.
 * BFF POSTs must hit the WebApp root (callback URL), never nested SPA routes
 * like `/login` — otherwise the runtime sees `/webapp-runtime/{id}/login` (404).
 */

export function resolveRouterBasename(defaultPath = "/app-model"): string {
  const configured = String(import.meta.env.VITE_ROUTER_BASENAME ?? "")
    .trim()
    .replace(/\/$/, "");
  if (typeof window === "undefined") {
    return configured || defaultPath;
  }

  const path = window.location.pathname;
  if (configured && (path === configured || path.startsWith(`${configured}/`))) {
    return configured;
  }

  const segment = path.split("/").filter(Boolean)[0];
  if (segment) return `/${segment}`;
  return configured || "/";
}

/** Same-origin WebApp callback URL (no nested React Router paths). */
export function getBffBaseUrl(defaultPath = "/app-model"): string {
  const fromEnv = String(import.meta.env.VITE_BFF_URL ?? "").trim();
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocalDev && fromEnv) return fromEnv.replace(/\/$/, "");

    const basename = resolveRouterBasename(defaultPath);
    if (basename === "/") return window.location.origin;
    return `${window.location.origin}${basename}`;
  }

  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "";
}
