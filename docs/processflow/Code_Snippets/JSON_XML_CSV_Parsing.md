# JSON/XML/CSV Parsing

Parse and generate JSON, XML, and CSV data in ProcessFlow snippets. **TypeScript preferred**; see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

## Overview

Data format parsing is essential for integrations, imports, and data exchange. These are **idempotent operations** that convert between formats.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  JSON/XML/CSV   │────▶│  Parse &         │────▶│  JS Objects /   │
│  Input          │     │  Transform       │     │  Output Format  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Available APIs

| Format | Parse | Generate |
|--------|-------|----------|
| JSON | `JSON.parse` | `JSON.stringify` |
| XML | Regex or `integration.executeSync` | String templates or integration |
| CSV | `split` / `map` with line parser | `join` / manual quoting |

> **XML note:** DOMDocument / SimpleXML-style APIs are **blocked** in the TypeScript sandbox. Use regex for simple structures, or `integration.executeSync` / `api.post` for full XML parsing and generation.

---

## JSON Operations

### Example 1: JSON Parsing with Error Handling

```typescript
const jsonString = String(process_input.result?.json ?? "");
const options = (process_input.result?.options ?? {}) as Record<string, unknown>;

const result: Record<string, unknown> = {
  success: false,
  data: null,
  error: null,
  metadata: {},
};

if (!jsonString) {
  result.error = "No JSON input provided";
  return { success: false, data: result };
}

try {
  const decoded = JSON.parse(jsonString);

  result.success = true;
  result.data = decoded;
  result.metadata = {
    type: Array.isArray(decoded) ? "array" : typeof decoded,
    count: Array.isArray(decoded) ? decoded.length : null,
    keys:
      decoded !== null && typeof decoded === "object" && !Array.isArray(decoded)
        ? Object.keys(decoded as object)
        : null,
    size_bytes: jsonString.length,
  };

  return { success: true, data: result };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  result.error = `JSON parse error: ${message}`;

  const cleaned = jsonString.replace(/[\x00-\x1F\x7F]/g, "");
  try {
    JSON.parse(cleaned);
    result.error = `${result.error} (likely control characters in input)`;
  } catch {
    // keep original error
  }

  return { success: false, data: result };
}
```

### Example 2: JSON Generation with Options

```typescript
const data = process_input.result?.data ?? {};
const options = (process_input.result?.options ?? {}) as Record<string, unknown>;

const stringifyOptions: { space?: number } = {};
if (options.pretty_print) {
  stringifyOptions.space = 2;
}

let json: string;
try {
  json = JSON.stringify(data, null, stringifyOptions.space);
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `JSON encoding failed: ${message}` },
    data: null,
  };
}

return {
  success: true,
  data: {
    json,
    size_bytes: json.length,
    pretty_print: Boolean(options.pretty_print),
  },
};
```

### Example 3: JSON Path Query

```typescript
/**
 * Simple JSON path query implementation
 * Supports: $.field, $.nested.field, $.array[0], $.array[*].field
 */

let data: unknown = process_input.result?.data ?? {};
const path = String(process_input.result?.path ?? "$");

if (typeof data === "string") {
  try {
    data = JSON.parse(data);
  } catch {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON" }, data: null };
  }
}

let pathExpr = path.replace(/^\$\.?/, "");
if (!pathExpr) {
  return { success: true, data: { result: data } };
}

const parts = pathExpr.split(/\.(?![^\[]*\])/);
let result: unknown = data;

for (const part of parts) {
  if (result === null || result === undefined) break;

  const match = part.match(/^(\w+)\[(\d+|\*)\]$/);
  if (match) {
    const field = match[1];
    const index = match[2];
    const obj = result as Record<string, unknown>;

    if (!(field in obj)) {
      result = null;
      break;
    }

    if (index === "*") {
      result = obj[field];
    } else {
      const arr = obj[field] as unknown[];
      result = arr?.[Number(index)] ?? null;
    }
  } else {
    result = (result as Record<string, unknown>)[part] ?? null;
  }
}

return {
  success: true,
  data: {
    path: pathExpr,
    result,
    found: result !== null && result !== undefined,
  },
};
```

---

## XML Operations

### Example 4: XML Parsing (regex — sandbox-safe)

