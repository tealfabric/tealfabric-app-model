# Email MIME Parsing in ProcessFlow Code Snippets

**TypeScript preferred** — see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

This guide explains how to parse email messages and extract attachments in ProcessFlow code snippets using **inline string and regex operations** (no external libraries or imports).

## Overview

When processing emails from IMAP or other mail integrations, you often need to extract:
- Plain text body content
- HTML body content
- File attachments

**Raw MIME bodies** arrive from upstream **integration steps** (for example, an IMAP connector). Your snippet receives the complete message — headers and body — as a string in `process_input`. Parse it inline; do not `import` or `require` MIME libraries.

Inline parsing can handle common cases:
- Multipart message structures (mixed, alternative, related)
- Nested multipart content
- Content-Transfer-Encoding (base64, quoted-printable, 7bit, 8bit)
- RFC 2047 encoded filenames in headers (basic decoding)
- Inline vs attachment disposition

For complex or malformed messages, prefer normalizing content in the integration step when possible.

## Input Requirements

### Expected Input Structure

The parser expects **raw email content** as a string — the complete email including headers and body, exactly as received from the mail server.

When using the IMAP connector, the email data structure typically looks like:

```typescript
// process_input.result.email_data from a prior integration step
const emailData = {
  emails: [
    {
      message_number: 1,
      uid: "12345",
      subject: "Email Subject",
      from: "sender@example.com",
      to: "recipient@example.com",
      date: "2024-01-15 10:30:00",
      body: "... raw MIME content ...", // complete raw message for parsing
    },
  ],
};
```

### Raw Email Format

The `body` field should contain the complete raw email, for example:

```
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="----=_Part_123"
Subject: Test Email
From: sender@example.com
To: recipient@example.com
Date: Mon, 15 Jan 2024 10:30:00 +0000

------=_Part_123
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

This is the plain text body.

------=_Part_123
Content-Type: application/pdf; name="document.pdf"
Content-Disposition: attachment; filename="document.pdf"
Content-Transfer-Encoding: base64

JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+Pg...

------=_Part_123--
```

## Inline MIME Helpers

Parse without imports — define helpers at the top of your snippet:

```typescript
function splitHeadersBody(raw: string): { headers: Record<string, string>; body: string } {
  const sep = raw.search(/\r?\n\r?\n/);
  if (sep < 0) return { headers: {}, body: raw };
  const headerBlock = raw.slice(0, sep);
  const body = raw.slice(sep).replace(/^\r?\n\r?\n/, "");
  const headers: Record<string, string> = {};
  for (const line of headerBlock.split(/\r?\n/)) {
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      const key = m[1].toLowerCase();
      headers[key] = headers[key] ? `${headers[key]} ${m[2]}` : m[2];
    }
  }
  return { headers, body };
}

function getHeader(headers: Record<string, string>, name: string): string {
  return headers[name.toLowerCase()] ?? "";
}

function getBoundary(contentType: string): string | null {
  const m = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
  return m ? (m[1] ?? m[2]) : null;
}

function decodeContent(body: string, encoding: string): string {
  const enc = (encoding || "7bit").toLowerCase().trim();
  if (enc === "base64") {
    return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8");
  }
  if (enc === "quoted-printable") {
    return body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return body;
}

function parsePart(raw: string): {
  headers: Record<string, string>;
  body: string;
  contentType: string;
  disposition: string;
  filename: string | null;
} {
  const { headers, body } = splitHeadersBody(raw);
  const contentType = getHeader(headers, "content-type");
  const enc = getHeader(headers, "content-transfer-encoding");
  const disposition = getHeader(headers, "content-disposition");
  const fnMatch =
    disposition.match(/filename\*?=(?:UTF-8''|")?([^";\r\n]+)/i) ??
    contentType.match(/name="?([^";\r\n]+)"?/i);
  const filename = fnMatch ? decodeURIComponent(fnMatch[1].replace(/"/g, "")) : null;
  return {
    headers,
    body: decodeContent(body.trim(), enc),
    contentType,
    disposition,
    filename,
  };
}

function splitMultipart(body: string, boundary: string): string[] {
  const marker = `--${boundary}`;
  return body
    .split(marker)
    .map((p) => p.replace(/^--\s*$/, "").trim())
    .filter((p) => p && p !== "--");
}

type MimeResult = {
  textPlain: string;
  textHtml: string;
  attachments: Array<{ filename: string; contentType: string; content: string; size: number }>;
  headers: Record<string, string>;
};

function parseMimeMessage(raw: string): MimeResult {
  const root = parsePart(raw);
  const result: MimeResult = {
    textPlain: "",
    textHtml: "",
    attachments: [],
    headers: root.headers,
  };

  function walk(partRaw: string, parentHeaders: Record<string, string>): void {
    const part = parsePart(partRaw);
    const ct = part.contentType.toLowerCase();
    const boundary = getBoundary(part.contentType);

    if (boundary) {
      for (const child of splitMultipart(part.body, boundary)) {
        walk(child, part.headers);
      }
      return;
    }

    if (ct.includes("text/plain") && !result.textPlain) {
      result.textPlain = part.body;
    } else if (ct.includes("text/html") && !result.textHtml) {
      result.textHtml = part.body;
    } else if (
      part.disposition.toLowerCase().includes("attachment") ||
      (!ct.startsWith("text/") && part.filename)
    ) {
      const content = part.body;
      result.attachments.push({
        filename: part.filename ?? "attachment",
        contentType: ct.split(";")[0].trim() || "application/octet-stream",
        content,
        size: content.length,
      });
    }
  }

  const rootBoundary = getBoundary(root.contentType);
  if (rootBoundary) {
    for (const child of splitMultipart(root.body, rootBoundary)) {
      walk(child, root.headers);
    }
  } else if (root.contentType.includes("text/html")) {
    result.textHtml = root.body;
  } else {
    result.textPlain = root.body;
  }

  return result;
}
```

