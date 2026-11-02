import type { ApiResponse, BffAction } from "./types";
import { getAccessToken, notifySessionExpired } from "../auth/tokenStore";
import { getBffBaseUrl } from "./bffConfig";

const DEFAULT_TIMEOUT_MS = 30_000;

type WebappProcessWrapper = {
  success?: boolean;
  result?: {
    success?: boolean;
    data?: unknown;
    error?: { code?: string; message?: string; details?: string };
    body?: string;
    http_code?: number;
  };
  errors?: string[];
  error?: { code?: string; message?: string };
};

function normalizeApiError(error: unknown): { code: string; message: string } {
  if (error && typeof error === "object") {
    const e = error as { code?: string; message?: string };
    return {
      code: e.code ?? "UNKNOWN_ERROR",
      message: e.message ?? "Request failed",
    };
  }
  return { code: "UNKNOWN_ERROR", message: String(error ?? "Request failed") };
}

const PROCESS_META_KEYS = new Set([
  "action",
  "payload",
  "process_config",
  "request_headers",
  "sales_user",
  "app_user",
  "auth",
  "auth_token",
  "_execution_id",
  "execution_id",
  "process_id",
  "success",
  "message",
  "http_code",
  "body",
  "errors",
  "error",
  "execution_time_ms",
  "output_data",
  "output",
  "step_reports",
  "queue_id",
  "issue_webapp_access",
]);

function stripProcessMeta(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (PROCESS_META_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

const BUSINESS_KEYS = new Set([
  "icp",
  "icps",
  "contacts",
  "contact",
  "sources",
  "source",
  "activities",
  "activity",
  "candidates",
  "runs",
  "run",
  "settings",
  "items",
  "files",
  "integrations",
  "collected",
  "synced",
  "fetched",
  "enqueued",
  "emails_found",
  "phones_found",
  "forms_found",
]);

function hasBusinessKey(row: Record<string, unknown>): boolean {
  for (const key of BUSINESS_KEYS) {
    if (row[key] !== undefined) return true;
  }
  return false;
}

function unwrapHandlerPayload(root: unknown): unknown {
  const queue: unknown[] = [root];
  let visited = 0;
  while (queue.length > 0 && visited < 80) {
    const node = queue.shift();
    visited += 1;
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const item of node) queue.push(item);
      continue;
    }
    const row = node as Record<string, unknown>;

    if (row.success === true && row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
      const nested = row.data as Record<string, unknown>;
      if (hasBusinessKey(nested)) return nested;
    }

    if (hasBusinessKey(row)) return stripProcessMeta(row);

    for (const key of ["data", "value", "output_data", "result"]) {
      if (row[key] && typeof row[key] === "object") queue.push(row[key]);
    }
    if (Array.isArray(row.step_reports)) queue.push(row.step_reports);
  }
  return undefined;
}

function firstProcessError(errors: unknown): string {
  if (!Array.isArray(errors) || !errors[0]) return "";
  const raw = String(errors[0]);
  const match = raw.match(/failed:\s*([^]+?)(?:\s+Support reference:|$)/i);
  return (match?.[1] ?? raw).trim();
}

function unwrapWebappResponse<T>(json: WebappProcessWrapper & ApiResponse<T>): ApiResponse<T> {
  const result = json.result as Record<string, unknown> | undefined;
  if (result && typeof result.body === "string") {
    try {
      const parsed = JSON.parse(result.body) as ApiResponse<T>;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // fall through
    }
  }

  if (json.success === false) {
    const fromErrors = firstProcessError(json.errors);
    return {
      success: false,
      error: {
        code: json.error?.code ?? (fromErrors ? "PROCESS_ERROR" : "UNKNOWN_ERROR"),
        message: json.error?.message ?? (fromErrors || "Request failed"),
      },
    };
  }

  const payload = unwrapHandlerPayload(json);
  if (payload !== undefined) {
    return { success: true, data: payload as T };
  }

  if (result && result.error !== undefined) {
    return { success: false, error: normalizeApiError(result.error) };
  }
  if (json.data !== undefined) {
    return { success: true, data: json.data };
  }
  return json;
}

function isUnauthorized(
  raw: WebappProcessWrapper,
  json: ApiResponse<unknown>,
  status: number
): boolean {
  if (status === 401) return true;
  const parts: string[] = [];
  if (json.success === false) {
    parts.push(String(json.error?.code ?? ""));
    parts.push(String(json.error?.message ?? ""));
  }
  if (Array.isArray(raw.errors)) {
    for (const item of raw.errors) parts.push(String(item));
  }
  const text = parts.join(" ").toLowerCase();
  if (text.includes("authentication required")) return true;
  if (text.includes("invalid or expired token")) return true;
  const code = String(json.success === false ? json.error?.code ?? "" : "").toUpperCase();
  return code === "UNAUTHORIZED" || code === "AUTH_REQUIRED";
}

function getBffBase(): string {
  return getBffBaseUrl("/app-model");
}

function toEnvelope(request: BffAction): { action: string; payload: Record<string, unknown> } {
  const { action, ...fields } = request as { action: string } & Record<string, unknown>;
  return { action, payload: fields };
}

export async function callBff<T>(
  request: BffAction,
  options?: { signal?: AbortSignal }
): Promise<ApiResponse<T>> {
  const base = getBffBase();
  if (!base) {
    return {
      success: false,
      error: { code: "CONFIG_ERROR", message: "BFF URL is not configured" },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const signal = options?.signal ?? controller.signal;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify(toEnvelope(request)),
      signal,
    });

    const raw = (await response.json()) as WebappProcessWrapper & ApiResponse<T>;
    const json = unwrapWebappResponse<T>(raw);

    if (isUnauthorized(raw, json, response.status)) {
      notifySessionExpired();
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: ("error" in json && json.error?.message) || "Authentication required",
        },
      };
    }

    if (!response.ok || json.success === false) {
      const err = "error" in json ? json.error : undefined;
      return {
        success: false,
        error: {
          code: err?.code ?? "HTTP_ERROR",
          message: err?.message ?? `Request failed (${response.status})`,
        },
      };
    }

    return { success: true, data: json.data as T };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: { code: "NETWORK_ERROR", message },
    };
  } finally {
    clearTimeout(timeout);
  }
}