```typescript
const xmlString = String(process_input.result?.xml ?? "");

if (!xmlString) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No XML input" }, data: null };
}

/**
 * Simple regex-based XML tag extractor.
 * For complex XML, use integration.executeSync to call an external parser.
 */
function parseSimpleXml(xml: string): Record<string, unknown> {
  const rootMatch = xml.match(/<([a-zA-Z_][\w.-]*)(?:\s[^>]*)?>([\s\S]*)<\/\1>/);
  if (!rootMatch) {
    throw new Error("Could not find root element");
  }

  const rootElement = rootMatch[1];
  const inner = rootMatch[2];
  const parsed: Record<string, unknown> = {};

  const tagRegex = /<([a-zA-Z_][\w.-]*)(?:\s([^>]*))?>([^<]*)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(inner)) !== null) {
    const tagName = match[1];
    const text = match[3].trim();
    if (tagName in parsed) {
      const existing = parsed[tagName];
      parsed[tagName] = Array.isArray(existing) ? [...existing, text] : [existing, text];
    } else {
      parsed[tagName] = text;
    }
  }

  return { root_element: rootElement, parsed };
}

try {
  const data = parseSimpleXml(xmlString);
  return {
    success: true,
    data: {
      parsed: data.parsed,
      root_element: data.root_element,
    },
  };
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `XML parsing failed: ${message}` },
    details: "Use integration.executeSync for full XML parsing when regex is insufficient",
    data: null,
  };
}
```

### Example 5: XML Generation (string builder)

```typescript
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;
const rootElement = String(process_input.result?.root ?? "root");
const options = (process_input.result?.options ?? {}) as Record<string, unknown>;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function arrayToXml(obj: Record<string, unknown>, indent = ""): string {
  let xml = "";
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("@")) continue;
    if (key === "#text") continue;

    const tag = key.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^(\d)/, "_$1");

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          xml += `${indent}<${tag}>\n${arrayToXml(item as Record<string, unknown>, indent + "  ")}\n${indent}</${tag}>\n`;
        } else {
          xml += `${indent}<${tag}>${escapeXml(String(item))}</${tag}>\n`;
        }
      }
    } else if (typeof value === "object" && value !== null) {
      const text = (value as Record<string, unknown>)["#text"];
      xml += `${indent}<${tag}>`;
      if (text !== undefined) {
        xml += escapeXml(String(text));
      } else {
        xml += `\n${arrayToXml(value as Record<string, unknown>, indent + "  ")}\n${indent}`;
      }
      xml += `</${tag}>\n`;
    } else {
      xml += `${indent}<${tag}>${escapeXml(String(value ?? ""))}</${tag}>\n`;
    }
  }
  return xml;
}

const declaration = options.include_declaration !== false
  ? '<?xml version="1.0" encoding="UTF-8"?>\n'
  : "";

const body = arrayToXml(data);
const xmlString = `${declaration}<${rootElement}>\n${body}</${rootElement}>`;

return {
  success: true,
  data: {
    xml: xmlString.trim(),
    size_bytes: xmlString.length,
  },
};
```

---

## CSV Operations

### Example 6: CSV Parsing

```typescript
const csvString = String(process_input.result?.csv ?? "");
const options = (process_input.result?.options ?? {}) as Record<string, unknown>;

const delimiter = String(options.delimiter ?? ",");
const enclosure = String(options.enclosure ?? '"');
const hasHeaders = Boolean(options.has_headers ?? true);
const skipEmpty = Boolean(options.skip_empty_lines ?? true);

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === enclosure) {
      if (inQuotes && line[i + 1] === enclosure) {
        current += enclosure;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

if (!csvString) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No CSV input" }, data: null };
}

const lines = csvString.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
const data: Array<Record<string, unknown> | string[]> = [];
let headers: string[] = [];
let rowCount = 0;
const errors: string[] = [];

for (let lineNum = 0; lineNum < lines.length; lineNum++) {
  const line = lines[lineNum];
  if (skipEmpty && line.trim() === "") continue;

  const row = parseCsvLine(line);

  if (hasHeaders && headers.length === 0) {
    headers = row.map((h) => h.trim());
    continue;
  }

  let record: Record<string, unknown> | string[] = row;

  if (headers.length > 0) {
    if (row.length !== headers.length) {
      errors.push(`Line ${lineNum + 1}: Column count mismatch`);
      const padded =
        row.length < headers.length
          ? [...row, ...Array(headers.length - row.length).fill(null)]
          : row.slice(0, headers.length);
      record = Object.fromEntries(headers.map((h, i) => [h, padded[i]]));
    } else {
      record = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    }
  }

  data.push(record);
  rowCount++;
}

return {
  success: true,
  data: {
    records: data,
    headers,
    row_count: rowCount,
    column_count: headers.length || (data[0] ? Object.keys(data[0]).length : 0),
    errors,
  },
};
```

### Example 7: CSV Generation

