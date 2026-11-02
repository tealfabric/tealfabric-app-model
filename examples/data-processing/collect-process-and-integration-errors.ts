/**
 * Collect Process and Integration Errors
 *
 * Retrieves all process errors and integration errors for the past hour.
 * Log entries are stored to a JSON file in the tenantdata structure.
 *
 * Returns the created path/filename as a return value.
 * If no errors found, no file is created and no filename is returned.
 *
 * Input: None required
 * Output: Success with file path if errors found, or success with no file if no errors
 *
 * Capabilities: data-access, file
 */

type ErrorRecord = Record<string, unknown>;

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function oneHourAgoDate(): Date {
  return new Date(Date.now() - 60 * 60 * 1000);
}

function parseJsonField(value: unknown): unknown {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function basenamePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

function stripJsonExtension(filename: string): string {
  return filename.endsWith(".json") ? filename.slice(0, -5) : filename;
}

try {
  const oneHourAgo = formatDateTime(oneHourAgoDate());
  const oneHourAgoMs = oneHourAgoDate().getTime();
  const allErrors: ErrorRecord[] = [];

  const processErrors = (await tenantDb.query(
    `
        SELECT
            pel.execution_id,
            pel.process_id,
            p.name as process_name,
            pel.execution_status,
            pel.error_message,
            pel.created_at,
            pel.execution_time_ms,
            pel.orchestration_context_build_ms,
            pel.orchestration_validation_ms,
            pel.orchestration_total_ms
        FROM ProcessExecutionLogs pel
        LEFT JOIN Processes p ON pel.process_id = p.process_id
        WHERE pel.tenant_id = ?
        AND pel.created_at >= ?
        AND (pel.execution_status = 'error' OR pel.execution_status = 'failed')
        ORDER BY pel.created_at DESC
    `,
    [tenant_id, oneHourAgo]
  )) as ErrorRecord[];

  for (const error of processErrors) {
    allErrors.push({
      type: "process_execution",
      execution_id: error.execution_id,
      process_id: error.process_id,
      process_name: error.process_name,
      status: error.execution_status,
      error_message: error.error_message,
      execution_time_ms: error.execution_time_ms,
      orchestration_context_build_ms: error.orchestration_context_build_ms,
      orchestration_validation_ms: error.orchestration_validation_ms,
      orchestration_total_ms: error.orchestration_total_ms,
      created_at: error.created_at,
    });
  }

  const integrationQueueErrors = (await tenantDb.query(
    `
        SELECT
            ieq.execution_id,
            ieq.integration_id,
            i.name as integration_name,
            ieq.status,
            ieq.error_message,
            ieq.error_code,
            ieq.execution_time_ms,
            ieq.retry_count,
            ieq.completed_at,
            ieq.queued_at,
            ieq.started_at
        FROM IntegrationExecutionQueue ieq
        LEFT JOIN Integrations i ON ieq.integration_id = i.integration_id
        WHERE ieq.tenant_id = ?
        AND (ieq.status = 'failed' OR ieq.status = 'error')
        AND (ieq.completed_at >= ? OR (ieq.completed_at IS NULL AND ieq.queued_at >= ?))
        ORDER BY COALESCE(ieq.completed_at, ieq.queued_at) DESC
    `,
    [tenant_id, oneHourAgo, oneHourAgo]
  )) as ErrorRecord[];

  for (const error of integrationQueueErrors) {
    allErrors.push({
      type: "integration_execution",
      execution_id: error.execution_id,
      integration_id: error.integration_id,
      integration_name: error.integration_name,
      status: error.status,
      error_message: error.error_message,
      error_code: error.error_code,
      execution_time_ms: error.execution_time_ms,
      retry_count: error.retry_count,
      queued_at: error.queued_at,
      started_at: error.started_at,
      completed_at: error.completed_at,
    });
  }

  const integrationLogErrors = (await tenantDb.query(
    `
        SELECT
            il.log_id,
            il.integration_id,
            i.name as integration_name,
            il.status,
            il.message,
            il.request_data,
            il.response_data,
            il.execution_time,
            il.created_at
        FROM IntegrationLogs il
        LEFT JOIN Integrations i ON il.integration_id = i.integration_id
        WHERE il.tenant_id = ?
        AND il.status = 'error'
        AND il.created_at >= ?
        ORDER BY il.created_at DESC
    `,
    [tenant_id, oneHourAgo]
  )) as ErrorRecord[];

  for (const error of integrationLogErrors) {
    allErrors.push({
      type: "integration_log",
      log_id: error.log_id,
      integration_id: error.integration_id,
      integration_name: error.integration_name,
      status: error.status,
      message: error.message,
      request_data: parseJsonField(error.request_data),
      response_data: parseJsonField(error.response_data),
      execution_time: error.execution_time,
      created_at: error.created_at,
    });
  }

  const processflowsPath = "processflows";

  if (await is_dir(processflowsPath)) {
    const processDirs = await glob(`${processflowsPath}/*`);

    for (const processDir of processDirs) {
      if (!(await is_dir(processDir))) {
        continue;
      }

      const processId = basenamePath(processDir);
      const logFiles = await glob(`${processDir}/*.json`);

      for (const logFile of logFiles) {
        const executionId = stripJsonExtension(basenamePath(logFile));
        const fileMtime = await filemtime(logFile);

        if (fileMtime && fileMtime * 1000 >= oneHourAgoMs) {
          const logContent = await file_get_contents(logFile);
          if (logContent) {
            let logs: unknown;
            try {
              logs = JSON.parse(logContent);
            } catch {
              logs = null;
            }

            if (Array.isArray(logs)) {
              for (const logEntry of logs) {
                if (!logEntry || typeof logEntry !== "object" || Array.isArray(logEntry)) {
                  continue;
                }
                const entry = logEntry as ErrorRecord;
                const logLevel = String(entry.level ?? "").toLowerCase();
                const logTimestamp = String(entry.timestamp ?? "");

                if (
                  ["error", "critical", "fatal"].includes(logLevel) &&
                  logTimestamp &&
                  !Number.isNaN(Date.parse(logTimestamp)) &&
                  Date.parse(logTimestamp) >= oneHourAgoMs
                ) {
                  allErrors.push({
                    type: "process_log",
                    execution_id: entry.execution_id ?? executionId,
                    process_id: processId,
                    log_file: `processflows/${processId}/${basenamePath(logFile)}`,
                    level: logLevel,
                    message: entry.message ?? "",
                    timestamp: logTimestamp,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  if (allErrors.length === 0) {
    return {
      success: true,
      data: {
        errors_found: 0,
        file_created: false,
        message: "No errors found in the past hour",
      },
    };
  }

  const errorCounts = {
    process_execution: 0,
    integration_execution: 0,
    integration_log: 0,
    process_log: 0,
  };
  for (const entry of allErrors) {
    const type = String(entry.type ?? "");
    if (type in errorCounts) {
      errorCounts[type as keyof typeof errorCounts] += 1;
    }
  }

  const now = new Date();
  const errorSummary = {
    generated_at: formatDateTime(now),
    time_range: {
      from: oneHourAgo,
      to: formatDateTime(now),
    },
    total_errors: allErrors.length,
    error_counts: errorCounts,
    errors: allErrors,
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const filename = `error-report-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`;
  const relativePath = `error-reports/${filename}`;

  const errorReportsDir = "error-reports";
  if (!(await is_dir(errorReportsDir))) {
    await mkdir(errorReportsDir);
  }

  const jsonContent = JSON.stringify(errorSummary, null, 2);
  let writeResult: number;
  try {
    writeResult = await file_put_contents(relativePath, jsonContent);
  } catch {
    writeResult = 0;
  }

  if (!writeResult) {
    return {
      success: false,
      error: {
        code: "FILE_WRITE_ERROR",
        message: "Failed to write error report file",
        details: `Could not write to: ${relativePath}`,
      },
      data: null,
    };
  }

  return {
    success: true,
    data: {
      errors_found: allErrors.length,
      file_created: true,
      file_path: relativePath,
      file_size: writeResult,
      summary: {
        total_errors: errorSummary.total_errors,
        error_counts: errorSummary.error_counts,
      },
    },
    message: "Error report created successfully",
  };
} catch (e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  const isDbError =
    message.toLowerCase().includes("database") ||
    message.toLowerCase().includes("sql") ||
    message.toLowerCase().includes("data-access");

  if (isDbError) {
    return {
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: "Database operation failed",
        details: message,
      },
      data: null,
    };
  }

  return {
    success: false,
    error: {
      code: "UNKNOWN_ERROR",
      message: "Unexpected error occurred",
      details: message,
    },
    data: null,
  };
}
