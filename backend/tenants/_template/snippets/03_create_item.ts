/**
 * create_item — DataPool insert prototype.
 * Capabilities: data-access, logging
 */

const session = await requirePlatformBearer();
if (!session.ok) {
  return session.response;
}

const title = String(process_input.title ?? "").trim();
if (!title) {
  return appError("VALIDATION_FAILED", "title is required");
}

const description = String(process_input.description ?? "").trim();
const status = String(process_input.status ?? "draft").trim() || "draft";
const ownerId = String(session.user.user_id ?? session.user.id ?? "").trim();

const row = {
  title,
  description,
  status,
  owner_id: ownerId,
  created_at: tf.utils.nowIso(),
  updated_at: tf.utils.nowIso(),
};

try {
  if (typeof datapool === "undefined" || !datapool?.insert) {
    return {
      success: true,
      data: {
        item: { ...row, data_id: `stub-${tf.utils.deterministicId(row)}` },
        _prototype: true,
      },
      message: "DataPool not available — returning stub item",
    };
  }

  const inserted = (await datapool.insert(DATAPOOL_SCHEMA, row, {
    auto_create_schema: true,
    schema_type: "structured",
    description: "App Model items",
  })) as Record<string, unknown>;

  const dataId = String(inserted.data_id ?? inserted.data?.data_id ?? "");

  return {
    success: true,
    data: {
      item: { ...row, data_id: dataId },
    },
    message: "Item created",
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return appError("DATAPOOL_INSERT_FAILED", "Failed to create item", message);
}
