/**
 * ProcessFlow step snippet prototype — TypeScript (interface v1.0.4, new-sandbox)
 *
 * INSTRUCTIONS FOR AGENTS
 * =======================
 * 1. Return { success, data, error?, message? } — never rely on console.log for step output.
 * 2. Use process_input for previous-step data; prefer tf.* (tf.log, tf.tenantDb, tf.connector, …).
 * 3. Use tf.tenantDb / tf.dataAccess for DB — no raw drivers, no require().
 * 4. tf.api.get / post / put for internal HTTP only — no api.delete; no fetch to arbitrary hosts.
 * 5. files.read / write / list for execution uploads — not getFiles().
 * 6. notification.send / dispatch — not createAdminNotification; remove(id) takes a string id.
 * 7. Process-to-process: tf.process.execute(id, input, { async: true }) — prefer over raw execute-process HTTP.
 * 8. Tenant file writes: file_put_contents, mkdir (file capability; $-prefixed aliases exist for migration).
 * 9. Declare required capabilities on the process step (data-access, connector, file, llm, api, …).
 */

// --- Validation (early return) ---
const email = String(process_input.email ?? "").trim();
if (!email) {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Email required" },
    data: null,
  };
}

// --- Logging (structured; not console.log) ---
tf.log("info", "Processing customer", { email });

// --- Tenant DB (compatibility global; requires data-access capability) ---
const customer = await tenantDb.getOne(
  "SELECT * FROM Customers WHERE email = ?",
  [email]
);

if (!customer) {
  return {
    success: false,
    error: { code: "NOT_FOUND", message: "Customer not found" },
    data: null,
  };
}

// --- Modern data access (preferred when available) ---
// const record = await tf.dataAccess.getRecord("Customers", customer.id);

// --- Internal API (auth headers injected automatically) ---
const entities = await api.get("/api/v1/entities");

// --- Integration connector ---
const integrationResult = await integration.executeSync("integration_id", {
  email,
});

// --- LLM ---
// const llmResult = await llm.callLLM("Summarize: " + JSON.stringify(process_input), {
//   max_tokens: 500,
//   temperature: 0.3,
// });

// --- Email ---
// await email.send({
//   to: email,
//   subject: "Process complete",
//   text: `Hello ${customer.name}`,
//   process_id: process_id,
// });

// --- Files (when execution has uploads; may be null) ---
let fileCount = 0;
if (files) {
  const paths = await files.list();
  fileCount = paths.length;
  for (const path of paths) {
    const content = await files.read(path);
    tf.log("debug", "Read upload", { path, size: content.length });
  }
}

// --- Tenant-scoped file write (file capability) ---
// await mkdir("reports");
// await file_put_contents(`reports/${process_execution_id}.json`, JSON.stringify({ email }));

// --- Notification ---
await notification.dispatch({
  process_id: process_id,
  title: "Step complete",
  message: `Processed ${email}`,
  user_id: user_id,
  tenant_id: tenant_id,
});

// --- Async process trigger (WebApp stub pattern) ---
// await tf.process.execute(
//   "target_process_id",
//   { ...process_input, triggered_by: process_execution_id },
//   { async: true }
// );

// --- Success return (data flows to next step as process_input) ---
return {
  success: true,
  data: {
    email,
    customer,
    entities_ok: entities.success,
    integrationResult,
    fileCount,
  },
  message: "Done",
};
