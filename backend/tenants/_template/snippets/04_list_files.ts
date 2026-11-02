/**
 * list_files — tenant storage file listing prototype.
 * Capabilities: file, logging
 */

const session = await requirePlatformBearer();
if (!session.ok) {
  return session.response;
}

const prefix = String(process_input.prefix ?? FILES_PREFIX).replace(/\/$/, "");

try {
  if (typeof tf.files === "undefined" || typeof tf.files.list !== "function") {
    return {
      success: true,
      data: {
        files: [],
        prefix,
        _prototype: true,
        message: "File capability not available — returning empty stub",
      },
    };
  }

  const listed = (await tf.files.list(prefix)) as unknown;
  const files = Array.isArray(listed) ? listed : [];

  return {
    success: true,
    data: {
      files,
      prefix,
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  tf.log("warn", "list_files failed", { prefix, message });
  return {
    success: true,
    data: {
      files: [],
      prefix,
      _prototype: true,
      message: "No files found or storage path not initialized",
    },
  };
}
