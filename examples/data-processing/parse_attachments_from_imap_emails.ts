/**
 * Parse MIME attachments from email bodies delivered by an IMAP integration step.
 *
 * No external libraries — inline MIME parsing only (sandbox-compliant).
 * Raw MIME bodies are expected in process_input.result.emails[].body from upstream.
 *
 * Capabilities: file, logging
 */
type EmailRecord = {
  message_number?: number | string;
  subject?: string;
  from?: string;
  body?: string;
};

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "attachment";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment";
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function decodePartBody(encoding: string, body: string): string {
  const enc = encoding.toLowerCase();
  if (enc.includes("base64")) {
    try {
      return atob(body.replace(/\s/g, ""));
    } catch {
      return body;
    }
  }
  if (enc.includes("quoted-printable")) {
    return decodeQuotedPrintable(body);
  }
  return body;
}

function parseMimeParts(raw: string): Array<{
  headers: Record<string, string>;
  body: string;
  filename?: string;
  contentType: string;
}> {
  const parts: Array<{
    headers: Record<string, string>;
    body: string;
    filename?: string;
    contentType: string;
  }> = [];

  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) {
    return parts;
  }

  const boundary = boundaryMatch[1];
  const segments = raw.split(`--${boundary}`);

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed || trimmed === "--") continue;

    const headerEnd = trimmed.search(/\r?\n\r?\n/);
    if (headerEnd < 0) continue;

    const headerBlock = trimmed.slice(0, headerEnd);
    const body = trimmed.slice(headerEnd).replace(/^\r?\n\r?\n/, "").trim();

    const headers: Record<string, string> = {};
    for (const line of headerBlock.split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1).trim();
      }
    }

    const contentType = headers["content-type"] ?? "text/plain";
    const disposition = headers["content-disposition"] ?? "";
    const filenameMatch =
      disposition.match(/filename="?([^";\r\n]+)"?/i) ??
      contentType.match(/name="?([^";\r\n]+)"?/i);
    const encoding = headers["content-transfer-encoding"] ?? "";

    parts.push({
      headers,
      body: decodePartBody(encoding, body),
      filename: filenameMatch?.[1],
      contentType: contentType.split(";")[0].trim(),
    });
  }

  return parts;
}

const emailData = (process_input.result as { emails?: { emails?: EmailRecord[] } } | undefined)
  ?.emails;

if (!emailData) {
  tf.log("warn", "No email data in process_input.result");
  return {
    success: false,
    error: { code: "EMAIL_DATA_NOT_FOUND", message: "Email data not found" },
    data: null,
  };
}

const emails = emailData.emails ?? [];
tf.log("info", "Parsing email attachments", { count: emails.length });

const processedEmails: Record<string, unknown>[] = [];

for (const email of emails) {
  const msgNo = email.message_number ?? null;
  const rawBody = email.body ?? "";

  if (!rawBody) {
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
    const parts = parseMimeParts(rawBody);
    const attachments = parts.filter(
      (p) => p.filename || p.contentType.startsWith("application/")
    );

    const savedAttachments: Record<string, unknown>[] = [];

    if (attachments.length > 0) {
      const attDir = `emails/${msgNo ?? "unknown"}/attachments`;
      if (!(await is_dir(attDir))) {
        await mkdir(attDir);
      }

      for (const att of attachments) {
        const filename = sanitizeFilename(att.filename ?? "attachment");
        const relativePath = `${attDir}/${filename}`;
        const written = await file_put_contents(relativePath, att.body);

        savedAttachments.push({
          filename,
          content_type: att.contentType,
          path: relativePath,
          size: written,
        });
      }
    }

    const textPart = parts.find((p) => p.contentType.includes("text/plain"));
    const htmlPart = parts.find((p) => p.contentType.includes("text/html"));

    processedEmails.push({
      message_number: msgNo,
      subject: email.subject ?? "",
      from: email.from ?? "",
      parsed: true,
      text_plain: textPart?.body ?? "",
      text_html: htmlPart?.body ?? "",
      attachments_found: attachments.length,
      attachments_saved: savedAttachments,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    processedEmails.push({
      message_number: msgNo,
      subject: email.subject ?? "",
      from: email.from ?? "",
      parsed: false,
      reason: message,
    });
  }
}

return {
  success: true,
  data: {
    emails_processed: processedEmails.length,
    emails: processedEmails,
  },
  message: `Processed ${processedEmails.length} email(s)`,
};
