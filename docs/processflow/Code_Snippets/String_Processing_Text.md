# String Processing & Text Manipulation

This guide covers string processing and text manipulation techniques within ProcessFlow code snippets. **TypeScript preferred** — see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

## Overview

String processing is essential for data cleaning, formatting, parsing, and content generation. These are **idempotent operations** that transform text input into formatted output.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Raw Text      │────▶│  String Process  │────▶│  Formatted      │
│   Input         │     │  Code Snippet    │     │  Output         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Available JavaScript String APIs

| Category | Methods |
|----------|---------|
| **Case** | `toLowerCase`, `toUpperCase`, `charAt`, custom title-case |
| **Trim** | `trim`, `trimStart`, `trimEnd` |
| **Search** | `indexOf`, `lastIndexOf`, `includes`, `startsWith`, `endsWith` |
| **Replace** | `replace`, `replaceAll`, `replace` with regex |
| **Substring** | `slice`, `substring` |
| **Length** | `length`, `[...str].length` for Unicode code points |
| **Split/Join** | `split`, `join` |
| **Format** | Template literals, `toLocaleString` |
| **Regex** | `match`, `matchAll`, `replace`, `split` |
| **HTML** | Strip tags with regex; escape for HTML manually |
| **Encoding** | `encodeURIComponent`, `decodeURIComponent` |

---

## Example 1: Text Cleaning & Normalization

Clean and normalize user input:

```typescript
const input = String(process_input.result?.text ?? "");

let cleaned = input.trim();
cleaned = cleaned.replace(/\s+/g, " ");
cleaned = cleaned.replace(/[^\p{L}\p{N}\s.,!?@#\-_]/gu, "");

const normalized =
  cleaned.length > 0
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
    : "";

const maxLength = 500;
const finalText =
  [...normalized].length > maxLength
    ? [...normalized].slice(0, maxLength - 3).join("") + "..."
    : normalized;

return {
  success: true,
  data: {
    original: input,
    cleaned: finalText,
    original_length: [...input].length,
    cleaned_length: [...finalText].length,
  },
};
```

---

## Example 2: Name Parsing

Parse full name into components:

```typescript
const fullName = String(process_input.result?.name ?? "").trim();

if (!fullName) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No name provided" }, data: null };
}

let parts = fullName.split(/\s+/);

const parsed = {
  full_name: fullName,
  first_name: "",
  middle_name: "",
  last_name: "",
  prefix: "",
  suffix: "",
};

const prefixes = ["mr", "mrs", "ms", "miss", "dr", "prof"];
const suffixes = ["jr", "sr", "ii", "iii", "iv", "phd", "md", "esq"];

if (parts.length > 0 && prefixes.includes(parts[0].replace(/\.$/, "").toLowerCase())) {
  parsed.prefix = parts.shift() ?? "";
}

if (parts.length > 0 && suffixes.includes(parts[parts.length - 1].replace(/\.$/, "").toLowerCase())) {
  parsed.suffix = parts.pop() ?? "";
}

if (parts.length === 1) {
  parsed.first_name = parts[0];
} else if (parts.length === 2) {
  parsed.first_name = parts[0];
  parsed.last_name = parts[1];
} else if (parts.length >= 3) {
  parsed.first_name = parts[0];
  parsed.last_name = parts[parts.length - 1];
  parsed.middle_name = parts.slice(1, -1).join(" ");
}

for (const field of ["first_name", "middle_name", "last_name"] as const) {
  if (parsed[field]) {
    parsed[field] = parsed[field]
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

return { success: true, data: parsed };
```

---

## Example 3: Email Validation & Extraction

Extract and validate emails from text:

```typescript
const text = String(process_input.result?.text ?? "");
const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const foundEmails = [...new Set(text.match(emailPattern) ?? [])];
const validEmails: Array<{ email: string; domain: string; is_free_email: boolean }> = [];
const invalidEmails: string[] = [];

const freeDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];
const emailValidatePattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

for (const raw of foundEmails) {
  const email = raw.toLowerCase().trim();

  if (emailValidatePattern.test(email)) {
    const domain = email.slice(email.indexOf("@") + 1);
    validEmails.push({
      email,
      domain,
      is_free_email: freeDomains.includes(domain),
    });
  } else {
    invalidEmails.push(email);
  }
}

return {
  success: true,
  data: {
    valid_emails: validEmails,
    invalid_emails: invalidEmails,
    total_found: foundEmails.length,
    valid_count: validEmails.length,
  },
};
```

---

## Example 4: Phone Number Formatting

Parse and format phone numbers:

