/**
 * Async process trigger — TypeScript stub step (interface v1.0.4).
 * Attach to a WebApp/Webhook-facing process for immediate HTTP response.
 *
 * Prefer tf.process.execute over raw execute-process HTTP.
 */
const targetProcessId = "process_REPLACE_ME";

const result = await tf.process.execute(
  targetProcessId,
  {
    ...process_input,
    triggered_by: process_execution_id,
  },
  { async: true }
);

if (!result?.success && result?.success !== undefined) {
  return {
    success: false,
    error: {
      code: "PROCESS_TRIGGER_FAILED",
      message: "Failed to queue async process",
      details: String((result as { error?: unknown })?.error ?? ""),
    },
    data: null,
  };
}

return {
  success: true,
  data: {
    queue_id: (result as { queue_id?: string; data?: { queue_id?: string } })?.queue_id
      ?? (result as { data?: { queue_id?: string } })?.data?.queue_id
      ?? null,
    status: "queued",
    target_process_id: targetProcessId,
  },
  message: "Async process queued",
};
