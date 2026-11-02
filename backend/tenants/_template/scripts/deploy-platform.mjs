#!/usr/bin/env node
/**
 * Deploy Tealfabric App Model to a TealFabric tenant:
 * - Create/update ProcessFlow processes + steps
 * - Create/publish WebApp shell
 * - Upload frontend dist to CDN/app-model/
 *
 * Env:
 *   TEALFABRIC_API_KEY (required)
 *   TEALFABRIC_API_URL (default https://dev.tealfabric.io)
 *   TEALFABRIC_TENANT_ID (optional)
 *   TEALFABRIC_WEBAPP_USER_ID (platform user for webapp execution context)
 *   EXAMPLE_INTEGRATION_ID (optional)
 */

import { readFile, readdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TENANT_DIR = join(__dirname, "..");
const REPO_ROOT = join(TENANT_DIR, "../../..");
const FE_DIST = join(REPO_ROOT, "frontend/dist");
const IDS_PATH = join(TENANT_DIR, "platform-ids.generated.json");
const INTEGRATION_PATH = join(TENANT_DIR, "config/integration.json");
const DEFAULTS_PATH = join(TENANT_DIR, "config/defaults.json");
const HELPERS_PATH = join(TENANT_DIR, "lib/app-helpers.ts");

const baseUrl = (process.env.TEALFABRIC_API_URL || "https://dev.tealfabric.io").replace(/\/$/, "");
const apiKey = process.env.TEALFABRIC_API_KEY;
const tenantId = process.env.TEALFABRIC_TENANT_ID || "";
const WEBAPP_USER_ID = process.env.TEALFABRIC_WEBAPP_USER_ID || "";
const exampleIntegrationId = process.env.EXAMPLE_INTEGRATION_ID || "";

async function loadDefaults() {
  try {
    return JSON.parse(await readFile(DEFAULTS_PATH, "utf8"));
  } catch {
    return {};
  }
}

/** CSP for CDN-loaded shell WebApps */
function buildShellSecurityPolicy(defaults = {}) {
  const connect = new Set(["'self'", "https://cdn.tealfabric.io"]);
  const extra = defaults.csp_connect_origins;
  if (Array.isArray(extra)) {
    for (const origin of extra) {
      if (typeof origin === "string" && origin.trim()) connect.add(origin.trim());
    }
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tealfabric.io",
    "style-src 'self' 'unsafe-inline' https://cdn.tealfabric.io",
    "font-src 'self' data: https://cdn.tealfabric.io",
    "img-src 'self' data: https:",
    `connect-src ${[...connect].join(" ")}`,
  ].join("; ") + ";";
}

async function loadIntegrationId() {
  if (exampleIntegrationId) return exampleIntegrationId;
  try {
    const cfg = JSON.parse(await readFile(INTEGRATION_PATH, "utf8"));
    return String(cfg.example_integration_id ?? "").trim();
  } catch {
    return "";
  }
}

if (!apiKey) {
  console.error("TEALFABRIC_API_KEY required");
  process.exit(1);
}

const PROCESSES = [
  { key: "auth_platform", name: "app-model-auth-platform", snippet: "01_auth_platform.ts" },
  { key: "list_items", name: "app-model-list-items", snippet: "02_list_items.ts" },
  { key: "create_item", name: "app-model-create-item", snippet: "03_create_item.ts" },
  { key: "list_files", name: "app-model-list-files", snippet: "04_list_files.ts" },
  { key: "upload_file", name: "app-model-upload-file", snippet: "05_upload_file.ts" },
  { key: "list_integrations", name: "app-model-list-integrations", snippet: "06_list_integrations.ts" },
  { key: "integration_status", name: "app-model-integration-status", snippet: "07_integration_status.ts" },
  { key: "router", name: "app-model-router", snippet: "00_router.ts" },
];

async function api(method, path, body) {
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  return json;
}

async function assembleSnippet(filename, deployedConfig = null) {
  const helpers = await readFile(HELPERS_PATH, "utf8");
  const body = await readFile(join(TENANT_DIR, "snippets", filename), "utf8");
  const configBlock =
    deployedConfig && Object.keys(deployedConfig).length
      ? `\nconst DEPLOYED_PROCESS_CONFIG = ${JSON.stringify(deployedConfig, null, 2)};\n`
      : "";
  return `${helpers}${configBlock}\n${body}`;
}

function extractFence(md, lang) {
  const re = new RegExp("```" + lang + "\\s*\\n([\\s\\S]*?)```", "m");
  const m = md.match(re);
  if (!m) throw new Error(`No \`\`\`${lang} block in markdown`);
  return m[1].trim();
}

async function uploadFile(localPath, destinationPath) {
  const fileBuffer = await readFile(localPath);
  const filename = localPath.split("/").pop();
  const form = new FormData();
  form.append("destination_path", destinationPath);
  form.append("file", new Blob([fileBuffer]), filename);
  const q = new URLSearchParams({ action: "upload" });
  if (tenantId) q.set("tenant_id", tenantId);
  const res = await fetch(`${baseUrl}/api/v1/documents?${q}`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`upload ${localPath}: ${res.status} ${text}`);
}

async function uploadDist(cdnPath) {
  const destBase = cdnPath.replace(/^\//, "");
  async function walk(dir, relPrefix = "") {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      const relPath = relPrefix ? `${relPrefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(full, relPath);
      else {
        const dest = relPath.includes("/")
          ? `${destBase}/${relPath.replace(/\/[^/]+$/, "")}`
          : destBase;
        await uploadFile(full, dest);
        console.log(`  uploaded ${relPath}`);
      }
    }
  }
  await walk(FE_DIST);
}

async function ensureProcess(def, deployedConfig) {
  let ids = {};
  try {
    ids = JSON.parse(await readFile(IDS_PATH, "utf8"));
  } catch {
    /* fresh */
  }
  let processId = ids.processes?.[def.key]?.processId ?? ids.processes?.[def.key]?.process_id;
  if (!processId) {
    const created = await api("POST", "/api/v1/processes?action=create", {
      name: def.name,
      description: `app-model ${def.key}`,
      type: "business",
      status: "active",
      category: "app-model",
    });
    processId = created.data?.process_id ?? created.process_id;
    console.log(`Created process ${def.name}: ${processId}`);
  }
  const steps = await api("GET", `/api/v1/processflow?action=steps&process_id=${encodeURIComponent(processId)}`);
  const stepList = steps.data?.steps ?? steps.steps ?? steps.data ?? [];
  const codeSnippet = await assembleSnippet(def.snippet, deployedConfig);
  let stepId;
  if (!Array.isArray(stepList) || stepList.length === 0) {
    const step = await api("POST", "/api/v1/processes?action=create-step", {
      process_id: processId,
      step_name: def.snippet.replace(".ts", ""),
      step_type: "action",
      code_snippet: codeSnippet,
      sequence: 1,
    });
    stepId = step.data?.step_id ?? step.step_id;
    console.log(`  created step ${stepId}`);
  } else {
    stepId = stepList[0].step_id;
    await api("PUT", "/api/v1/processes?action=update-step", {
      step_id: stepId,
      code_snippet: codeSnippet,
    });
    console.log(`  updated step ${stepId}`);
    await pruneDuplicateSteps(processId, stepId);
  }
  return { processId, stepId };
}

async function pruneDuplicateSteps(processId, keepStepId) {
  const steps = await api("GET", `/api/v1/processflow?action=steps&process_id=${encodeURIComponent(processId)}`);
  const stepList = steps.data?.steps ?? steps.steps ?? steps.data ?? [];
  if (!Array.isArray(stepList)) return;
  for (const step of stepList) {
    if (step.step_id && step.step_id !== keepStepId) {
      await api("DELETE", "/api/v1/processes?action=delete-step", { step_id: step.step_id });
      console.log(`  deleted duplicate step ${step.step_id}`);
    }
  }
}

async function main() {
  const skipBuild = process.argv.includes("--skip-build");
  const integrationId = await loadIntegrationId();
  const defaults = await loadDefaults();
  const cdnPath = defaults.cdn_path ?? "CDN/app-model";

  let existingIds = {};
  try {
    existingIds = JSON.parse(await readFile(IDS_PATH, "utf8"));
  } catch {
    /* fresh */
  }

  if (!skipBuild) {
    console.log("Building frontend...");
    execSync("npm run build", { cwd: join(REPO_ROOT, "frontend"), stdio: "inherit" });
  }

  const ids = { processes: {}, webapp_id: null, tenant_id: tenantId, updated_at: new Date().toISOString() };

  const handlerConfig = {
    example_integration_id: integrationId,
    public_uri_path: defaults.public_uri_path ?? "/app-model",
    platform_api_base_url: `${baseUrl}/api/v1`,
  };

  for (const def of PROCESSES.filter((p) => p.key !== "router")) {
    ids.processes[def.key] = await ensureProcess(def, handlerConfig);
  }

  const authProcessId = ids.processes.auth_platform.processId;
  const routeMap = {
    auth_login: authProcessId,
    auth_logout: authProcessId,
    auth_bootstrap: authProcessId,
    auth_session: authProcessId,
    list_items: ids.processes.list_items.processId,
    create_item: ids.processes.create_item.processId,
    list_files: ids.processes.list_files.processId,
    upload_file: ids.processes.upload_file.processId,
    list_integrations: ids.processes.list_integrations.processId,
    integration_status: ids.processes.integration_status.processId,
  };

  const deployedConfig = { ...handlerConfig, route_map: routeMap };
  ids.processes.router = await ensureProcess(
    PROCESSES.find((p) => p.key === "router"),
    deployedConfig
  );

  await api("PUT", "/api/v1/processes?action=update", {
    process_id: ids.processes.router.processId,
    configuration: {
      route_map: routeMap,
      example_integration_id: integrationId,
      platform_api_base_url: handlerConfig.platform_api_base_url,
    },
  });

  const webappMd = await readFile(join(TENANT_DIR, "WEBAPP.md"), "utf8");
  const pageContent = extractFence(webappMd, "html");
  let customJs = extractFence(webappMd, "javascript");
  const cdnTenant = tenantId || "TENANT_ID";
  customJs = customJs.replace(/TENANT_ID/g, cdnTenant.replace(/^\//, ""));

  const list = await api("GET", "/api/v1/webapps?search=app-model&limit=5");
  const existing = (list.webapps ?? list.data?.webapps ?? []).find((w) => w.name === "app-model");
  const webappPayload = {
    page_content: pageContent,
    custom_js: customJs,
    process_id: ids.processes.router.processId,
    custom_security_policy: buildShellSecurityPolicy(defaults),
    // SPA uses Authorization: Bearer webapp_access JWTs (not HttpOnly cookie rewrite).
    auth_transport: "bearer",
    auth_require: false,
  };
  if (WEBAPP_USER_ID) webappPayload.webapp_user_id = WEBAPP_USER_ID;

  if (existing?.webapp_id) {
    await api("PUT", `/api/v1/webapps/${existing.webapp_id}`, webappPayload);
    ids.webapp_id = existing.webapp_id;
    await api("POST", `/api/v1/webapps/${existing.webapp_id}/publish`, { version: 1 });
  } else {
    const created = await api("POST", "/api/v1/webapps", {
      name: "app-model",
      description: "App Model reference app — ProcessFlow BFF + CDN React SPA",
      type: "webapp",
      ...webappPayload,
    });
    ids.webapp_id = created.webapp_id ?? created.data?.webapp_id;
    await api("POST", `/api/v1/webapps/${ids.webapp_id}/publish`, { version: 1 });
  }

  console.log("Uploading CDN assets...");
  await uploadDist(cdnPath);

  await writeFile(
    IDS_PATH,
    JSON.stringify(
      {
        ...existingIds,
        ...ids,
        example_integration_id: integrationId,
        published_url: `${baseUrl}${defaults.public_uri_path ?? "/app-model"}`,
        updated_at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log("Done.", IDS_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