## Output Structure

### Extracting Content

```typescript
const parsed = parseMimeMessage(rawEmailContent);

const textPlain = parsed.textPlain || null;
const textHtml = parsed.textHtml || null;
const subject = getHeader(parsed.headers, "subject");
const from = getHeader(parsed.headers, "from");
const to = getHeader(parsed.headers, "to");
const date = getHeader(parsed.headers, "date");
```

### Extracting Attachments

Each attachment object has:

| Property | Type | Description |
|----------|------|-------------|
| `filename` | `string` | Decoded filename from Content-Disposition or Content-Type |
| `contentType` | `string` | MIME type (e.g. `application/pdf`, `image/jpeg`) |
| `content` | `string` | Decoded body content |
| `size` | `number` | Content length in characters/bytes |

```typescript
for (const attachment of parsed.attachments) {
  const { filename, contentType, content, size } = attachment;
  // process attachment...
}
```

## Complete Example

Parse emails from an IMAP integration step and save attachments to tenant storage:

```typescript
/**
 * Parse attachments from IMAP emails using inline MIME parsing.
 * Raw MIME bodies come from a prior integration step — no imports required.
 */

const emailData = process_input.result?.email_data as
  | { emails?: Array<Record<string, unknown>> }
  | undefined;

if (!emailData) {
  return {
    success: false,
    error: { code: "EMAIL_DATA_NOT_FOUND", message: "Email data not found" },
    data: null,
  };
}

const emails = emailData.emails ?? [];
const processedEmails: Array<Record<string, unknown>> = [];

for (const email of emails) {
  const msgNo = email.message_number ?? null;
  const body = String(email.body ?? "");

  if (!body) {
    processedEmails.push({
      message_number: msgNo,
      subject: email.subject ?? "",
      from: email.from ?? "",
      parsed: false,
      reason: "No body content",
    });
    continue;
  }

  try {
    const message = parseMimeMessage(body);
    const textPlain = message.textPlain;
    const textHtml = message.textHtml;

    const attachments = message.attachments.map((att) => ({
      ...att,
      filename:
        att.filename.replace(/[^a-zA-Z0-9._-]/g, "_").split("/").pop() || "attachment",
    }));

    const savedAttachments: Array<Record<string, unknown>> = [];
    if (attachments.length > 0) {
      const attDir = `emails/${msgNo ?? "unknown"}/attachments`;
      if (!(await is_dir(attDir))) {
        await mkdir(attDir);
      }

      for (let idx = 0; idx < attachments.length; idx++) {
        const att = attachments[idx];
        let fn = att.filename || `attachment_${idx}`;
        const content = att.content ?? "";
        if (!content) continue;

        let fp = `${attDir}/${fn}`;
        let cnt = 1;
        const dot = fn.lastIndexOf(".");
        const bn = dot >= 0 ? fn.slice(0, dot) : fn;
        const ext = dot >= 0 ? fn.slice(dot + 1) : "";

        while (await file_exists(fp)) {
          fp = `${attDir}/${bn}_${cnt}${ext ? `.${ext}` : ""}`;
          cnt++;
        }

        const bytes = await file_put_contents(fp, content);
        if (bytes) {
          savedAttachments.push({
            original_filename: fn,
            saved_filename: fp.split("/").pop(),
            relative_path: fp,
            size: bytes,
            content_type: att.contentType,
            saved: true,
          });
        }
      }
    }

    processedEmails.push({
      message_number: msgNo,
      uid: email.uid ?? null,
      subject: email.subject ?? getHeader(message.headers, "subject") ?? "",
      from: email.from ?? getHeader(message.headers, "from") ?? "",
      to: email.to ?? getHeader(message.headers, "to") ?? "",
      date: email.date ?? getHeader(message.headers, "date") ?? null,
      body_plain: textPlain,
      body_html: textHtml,
      has_attachments: attachments.length > 0,
      attachment_count: attachments.length,
      attachments: savedAttachments,
      parsed: true,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    processedEmails.push({
      message_number: msgNo,
      subject: email.subject ?? "",
      from: email.from ?? "",
      parsed: false,
      reason: `Parse error: ${err.message}`,
    });
  }
}

return {
  success: true,
  data: {
    emails_processed: processedEmails.length,
    emails: processedEmails,
  },
  message: `Processed ${processedEmails.length} email(s) with attachment extraction`,
};
```

