/**
 * list_items — DataPool query prototype.
 * Capabilities: data-access, logging
 */

const session = await requirePlatformBearer();
if (!session.ok) {
  return session.response;
}

const limit = Math.min(Number(process_input.limit ?? 50) || 50, 100);
const offset = Math.max(Number(process_input.offset ?? 0) || 0, 0);
const status = String(process_input.status ?? "").trim();

let sql = `SELECT * FROM ${DATAPOOL_SCHEMA}`;
const params: Record<string, unknown> = {};
if (status) {
  sql += " WHERE status = :status";
  params[":status"] = status;
}
sql += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
params[":limit"] = limit;
params[":offset"] = offset;

try {
  if (typeof datapool === "undefined" || !datapool?.query) {
    return {
      success: true,
      data: {
        items: [],
        total: 0,
        limit,
        offset,
        _prototype: true,
        message: "DataPool not available in this environment — returning empty stub",
      },
    };
  }

  const raw = await datapool.query(sql, params);
  const envelope = parseConfigRecord(raw);
  const rows = Array.isArray(envelope.results) ? envelope.results : [];

  return {
    success: true,
    data: {
      items: rows,
      total: rows.length,
      limit,
      offset,
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  tf.log("warn", "list_items datapool query failed", { message });
  return {
    success: true,
    data: {
      items: [],
      total: 0,
      limit,
      offset,
      _prototype: true,
      message: "Schema may not exist yet — create via create_item with auto_create_schema",
    },
  };
}
