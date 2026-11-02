/**
 * In-memory (+ sessionStorage) store for WebApp `webapp_access` JWTs.
 * Prefer not to use localStorage (XSS-readable). sessionStorage is tab-scoped.
 */

const ACCESS_TOKEN_KEY = "tf_webapp_access_token";

let memoryToken: string | null = null;

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (memoryToken?.trim()) return memoryToken;
  if (!hasWindow()) return null;
  try {
    const fromSession = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (fromSession?.trim()) {
      memoryToken = fromSession.trim();
      return memoryToken;
    }
  } catch {
    // ignore
  }
  return null;
}

export function setAccessToken(token: string): void {
  const trimmed = String(token ?? "").trim();
  memoryToken = trimmed || null;
  if (!hasWindow()) return;
  try {
    if (trimmed) window.sessionStorage.setItem(ACCESS_TOKEN_KEY, trimmed);
    else window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function clearAccessToken(): void {
  memoryToken = null;
  if (!hasWindow()) return;
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // ignore
  }
}

const SESSION_EXPIRED_EVENT = "tf-webapp-session-expired";

export function notifySessionExpired(): void {
  clearAccessToken();
  if (!hasWindow()) return;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function onSessionExpired(handler: () => void): () => void {
  if (!hasWindow()) return () => undefined;
  const listener = () => handler();
  window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
}

function isWebappJwt(value: unknown): value is string {
  return typeof value === "string" && value.trim().split(".").length === 3;
}

export function accessTokenFromAuthBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const queue: unknown[] = [body];
  let visited = 0;
  while (queue.length > 0 && visited < 40) {
    const node = queue.shift();
    visited += 1;
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    const row = node as Record<string, unknown>;
    // Prefer webapp_access: ProcessFlow redacts access_token in the live envelope.
    for (const key of ["webapp_access", "access_token", "accessToken", "token"]) {
      const token = row[key];
      if (isWebappJwt(token)) return token.trim();
    }
    for (const key of ["data", "result", "output", "output_data"]) {
      if (row[key] && typeof row[key] === "object") queue.push(row[key]);
    }
    if (typeof row.body === "string" && row.body.trim()) {
      try {
        queue.push(JSON.parse(row.body));
      } catch {
        // ignore
      }
    }
  }
  return null;
}