```typescript
const phone = String(process_input.result?.phone ?? "");
const countryCode = String(process_input.result?.country_code ?? "US");

let digits = phone.replace(/[^0-9]/g, "");
digits = digits.replace(/^0+/, "");

const formatted: Record<string, unknown> = {
  original: phone,
  digits_only: digits,
  formatted: "",
  international: "",
  valid: false,
};

switch (countryCode) {
  case "US":
  case "CA":
    if (digits.length === 10) {
      formatted.formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      formatted.international = `+1${digits}`;
      formatted.valid = true;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      formatted.formatted = `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
      formatted.international = `+${digits}`;
      formatted.valid = true;
    }
    break;

  case "FI":
    if (digits.length >= 9 && digits.length <= 10) {
      formatted.formatted = `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
      formatted.international = `+358${digits.replace(/^0+/, "")}`;
      formatted.valid = true;
    }
    break;

  default:
    if (digits.length >= 8 && digits.length <= 15) {
      formatted.formatted = digits;
      formatted.international = `+${digits}`;
      formatted.valid = true;
    }
}

return { success: true, data: formatted };
```

---

## Example 5: URL Parsing & Manipulation

Parse and manipulate URLs:

```typescript
const url = String(process_input.result?.url ?? "");

if (!url) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No URL provided" }, data: null };
}

let parsed: URL;
try {
  parsed = new URL(url);
} catch {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid URL format" }, data: null };
}

const queryParams: Record<string, string> = {};
parsed.searchParams.forEach((value, key) => {
  queryParams[key] = value;
});

const pathSegments = parsed.pathname.split("/").filter(Boolean);

const result = {
  original_url: url,
  scheme: parsed.protocol.replace(":", ""),
  host: parsed.hostname,
  port: parsed.port ? Number(parsed.port) : null,
  path: parsed.pathname || "/",
  path_segments: pathSegments,
  query_string: parsed.search.replace(/^\?/, ""),
  query_params: queryParams,
  fragment: parsed.hash.replace(/^#/, ""),
  user: parsed.username,
  is_secure: parsed.protocol === "https:",
  domain_parts: parsed.hostname.split("."),
  clean_url: `${parsed.protocol}//${parsed.host}${parsed.pathname}`,
};

return { success: true, data: result };
```

---

## Example 6: Template String Replacement

Replace placeholders in template strings:

```typescript
const template = String(process_input.result?.template ?? "");
const variables = (process_input.result?.variables ?? {}) as Record<string, unknown>;

if (!template) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No template provided" }, data: null };
}

let result = template;

for (const [key, value] of Object.entries(variables)) {
  const stringValue = Array.isArray(value) || typeof value === "object"
    ? JSON.stringify(value)
    : String(value);

  const patterns = [`{{${key}}}`, `{${key}}`, `%${key}%`, `$${key}$`, `[[${key}]]`];
  for (const pattern of patterns) {
    result = result.split(pattern).join(stringValue);
  }
}

const unresolvedMatch = result.match(/\{\{(\w+)\}\}|\{(\w+)\}|%(\w+)%/g) ?? [];
const unresolvedVars = [
  ...new Set(
    unresolvedMatch.flatMap((m) => {
      const parts = m.match(/\{\{(\w+)\}\}|\{(\w+)\}|%(\w+)%/);
      return parts ? [parts[1], parts[2], parts[3]].filter(Boolean) : [];
    })
  ),
];

return {
  success: true,
  data: {
    rendered: result,
    variables_used: Object.keys(variables),
    unresolved_variables: unresolvedVars,
  },
};
```

---

## Example 7: Slug Generation

Generate URL-friendly slugs:

```typescript
const text = String(process_input.result?.text ?? "");
const maxLength = Number(process_input.result?.max_length ?? 100);

if (!text) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No text provided" }, data: null };
}

const replacements: Record<string, string> = {
  ä: "a", ö: "o", ü: "u", ß: "ss",
  á: "a", é: "e", í: "i", ó: "o", ú: "u",
  à: "a", è: "e", ì: "i", ò: "o", ù: "u",
  ñ: "n", ç: "c", å: "a", ø: "o", æ: "ae",
};

let slug = text.toLowerCase();
for (const [from, to] of Object.entries(replacements)) {
  slug = slug.split(from).join(to);
}

slug = slug.replace(/[^\x20-\x7E]/g, "");
slug = slug.replace(/[^a-z0-9]+/g, "-");
slug = slug.replace(/^-+|-+$/g, "");
slug = slug.replace(/-+/g, "-");

if (slug.length > maxLength) {
  slug = slug.slice(0, maxLength);
  const lastHyphen = slug.lastIndexOf("-");
  if (lastHyphen > maxLength * 0.7) {
    slug = slug.slice(0, lastHyphen);
  }
}