```typescript
const records = (process_input.result?.records ?? []) as Array<Record<string, unknown>>;
const options = (process_input.result?.options ?? {}) as Record<string, unknown>;

const delimiter = String(options.delimiter ?? ",");
const enclosure = String(options.enclosure ?? '"');
const includeHeaders = Boolean(options.include_headers ?? true);
let headers = (options.headers as string[] | null) ?? null;

if (records.length === 0) {
  return {
    success: true,
    data: { csv: "", row_count: 0 },
  };
}

if (headers === null && includeHeaders) {
  headers = Object.keys(records[0]);
}

function escapeCsvValue(value: unknown): string {
  const str = String(value ?? "");
  const needsQuotes =
    str.includes(delimiter) ||
    str.includes(enclosure) ||
    str.includes("\n") ||
    str.includes("\r");

  if (needsQuotes) {
    return enclosure + str.replaceAll(enclosure, enclosure + enclosure) + enclosure;
  }
  return str;
}

const lines: string[] = [];

if (includeHeaders && headers) {
  lines.push(headers.map(escapeCsvValue).join(delimiter));
}

for (const record of records) {
  const row = headers
    ? headers.map((h) => record[h] ?? "")
    : Object.values(record);
  lines.push(row.map(escapeCsvValue).join(delimiter));
}

const csv = lines.join("\n");

return {
  success: true,
  data: {
    csv,
    row_count: records.length,
    column_count: headers?.length ?? 0,
    size_bytes: csv.length,
  },
};
```

### Example 8: CSV to JSON Conversion

```typescript
const csvString = String(process_input.result?.csv ?? "");
const options = (process_input.result?.options ?? {}) as Record<string, unknown>;

const delimiter = String(options.delimiter ?? ",");
const hasHeaders = Boolean(options.has_headers ?? true);
const typeCast = Boolean(options.type_cast ?? true);

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function castValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  return trimmed;
}

const lines = csvString
  .replace(/\r\n/g, "\n")
  .replace(/\r/g, "\n")
  .split("\n")
  .filter((l) => l.trim() !== "");

if (lines.length === 0) {
  return { success: true, data: { json: "[]", records: [] } };
}

let headers: string[] = [];
const records: Array<Record<string, unknown> | string[]> = [];

for (let index = 0; index < lines.length; index++) {
  let row = parseCsvLine(lines[index]);

  if (hasHeaders && index === 0) {
    headers = row.map((h) => h.trim());
    continue;
  }

  if (typeCast) {
    row = row.map((v) => castValue(v)) as string[];
  }

  if (headers.length > 0) {
    const record: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      record[header] = row[i] ?? null;
    });
    records.push(record);
  } else {
    records.push(row);
  }
}

const json = JSON.stringify(records, null, 2);

return {
  success: true,
  data: {
    json,
    records,
    record_count: records.length,
    headers,
  },
};
```

---

## Format Detection and Conversion

### Example 9: Auto-Detect Format

```typescript
const input = String(process_input.result?.input ?? "").trim();

const result: Record<string, unknown> = {
  detected_format: null,
  confidence: 0,
  parsed: null,
};

if (!input) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No input provided" }, data: null };
}

try {
  const jsonData = JSON.parse(input);
  result.detected_format = "json";
  result.confidence = 100;
  result.parsed = jsonData;
  return { success: true, data: result };
} catch {
  // not JSON
}

if (/^<\?xml[\s\S]*<\/[a-zA-Z_][\w.-]*>/.test(input) || /^<[a-zA-Z_][\w.-]*[\s\S]*>/.test(input)) {
  result.detected_format = "xml";
  result.confidence = 80;
  result.parsed = input;
  result.note = "Use integration.executeSync for full XML-to-object parsing";
  return { success: true, data: result };
}

const lines = input.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");

if (lines.length > 0) {
  const delimiters = [",", ";", "\t", "|"];
  let bestDelimiter = ",";
  let bestScore = 0;

  function parseCsvLine(line: string, delim: string): string[] {
    return line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
  }

  for (const delimiter of delimiters) {
    const firstRow = parseCsvLine(lines[0], delimiter);
    const columnCount = firstRow.length;
    if (columnCount < 2) continue;

    let consistentRows = 0;
    for (const line of lines) {
      if (parseCsvLine(line, delimiter).length === columnCount) {
        consistentRows++;
      }
    }

    const score = (consistentRows / lines.length) * 100;
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  if (bestScore > 70) {
    result.detected_format = "csv";
    result.confidence = Math.round(bestScore);
    result.delimiter = bestDelimiter;

    const headers = parseCsvLine(lines[0], bestDelimiter);
    const records = lines.slice(1).map((line) => {
      const row = parseCsvLine(line, bestDelimiter);
      const padded = [...row, ...Array(Math.max(0, headers.length - row.length)).fill(null)];
      return Object.fromEntries(headers.map((h, i) => [h, padded[i]]));
    });
    result.parsed = records;

    return { success: true, data: result };
  }
}

result.detected_format = "unknown";
result.confidence = 0;
result.raw = input;

return { success: true, data: result };
```

### Example 10: Universal Format Converter