## Output Data Structure

The example code snippet returns the following structure:

```json
{
    "success": true,
    "data": {
        "emails_processed": 2,
        "emails": [
            {
                "message_number": 1,
                "uid": "12345",
                "subject": "Invoice for January",
                "from": "billing@company.com",
                "to": "finance@mycompany.com",
                "date": "2024-01-15 10:30:00",
                "body_plain": "Please find attached the invoice...",
                "body_html": "<html><body><p>Please find attached...</p></body></html>",
                "has_attachments": true,
                "attachment_count": 1,
                "attachments": [
                    {
                        "original_filename": "invoice_jan_2024.pdf",
                        "saved_filename": "invoice_jan_2024.pdf",
                        "relative_path": "emails/1/attachments/invoice_jan_2024.pdf",
                        "size": 125432,
                        "content_type": "application/pdf",
                        "saved": true
                    }
                ],
                "parsed": true
            },
            {
                "message_number": 2,
                "subject": "Error email",
                "from": "unknown@test.com",
                "parsed": false,
                "reason": "No body content"
            }
        ]
    },
    "message": "Processed 2 email(s) with attachment extraction"
}
```

## Tenant-Scoped File Operations

Tenant-scoped write helpers are injected as globals (no `import`). Paths are relative to `storage/tenantdata/<tenant_id>/`.

### Available File Functions (TypeScript)

Prefer unprefixed helpers (`file_put_contents`, `mkdir`, …). `$`-prefixed aliases exist for migration.

| Function | Description |
|----------|-------------|
| `file_put_contents` | Write data to file |
| `file_get_contents` | Read file contents |
| `file_exists` | Check if file exists |
| `is_dir` | Check if path is directory |
| `mkdir` | Create directory |
| `chmod` | Change file permissions |
| `scandir` | List directory contents |

For **WebApp uploads**, use `files.read` / `files.write` / `files.list` instead (requires `file` capability).

### Example Usage

```typescript
// Tenant-scoped writes (relative paths)
if (!(await is_dir("my-folder"))) {
  await mkdir("my-folder");
}
await file_put_contents("my-folder/data.json", JSON.stringify(data));
const content = await file_get_contents("my-folder/data.json");
```

### File Path Scoping

All paths are automatically prefixed with the tenant's data directory:
- Input path: `emails/1/attachments/file.pdf`
- Actual path: `storage/tenantdata/<tenant_id>/emails/1/attachments/file.pdf`

This ensures tenant isolation — code snippets cannot access files outside their tenant's directory.

## Advanced Usage

### Working with Inline Images

Inline images (embedded in HTML) have a Content-ID and are typically referenced in HTML as `cid:content-id`:

```typescript
const { headers, body } = splitHeadersBody(partRaw);
const contentId = getHeader(headers, "content-id").replace(/[<>]/g, "");
const disposition = getHeader(headers, "content-disposition");

if (contentId && disposition.toLowerCase() === "inline") {
  const enc = getHeader(headers, "content-transfer-encoding");
  const content = decodeContent(body.trim(), enc);
  // Replace cid: references in HTML with base64 data URLs or saved paths
}
```

### Getting All Headers

```typescript
const { headers } = splitHeadersBody(rawEmailContent);
const messageId = getHeader(headers, "message-id");
const inReplyTo = getHeader(headers, "in-reply-to");
const references = getHeader(headers, "references");
const contentType = getHeader(headers, "content-type");
```

## Error Handling

Wrap parsing in try/catch — malformed emails may throw:

```typescript
try {
  const message = parseMimeMessage(rawContent);
  // Process message...
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  tf.log("error", "MIME parse error", { message: err.message });
  return {
    success: false,
    error: { code: "MIME_PARSE_ERROR", message: err.message },
    data: null,
  };
}
```

## See Also

- [ProcessFlow Code Snippets Guide](../PROCESSFLOW_CODE_SNIPPETS_GUIDE.md)
- [File Operations](File_Operations.md)
- [Integration Connectors](Integration_Connectors.md)

Integration workers are documented in the platform repository.