return {
  success: true,
  data: {
    original: text,
    slug,
    length: slug.length,
  },
};
```

---

## Example 8: Text Excerpt Generation

Generate excerpts with word boundaries:

```typescript
const text = String(process_input.result?.text ?? "");
const maxLength = Number(process_input.result?.max_length ?? 200);
const suffix = String(process_input.result?.suffix ?? "...");

let cleanText = text.replace(/<[^>]*>/g, "");
cleanText = cleanText.replace(/\s+/g, " ").trim();

if ([...cleanText].length <= maxLength) {
  return {
    success: true,
    data: { excerpt: cleanText, truncated: false },
  };
}

let excerpt = [...cleanText].slice(0, maxLength).join("");
const lastSpace = excerpt.lastIndexOf(" ");
if (lastSpace !== -1 && lastSpace > maxLength * 0.7) {
  excerpt = excerpt.slice(0, lastSpace);
}

excerpt = excerpt.replace(/[,;:!?]+$/, "");
excerpt += suffix;

return {
  success: true,
  data: {
    excerpt,
    truncated: true,
    original_length: [...cleanText].length,
    excerpt_length: [...excerpt].length,
  },
};
```

---

## Example 9: CSV Line Parsing

Parse CSV formatted strings:

```typescript
const csvLine = String(process_input.result?.csv_line ?? "");
const delimiter = String(process_input.result?.delimiter ?? ",");
const enclosure = String(process_input.result?.enclosure ?? '"');
const headers = (process_input.result?.headers ?? []) as string[];

if (!csvLine) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No CSV line provided" }, data: null };
}

function parseCsvLine(line: string, delim: string, quote: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === quote) {
      inQuotes = !inQuotes;
    } else if (char === delim && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

const values = parseCsvLine(csvLine, delimiter, enclosure);

let result: string[] | Record<string, string>;
if (headers.length > 0 && headers.length === values.length) {
  result = Object.fromEntries(headers.map((h, i) => [h, values[i].trim()]));
} else {
  result = values.map((v) => v.trim());
}

return {
  success: true,
  data: {
    parsed: result,
    column_count: values.length,
    has_headers: headers.length > 0,
  },
};
```

---

## Example 10: Regex Data Extraction

Extract structured data using patterns:

```typescript
const text = String(process_input.result?.text ?? "");

const extracted = {
  emails: [] as string[],
  phones: [] as string[],
  urls: [] as string[],
  dates: [] as string[],
  amounts: [] as string[],
  hashtags: [] as string[],
  mentions: [] as string[],
};

extracted.emails = [...new Set(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [])];
extracted.phones = [...new Set(text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g) ?? [])];
extracted.urls = [...new Set(text.match(/https?:\/\/[^\s<>"']+/g) ?? [])];
extracted.dates = [...new Set(text.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/g) ?? [])];
extracted.amounts = [...new Set(text.match(/[\$€£¥]\s?\d+(?:[,.\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[,.\s]\d{3})*(?:[.,]\d{2})?\s?(?:USD|EUR|GBP|JPY)/g) ?? [])];
extracted.hashtags = [...new Set(text.match(/#[a-zA-Z0-9_]+/g) ?? [])];
extracted.mentions = [...new Set(text.match(/@[a-zA-Z0-9_]+/g) ?? [])];

return {
  success: true,
  data: {
    extracted,
    summary: {
      email_count: extracted.emails.length,
      phone_count: extracted.phones.length,
      url_count: extracted.urls.length,
      date_count: extracted.dates.length,
      amount_count: extracted.amounts.length,
    },
  },
};
```

---

## Best Practices

### 1. Use Unicode-Aware Length for User-Facing Text

```typescript
const length = [...text].length;
const excerpt = [...text].slice(0, 100).join("");
```

### 2. Validate Before Processing

```typescript
if (typeof input !== "string" || !input.trim()) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" }, data: null };
}
```

### 3. Escape Output Appropriately

```typescript
const safeHtml = text
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const safeUrl = encodeURIComponent(text);
```

### 4. Use Regex Flags

```typescript
const match = text.match(/pattern/iu);
```

---

## Security Considerations

| Warning | Solution |
|---------|----------|
| Don't use `eval()` on strings | Use explicit parsing instead |
| Escape HTML before display | Encode special characters |
| Validate regex patterns | Test patterns before use |
| Avoid dynamic regex from untrusted input | Whitelist allowed patterns |

---

## See Also

- [Data Transformation & Mapping](Data_Transformation_Mapping.md)
- [Data Validation & Sanitization](Data_Validation_Sanitization.md)
