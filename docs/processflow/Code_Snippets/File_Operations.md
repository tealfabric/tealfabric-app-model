# File Upload & Download

**TypeScript preferred** — see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

This guide covers file operations in ProcessFlow snippets.

## TypeScript / JavaScript (`new-sandbox`)

### WebApp uploads (`files` service)

For WebApp uploads, use the **`files`** service (requires `file` capability):

```typescript
if (!files) {
  return { success: true, data: { count: 0 } };
}
const paths = await files.list();
const content = await files.read(paths[0]);
await files.write("out/copy.txt", content);
return { success: true, data: { path: paths[0], size: content.length } };
```

Use `files.read` / `files.write` / `files.list` for execution-scoped uploads. Legacy `getFiles()` / `uploadToExternal()` are **not** on backend-next. See [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

### Tenant-scoped storage (`file_*` helpers)

For reads and writes under `storage/tenantdata/<tenant_id>/`, the platform injects tenant file helpers as unprefixed globals (no `import`). Prefer these TypeScript-style names in new code. `$`-prefixed aliases (e.g. `$file_put_contents`) still exist for migration.

| Helper | Description |
|--------|-------------|
| `file_put_contents(path, content)` | Write content to file |
| `file_get_contents(path)` | Read file content |
| `mkdir(path, mode?, recursive?)` | Create directory |
| `file_exists(path)` | Check if file exists |
| `is_dir(path)` | Check if path is directory |
| `is_file(path)` | Check if path is file |
| `unlink(path)` | Delete file |
| `copy(source, dest)` | Copy file |
| `rename(old, new)` | Rename/move file |
| `scandir(path)` | List directory contents |
| `chmod(path, mode)` | Change permissions |
| `filesize(path)` | Get file size |
| `filemtime(path)` | Get modification time |
| `read` / `write` | Convenience aliases for get/put |

Examples below use the unprefixed names.

**Error format:** The step contract ([interface v1](../interface/v1/error-format.md)) requires errors to be an object with `code` and `message` (and optional `details`). Examples below use this structure.

## Overview

ProcessFlow provides tenant-scoped file operations through injected globals. These functions automatically handle path validation and ensure files are stored within the tenant's directory.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Code Snippet   │────▶│  Tenant-Scoped   │────▶│  Tenant Files   │
│  (File Ops)     │     │  File Functions  │     │  Directory      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## ⚠️ Important: Use Injected Globals

| ✅ Correct | ❌ Incorrect |
|-----------|-------------|
| `await file_put_contents(...)` | `fs.writeFileSync(...)` |
| `await mkdir(...)` | Node `fs.mkdir(...)` |
| `await files.read(path)` (uploads) | `getFiles()` |

---

## Example 1: Write File

Write content to a tenant file:

```typescript
const filename = String(process_input.result?.filename ?? "");
const content = String(process_input.result?.content ?? "");
const directory = String(process_input.result?.directory ?? "uploads");

if (!filename || content === "") {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Filename and content required" },
    data: null,
  };
}

const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
const path = `${directory}/${safeName}`;

try {
  if (!(await is_dir(directory))) {
    await mkdir(directory);
  }

  const bytesWritten = await file_put_contents(path, content);

  if (!bytesWritten) {
    return {
      success: false,
      error: { code: "FILE_ERROR", message: "Failed to write file" },
      data: null,
    };
  }

  tf.log("info", "File written", { path, bytes: bytesWritten });

  return {
    success: true,
    data: {
      path,
      filename: safeName,
      bytes_written: bytesWritten,
      directory,
    },
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  tf.log("error", "File write failed", { message: err.message });

  return {
    success: false,
    error: { code: "FILE_ERROR", message: "File write error", details: err.message },
    data: null,
  };
}
```

---

## Example 2: Read File

Read content from a tenant file:

```typescript
const path = String(process_input.result?.path ?? "");

if (!path) {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "File path required" },
    data: null,
  };
}

try {
  if (!(await file_exists(path))) {
    return {
      success: false,
      error: { code: "FILE_NOT_FOUND", message: `File not found: ${path}` },
      data: null,
    };
  }

  if (!(await is_file(path))) {
    return {
      success: false,
      error: { code: "NOT_A_FILE", message: `Path is not a file: ${path}` },
      data: null,
    };
  }

  const content = await file_get_contents(path);
  const basename = path.split("/").pop() ?? path;
  const ext = basename.includes(".") ? basename.split(".").pop() ?? "" : "";
  const mtime = await filemtime(path);

  return {
    success: true,
    data: {
      path,
      filename: basename,
      extension: ext,
      content,
      size: content.length,
      modified_at: new Date(mtime * 1000).toISOString().slice(0, 19).replace("T", " "),
    },
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: { code: "FILE_ERROR", message: `File read error: ${err.message}` },
    data: null,
  };
}
```

---

## Example 3: JSON File Operations

Read and write JSON files:

```typescript
let path = String(process_input.result?.path ?? "");
const operation = String(process_input.result?.operation ?? "read");
const data = process_input.result?.data;

if (!path) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "File path required" }, data: null };
}

if (!path.endsWith(".json")) path += ".json";

try {
  switch (operation) {
    case "read": {
      if (!(await file_exists(path))) {
        return { success: false, error: { code: "FILE_NOT_FOUND", message: "File not found" }, data: null };
      }
      const content = await file_get_contents(path);
      const decoded = JSON.parse(content);
      return { success: true, data: { content: decoded, path } };
    }

    case "write": {
      if (data === undefined || data === null) {
        return { success: false, error: { code: "VALIDATION_ERROR", message: "Data required for write" }, data: null };
      }
      const json = JSON.stringify(data, null, 2);
      const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (directory && !(await is_dir(directory))) {
        await mkdir(directory);
      }
      const bytes = await file_put_contents(path, json);
      return { success: Boolean(bytes), data: { path, bytes_written: bytes } };
    }

    case "update": {
      let existing: Record<string, unknown> = {};
      if (await file_exists(path)) {
        const content = await file_get_contents(path);
        existing = JSON.parse(content) ?? {};
      }
      const merged = { ...existing, ...(data as Record<string, unknown> ?? {}) };
      const json = JSON.stringify(merged, null, 2);
      const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (directory && !(await is_dir(directory))) {
        await mkdir(directory);
      }
      const bytes = await file_put_contents(path, json);
      return {
        success: Boolean(bytes),
        data: { path, merged_content: merged, bytes_written: bytes },
      };
    }

    default:
      return { success: false, error: { code: "UNKNOWN_OPERATION", message: "Unknown operation" }, data: null };
  }
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: { code: "FILE_ERROR", message: `JSON file operation failed: ${err.message}` },
    data: null,
  };
}
```

---

## Example 4: Directory Operations

Create and list directories:

```typescript
const operation = String(process_input.result?.operation ?? "list");
const path = String(process_input.result?.path ?? "");
const recursive = Boolean(process_input.result?.recursive);

if (!path) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Path required" }, data: null };
}

try {
  switch (operation) {
    case "list": {
      if (!(await is_dir(path))) {
        return { success: false, error: { code: "NOT_FOUND", message: "Directory not found" }, data: null };
      }
      const items = await scandir(path);
      const files: Array<Record<string, unknown>> = [];
      const directories: Array<Record<string, unknown>> = [];

      for (const item of items) {
        if (item === "." || item === "..") continue;
        const itemPath = `${path}/${item}`;
        if (await is_dir(itemPath)) {
          directories.push({ name: item, path: itemPath, type: "directory" });
        } else {
          const size = await filesize(itemPath);
          const mtime = await filemtime(itemPath);
          files.push({
            name: item,
            path: itemPath,
            type: "file",
            size,
            modified: new Date(mtime * 1000).toISOString().slice(0, 19).replace("T", " "),
          });
        }
      }

      return {
        success: true,
        data: {
          path,
          directories,
          files,
          total_items: directories.length + files.length,
        },
      };
    }

    case "create": {
      if (await is_dir(path)) {
        return { success: true, data: { path, already_exists: true } };
      }
      const created = await mkdir(path, undefined, recursive);
      return { success: Boolean(created), data: { path, created: Boolean(created) } };
    }

    case "delete": {
      if (!(await is_dir(path))) {
        return { success: false, error: { code: "NOT_FOUND", message: "Directory not found" }, data: null };
      }
      const items = (await scandir(path)).filter((i) => i !== "." && i !== "..");
      if (items.length) {
        return {
          success: false,
          error: { code: "NOT_EMPTY", message: "Directory not empty" },
          data: { item_count: items.length },
        };
      }
      return {
        success: false,
        error: { code: "UNSUPPORTED", message: "Directory deletion requires manual action" },
        data: null,
      };
    }

    default:
      return { success: false, error: { code: "UNKNOWN_OPERATION", message: "Unknown operation" }, data: null };
  }
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: { code: "FILE_ERROR", message: `Directory operation failed: ${err.message}` },
    data: null,
  };
}
```

---

## Example 5: CSV File Export

Export data to CSV file:

```typescript
const records = (process_input.result?.records ?? []) as Array<Record<string, unknown>>;
let filename = String(process_input.result?.filename ?? "export.csv");
const directory = String(process_input.result?.directory ?? "exports");
let headers = process_input.result?.headers as string[] | null;

if (!records.length) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No records to export" }, data: null };
}

filename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
if (!filename.endsWith(".csv")) filename += ".csv";

if (!headers?.length) {
  headers = Object.keys(records[0]);
}

const quote = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

try {
  if (!(await is_dir(directory))) {
    await mkdir(directory);
  }

  const path = `${directory}/${filename}`;
  const lines = [headers.map(quote).join(",")];

  for (const record of records) {
    lines.push(headers.map((h) => quote(record[h])).join(","));
  }

  const csvContent = lines.join("\n");
  const bytes = await file_put_contents(path, csvContent);

  tf.log("info", "CSV exported", { path, records: records.length });

  return {
    success: Boolean(bytes),
    data: { path, filename, record_count: records.length, bytes_written: bytes },
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: { code: "FILE_ERROR", message: `CSV export failed: ${err.message}` },
    data: null,
  };
}
```

---

## Example 6: File Copy and Move

Copy or move files:

```typescript
const operation = String(process_input.result?.operation ?? "copy");
const sourcePath = String(process_input.result?.source ?? "");
const destPath = String(process_input.result?.destination ?? "");
const overwrite = Boolean(process_input.result?.overwrite);

if (!sourcePath || !destPath) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Source and destination required" }, data: null };
}

try {
  if (!(await file_exists(sourcePath))) {
    return { success: false, error: { code: "FILE_NOT_FOUND", message: "Source file not found" }, data: null };
  }

  if ((await file_exists(destPath)) && !overwrite) {
    return {
      success: false,
      error: { code: "EXISTS", message: "Destination already exists. Set overwrite=true to replace." },
      data: null,
    };
  }

  const destDir = destPath.includes("/") ? destPath.slice(0, destPath.lastIndexOf("/")) : "";
  if (destDir && !(await is_dir(destDir))) {
    await mkdir(destDir);
  }

  const result =
    operation === "copy"
      ? await copy(sourcePath, destPath)
      : await rename(sourcePath, destPath);

  if (result) {
    tf.log("info", `File ${operation}d`, { source: sourcePath, destination: destPath });
    const size = await filesize(destPath);
    return {
      success: true,
      data: { operation, source: sourcePath, destination: destPath, size },
    };
  }

  return {
    success: false,
    error: { code: "FILE_ERROR", message: `Failed to ${operation} file` },
    data: null,
  };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: { code: "FILE_ERROR", message: `File operation failed: ${err.message}` },
    data: null,
  };
}
```

---

## Example 7: Process Attachments

Save attachments from process input:

```typescript
const attachments = (process_input.result?.attachments ?? []) as Array<{
  filename?: string;
  content?: string;
  is_base64?: boolean;
}>;

const now = new Date();
const defaultDir = `attachments/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
const directory = String(process_input.result?.directory ?? defaultDir);

if (!attachments.length) {
  return { success: true, data: { saved: [], message: "No attachments to process" } };
}

if (!(await is_dir(directory))) {
  await mkdir(directory);
}

const saved: Array<Record<string, unknown>> = [];
const failed: Array<Record<string, unknown>> = [];

for (let index = 0; index < attachments.length; index++) {
  const attachment = attachments[index];
  let filename = (attachment.filename ?? `attachment_${index}`).replace(/[^a-zA-Z0-9._-]/g, "_");
  let content = attachment.content ?? "";

  if (attachment.is_base64) {
    try {
      content = Buffer.from(content, "base64").toString("utf8");
    } catch {
      failed.push({ filename, error: { code: "VALIDATION_ERROR", message: "Invalid base64 content" } });
      continue;
    }
  }

  let filePath = `${directory}/${filename}`;
  let counter = 1;
  const originalPath = filePath;

  while (await file_exists(filePath)) {
    const dot = filename.lastIndexOf(".");
    const base = dot >= 0 ? filename.slice(0, dot) : filename;
    const ext = dot >= 0 ? filename.slice(dot) : "";
    filePath = `${directory}/${base}_${counter}${ext}`;
    counter++;
  }

  try {
    const bytes = await file_put_contents(filePath, content);
    if (bytes) {
      saved.push({
        original_filename: attachment.filename ?? `attachment_${index}`,
        saved_path: filePath,
        size: bytes,
      });
    } else {
      failed.push({ filename, error: { code: "RUNTIME_ERROR", message: "Write failed" } });
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    failed.push({ filename, error: err.message });
  }
}

tf.log("info", "Attachments processed", { saved: saved.length, failed: failed.length });

return {
  success: failed.length === 0,
  data: { saved, failed, total: attachments.length, directory },
};
```

---

## Example 8: Read WebApp Uploads

Read files uploaded via a WebApp form:

```typescript
if (!files) {
  return { success: true, data: { files: {}, count: 0 } };
}

try {
  const paths = await files.list();
  const out: Record<string, string> = {};
  for (const p of paths) {
    out[p] = await files.read(p);
  }
  return { success: true, data: { files: out, count: paths.length } };
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  return {
    success: false,
    error: { code: "FILE_ERROR", message: err.message },
    data: null,
  };
}
```

---

## Best Practices

### 1. Always Check File Existence
```typescript
if (!(await file_exists(path))) {
  return { success: false, error: { code: "FILE_NOT_FOUND", message: "File not found" }, data: null };
}
```

### 2. Sanitize Filenames
```typescript
const filename = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
```

### 3. Create Directories Before Writing
```typescript
if (!(await is_dir(directory))) {
  await mkdir(directory);
}
```

### 4. Log File Operations
```typescript
tf.log("info", "File written", { path, bytes });
```

---

## Security Considerations

| ⚠️ Warning | Solution |
|------------|----------|
| Path traversal attacks | Paths are automatically validated by sandbox |
| Sensitive file access | Only tenant directory accessible |
| File size limits | Check size before operations |
| Filename injection | Sanitize user-provided filenames |

---

## See Also

- [Email MIME Parsing](Email_MIME_Parsing.md)
- [Integration Connectors](Integration_Connectors.md)