```typescript
const input = String(process_input.result?.input ?? "");
const sourceFormat = String(process_input.result?.source_format ?? "auto");
const targetFormat = String(process_input.result?.target_format ?? "json");
const options = (process_input.result?.options ?? {}) as Record<string, unknown>;

function parseCsv(inputText: string, delimiter: string): Record<string, unknown>[] {
  const lines = inputText.replace(/\r\n/g, "\n").trim().split("\n");
  const headers = lines.shift()!.split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines
    .filter((l) => l.trim() !== "")
    .map((line) => {
      const row = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
      const padded = [...row, ...Array(Math.max(0, headers.length - row.length)).fill(null)];
      return Object.fromEntries(headers.map((h, i) => [h, padded[i]]));
    });
}

function recordsToCsv(records: Record<string, unknown>[], delimiter: string): string {
  const headers = Object.keys(records[0] ?? {});
  const lines = [headers.join(delimiter)];
  for (const record of records) {
    const row = headers.map((h) => {
      const val = String(record[h] ?? "");
      return val.includes(delimiter) || val.includes('"')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    });
    lines.push(row.join(delimiter));
  }
  return lines.join("\n");
}

function objectToXml(data: unknown, root = "root", itemName = "item"): string {
  function build(obj: unknown, tag: string): string {
    if (Array.isArray(obj)) {
      return obj.map((item) => build(item, itemName)).join("");
    }
    if (obj !== null && typeof obj === "object") {
      const inner = Object.entries(obj as Record<string, unknown>)
        .map(([k, v]) => {
          const safe = k.replace(/[^a-zA-Z0-9_-]/g, "_");
          return build(v, /^\d+$/.test(k) ? itemName : safe);
        })
        .join("");
      return `<${tag}>${inner}</${tag}>`;
    }
    const escaped = String(obj ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<${tag}>${escaped}</${tag}>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${build(data, root)}`;
}

let data: unknown = null;
let parseError: string | null = null;

switch (sourceFormat) {
  case "json":
    try {
      data = JSON.parse(input);
    } catch (e) {
      parseError = `JSON parse error: ${e instanceof Error ? e.message : String(e)}`;
    }
    break;

  case "xml":
    parseError =
      "Full XML parsing requires integration.executeSync — regex-only parsing is not implemented here";
    break;

  case "csv": {
    const delimiter = String(options.csv_delimiter ?? ",");
    data = parseCsv(input, delimiter);
    break;
  }

  case "auto":
  default:
    try {
      data = JSON.parse(input);
      break;
    } catch {
      // continue
    }
    if (/^<[a-zA-Z_]/.test(input.trim())) {
      parseError = "Auto-detected XML — use source_format 'xml' with integration for parsing";
      break;
    }
    data = parseCsv(input, ",");
    break;
}

if (parseError || data === null) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: parseError ?? "Could not parse input" }, data: null };
}

let output: string | null = null;

switch (targetFormat) {
  case "json":
    output = JSON.stringify(data, null, options.pretty ? 2 : undefined);
    break;

  case "xml":
    output = objectToXml(
      data,
      String(options.xml_root ?? "root"),
      String(options.xml_item ?? "item")
    );
    break;

  case "csv": {
    const delimiter = String(options.csv_delimiter ?? ",");
    const records = Array.isArray(data) ? (data as Record<string, unknown>[]) : [data as Record<string, unknown>];
    output = recordsToCsv(records, delimiter);
    break;
  }

  default:
    return { success: false, error: { code: "VALIDATION_ERROR", message: `Unknown target format: ${targetFormat}` }, data: null };
}

return {
  success: true,
  data: {
    output,
    target_format: targetFormat,
    record_count: Array.isArray(data) ? data.length : 1,
  },
};
```

---

## Best Practices

### 1. Always Handle Parse Errors

```typescript
try {
  const data = JSON.parse(input);
  // use data
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: e instanceof Error ? e.message : "JSON parse failed" },
    data: null,
  };
}
```

### 2. Use Appropriate Encoding

```typescript
// JSON with readable formatting
JSON.stringify(data, null, 2);

// XML — escape special characters (native XML DOM APIs are blocked)
const escaped = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;");
```

### 3. Validate Structure After Parsing

```typescript
if (!("required_field" in (data as object))) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Missing required field" }, data: null };
}
```

### 4. Handle Large Files in Chunks

```typescript
// For large CSV, process line by line if possible
// rather than loading entire file into memory
const lines = content.split("\n");
for (const line of lines) {
  // process one row at a time
}
```

---

## See Also

- [Data Transformation & Mapping](Data_Transformation_Mapping.md)
- [Data Validation & Sanitization](Data_Validation_Sanitization.md)
- [String Processing & Text](String_Processing_Text.md)
