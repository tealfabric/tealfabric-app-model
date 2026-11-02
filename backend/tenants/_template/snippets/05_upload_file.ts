/**
 * upload_file — write a stub metadata record for an uploaded file.
 * Capabilities: file, data-access, logging
 *
 * Prototype: accepts base64 content in payload; writes to tenant storage.
 * Real apps should use platform document upload APIs or multipart handling.
 */

const session = await requirePlatformBearer();
if (!session.ok) {
  return session.response;
}

const filename = String(process_input.filename ?? "").trim();
const contentBase64 = String(process_input.content_base64 ?? "").trim();

if (!filename) {
  return appError("VALIDATION_FAILED", "filename is required");
}
if (!contentBase64) {
  return appError("VALIDATION_FAILED", "content_base64 is required");
}

const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
const storagePath = `${FILES_PREFIX}/${safeName}`;

try {
  let written = false;
  if (typeof $file_put_contents === "function") {
    const binary = atob(contentBase64);
    await $file_put_contents(storagePath, binary);
    written = true;
  }

  const meta = {
    filename: safeName,
    storage_path: storagePath,
    uploaded_by: String(session.user.user_id ?? session.user.id ?? ""),
    uploaded_at: tf.utils.nowIso(),
    size_bytes: contentBase64.length,
  };

  if (typeof datapool !== "undefined" && datapool?.insert) {
    try {
      await datapool.insert(
        "app_model_files",
        meta,
        {
          auto_create_schema: true,
          schema_type: "structured",
          description: "App Model file metadata",
        }
      );
    } catch {
      tf.log("warn", "file metadata datapool insert skipped");
    }
  }

  return {
    success: true,
    data: {
      file: meta,
      written,
      _prototype: !written,
    },
    message: written ? "File uploaded" : "File metadata recorded (storage stub)",
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return appError("FILE_UPLOAD_FAILED", "Failed to upload file", message);
}
