import type { PlatformUser } from "../api/types";
import { getBffBaseUrl } from "../api/bffConfig";
import {
  accessTokenFromAuthBody,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "./tokenStore";

type BffAuthWrapper = {
  success?: boolean;
  result?: Record<string, unknown>;
  access_token?: string;
  errors?: string[];
  error?: { code?: string; message?: string };
};

function extractNestedProcessError(message: string): string {
  const match = message.match(/failed:\s*([^]+?)(?:\s+Support reference:|$)/i);
  if (!match?.[1]) return message;
  const inner = match[1].trim();
  const nested = inner.match(/failed:\s*([^]+?)(?:\s+Support reference:|$)/i);
  return (nested?.[1] ?? inner).trim();
}

function getBffBase(): string {
  return getBffBaseUrl("/app-model");
}

export function getPlatformOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function unwrapBffAuthData(json: BffAuthWrapper): Record<string, unknown> | null {
  const queue: unknown[] = [json, json.result];
  let visited = 0;

  while (queue.length > 0 && visited < 40) {
    const node = queue.shift();
    visited += 1;
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    const row = node as Record<string, unknown>;

    if (typeof row.body === "string" && row.body.trim()) {
      try {
        queue.push(JSON.parse(row.body));
      } catch {
        // ignore
      }
    }

    const hasUser =
      Boolean(String(row.user_id ?? row.id ?? "").trim()) ||
      Boolean(String(row.email ?? "").trim());
    const hasToken =
      typeof row.webapp_access === "string" ||
      typeof row.access_token === "string" ||
      typeof row.accessToken === "string" ||
      row.logged_out === true;

    if (hasUser || hasToken) {
      if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
        return { ...row, ...(row.data as Record<string, unknown>) };
      }
      return row;
    }

    for (const key of ["data", "output", "output_data", "result"]) {
      if (row[key] && typeof row[key] === "object") queue.push(row[key]);
    }
  }

  return null;
}

function bffAuthError(json: BffAuthWrapper, fallback: string): string {
  if (json.error?.message) return json.error.message;
  if (Array.isArray(json.errors) && json.errors[0]) {
    return extractNestedProcessError(json.errors[0]);
  }
  return fallback;
}

async function callAuthBff(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<{ ok: true; data: Record<string, unknown>; raw: BffAuthWrapper } | { ok: false; message: string }> {
  const base = getBffBase();
  if (!base) return { ok: false, message: "BFF URL is not configured" };

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, payload }),
  });

  const json = await parseJson<BffAuthWrapper>(response);
  if (json.success === false) {
    return { ok: false, message: bffAuthError(json, "Authentication request failed") };
  }

  const data = unwrapBffAuthData(json);
  if (!data) {
    return { ok: false, message: bffAuthError(json, "Authentication request failed") };
  }

  if (data.success === false) {
    const err = data.error as { message?: string } | undefined;
    return { ok: false, message: err?.message ?? "Authentication request failed" };
  }

  return { ok: true, data, raw: json };
}

function userFromBootstrapData(data: Record<string, unknown>): PlatformUser | null {
  const userId = String(data.user_id ?? data.id ?? "").trim();
  const email = String(data.email ?? "").trim();
  if (!userId && !email) return null;

  return {
    user_id: userId,
    email,
    full_name: typeof data.full_name === "string" ? data.full_name : undefined,
    role: String(data.role ?? data.global_role ?? "user"),
    tenant_id: data.tenant_id ? String(data.tenant_id) : undefined,
  };
}

export async function platformLogin(
  email: string,
  password: string
): Promise<{ ok: true; user: PlatformUser } | { ok: false; message: string }> {
  const result = await callAuthBff("auth_login", { email, password });
  if (!result.ok) return { ok: false, message: result.message };

  const token = accessTokenFromAuthBody(result.raw) ?? accessTokenFromAuthBody(result.data);
  if (!token) {
    return { ok: false, message: "Login response missing access_token" };
  }
  setAccessToken(token);

  const user = userFromBootstrapData(result.data);
  if (user) return { ok: true, user };

  const bootstrapped = await platformBootstrap();
  if (!bootstrapped) {
    clearAccessToken();
    return { ok: false, message: "Login succeeded but session bootstrap failed" };
  }
  return { ok: true, user: bootstrapped };
}

export async function platformLogout(): Promise<void> {
  await callAuthBff("auth_logout").catch(() => undefined);
  clearAccessToken();
}

export async function platformBootstrap(): Promise<PlatformUser | null> {
  if (!getAccessToken()) return null;

  const result = await callAuthBff("auth_bootstrap");
  if (!result.ok) {
    clearAccessToken();
    return null;
  }
  return userFromBootstrapData(result.data);
}

export { getAccessToken };
