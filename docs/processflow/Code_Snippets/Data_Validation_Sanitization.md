# Data Validation & Sanitization

**TypeScript preferred** — new-sandbox. See [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

This guide covers data validation and sanitization techniques within ProcessFlow code snippets.

## Overview

Validation ensures data meets required criteria before processing. Sanitization cleans data to prevent security issues. Both are **essential idempotent operations** for data quality.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Raw Input     │────▶│  Validate &      │────▶│  Clean, Valid   │
│   Data          │     │  Sanitize        │     │  Data           │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## JavaScript/TypeScript APIs

Use native validation: `typeof`, `Array.isArray`, `Number.isNaN`, `RegExp.test`, `JSON.parse`, `URL` constructor, and string methods (`trim`, `toLowerCase`, `replace`). For HTML escaping, use a small helper or strip tags with regex.

---

## Example 1: Comprehensive Input Validation

Validate input against schema:

```typescript
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;
const schema = (process_input.result?.schema ?? {}) as Record<string, Record<string, unknown>>;

const errors: Record<string, string[]> = {};
const validated: Record<string, unknown> = {};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/i;

function parseBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return null;
}

for (const [field, rules] of Object.entries(schema)) {
  let value = data[field] ?? null;
  const fieldErrors: string[] = [];

  if (rules.required && (value === null || value === "")) {
    fieldErrors.push(`Field '${field}' is required`);
    errors[field] = fieldErrors;
    continue;
  }

  if (value === null || value === "") {
    validated[field] = rules.default ?? null;
    continue;
  }

  const type = String(rules.type ?? "string");
  switch (type) {
    case "string":
      if (typeof value !== "string") fieldErrors.push("Must be a string");
      break;
    case "integer":
    case "int":
      if (!Number.isFinite(Number(value)) || !Number.isInteger(Number(value))) {
        fieldErrors.push("Must be an integer");
      } else {
        value = Number.parseInt(String(value), 10);
      }
      break;
    case "float":
    case "number":
      if (!Number.isFinite(Number(value))) {
        fieldErrors.push("Must be a number");
      } else {
        value = Number(value);
      }
      break;
    case "boolean":
    case "bool": {
      const b = parseBool(value);
      if (b === null) fieldErrors.push("Must be a boolean");
      else value = b;
      break;
    }
    case "email":
      if (!EMAIL_RE.test(String(value))) fieldErrors.push("Must be a valid email");
      break;
    case "url":
      if (!URL_RE.test(String(value))) fieldErrors.push("Must be a valid URL");
      break;
    case "array":
      if (!Array.isArray(value)) fieldErrors.push("Must be an array");
      break;
    case "date":
      if (Number.isNaN(Date.parse(String(value)))) fieldErrors.push("Must be a valid date");
      break;
  }

  if (typeof value === "string" && fieldErrors.length === 0) {
    const minLen = rules.min_length as number | undefined;
    const maxLen = rules.max_length as number | undefined;
    if (minLen !== undefined && value.length < minLen) {
      fieldErrors.push(`Must be at least ${minLen} characters`);
    }
    if (maxLen !== undefined && value.length > maxLen) {
      fieldErrors.push(`Must not exceed ${maxLen} characters`);
    }
    if (rules.pattern && !new RegExp(String(rules.pattern)).test(value)) {
      fieldErrors.push(String(rules.pattern_message ?? "Does not match required format"));
    }
  }

  if (typeof value === "number" && fieldErrors.length === 0) {
    if (rules.min !== undefined && value < Number(rules.min)) {
      fieldErrors.push(`Must be at least ${rules.min}`);
    }
    if (rules.max !== undefined && value > Number(rules.max)) {
      fieldErrors.push(`Must not exceed ${rules.max}`);
    }
  }

  if (rules.enum && value !== null && value !== "") {
    const allowed = rules.enum as unknown[];
    if (!allowed.includes(value)) {
      fieldErrors.push(`Must be one of: ${allowed.join(", ")}`);
    }
  }

  if (fieldErrors.length > 0) {
    errors[field] = fieldErrors;
  } else {
    validated[field] = value;
  }
}

const errorCount = Object.values(errors).reduce((sum, arr) => sum + arr.length, 0);

return {
  success: Object.keys(errors).length === 0,
  data: {
    valid: Object.keys(errors).length === 0,
    validated,
    errors,
    error_count: errorCount,
  },
};
```

---

## Example 2: Email Validation

Comprehensive email validation:

```typescript
const emailRaw = String(process_input.result?.email ?? "");
const strictMode = Boolean(process_input.result?.strict ?? true);

const result: Record<string, unknown> = {
  original: emailRaw,
  valid: false,
  errors: [] as string[],
  sanitized: null as string | null,
  details: {} as Record<string, unknown>,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const email = emailRaw.trim().toLowerCase();
const errors = result.errors as string[];

if (!email) {
  errors.push("Email is required");
  return { success: false, data: result };
}

if (!EMAIL_RE.test(email)) {
  errors.push("Invalid email format");
  return { success: false, data: result };
}

const [localPart, domain] = email.split("@");
result.details = { local_part: localPart, domain };

if (strictMode) {
  const disposableDomains = ["tempmail.com", "throwaway.email", "10minutemail.com", "guerrillamail.com"];
  if (disposableDomains.includes(domain)) {
    errors.push("Disposable email addresses not allowed");
  }

  const typoFixes: Record<string, string> = {
    "gmial.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gmali.com": "gmail.com",
    "hotmal.com": "hotmail.com",
    "yahooo.com": "yahoo.com",
    "outloook.com": "outlook.com",
  };

  if (typoFixes[domain]) {
    (result.details as Record<string, unknown>).possible_typo = true;
    (result.details as Record<string, unknown>).suggested_domain = typoFixes[domain];
    (result.details as Record<string, unknown>).suggested_email = `${localPart}@${typoFixes[domain]}`;
  }

  if (localPart.length > 64) errors.push("Local part too long (max 64 characters)");
  if (domain.length > 255) errors.push("Domain too long (max 255 characters)");
}

const freeEmailDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com"];
const domainParts = domain.split(".");
(result.details as Record<string, unknown>).is_free_email = freeEmailDomains.includes(domain);
(result.details as Record<string, unknown>).domain_parts = domainParts;
(result.details as Record<string, unknown>).tld = domainParts[domainParts.length - 1];

if (errors.length === 0) {
  result.valid = true;
  result.sanitized = email;
}

return { success: Boolean(result.valid), data: result };
```

---

## Example 3: Phone Number Validation

Validate and format phone numbers:

```typescript
const phone = String(process_input.result?.phone ?? "");
const country = String(process_input.result?.country ?? "FI");

const result: Record<string, unknown> = {
  original: phone,
  valid: false,
  errors: [] as string[],
  sanitized: null as string | null,
  formatted: null as string | null,
  international: null as string | null,
};

const errors = result.errors as string[];
const cleaned = phone.replace(/[^\d+]/g, "");
const hasPlus = cleaned.startsWith("+");
const digits = cleaned.replace(/[^\d]/g, "");

if (!digits) {
  errors.push("Phone number required");
  return { success: false, data: result };
}

type CountryConfig = {
  prefix: string;
  local_prefix: string;
  lengths: number[];
  pattern: RegExp;
  format: (d: string) => string;
};

const countryPatterns: Record<string, CountryConfig> = {
  FI: {
    prefix: "358",
    local_prefix: "0",
    lengths: [9, 10, 11],
    pattern: /^(?:\+358|0)[1-9]\d{6,9}$/,
    format: (d) => {
      const n = d.replace(/^0+/, "");
      return `+358 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
    },
  },
  US: {
    prefix: "1",
    local_prefix: "",
    lengths: [10, 11],
    pattern: /^(?:\+?1)?[2-9]\d{9}$/,
    format: (d) => {
      const n = d.replace(/^1/, "");
      return `+1 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6, 10)}`;
    },
  },
  SE: {
    prefix: "46",
    local_prefix: "0",
    lengths: [9, 10, 11],
    pattern: /^(?:\+46|0)[1-9]\d{6,9}$/,
    format: (d) => `+46 ${d.replace(/^0+/, "")}`,
  },
};

const countryConfig = countryPatterns[country];

if (!countryConfig) {
  if (digits.length < 7 || digits.length > 15) {
    errors.push("Phone number must be 7-15 digits");
  } else {
    result.valid = true;
    result.sanitized = `+${digits}`;
    result.international = `+${digits}`;
  }
} else {
  let localDigits = digits;
  if (digits.startsWith(countryConfig.prefix)) {
    localDigits = digits.slice(countryConfig.prefix.length);
  }

  const lengthOk =
    countryConfig.lengths.includes(digits.length) ||
    countryConfig.lengths.includes(localDigits.length);

  if (!lengthOk) {
    errors.push(`Invalid phone number length for ${country}`);
  }

  const testNumber = hasPlus
    ? `+${digits}`
    : `${countryConfig.local_prefix}${localDigits.replace(/^0+/, "")}`;

  if (!countryConfig.pattern.test(testNumber)) {
    errors.push(`Invalid phone number format for ${country}`);
  }

  if (errors.length === 0) {
    result.valid = true;
    result.sanitized = localDigits;
    result.formatted = countryConfig.format(localDigits);
    result.international = `+${countryConfig.prefix}${localDigits.replace(/^0+/, "")}`;
  }
}

result.country = country;
result.digits_only = digits;

return { success: Boolean(result.valid), data: result };
```

---

## Example 4: Data Sanitization

Sanitize data for safe storage and display:

```typescript
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;
const rules = (process_input.result?.rules ?? {}) as Record<string, unknown>;

const defaultRules: Record<string, string[]> = {
  string: ["trim", "strip_tags"],
  html: ["trim", "escapeHtml"],
  email: ["trim", "lowercase", "email"],
  url: ["trim", "url"],
  integer: ["integer"],
  float: ["float"],
  boolean: ["boolean"],
  text: ["trim", "normalize_whitespace"],
  name: ["trim", "strip_tags", "titlecase"],
  slug: ["trim", "lowercase", "slug"],
};

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function titleCase(v: string): string {
  return v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const sanitizeFunctions: Record<string, (v: unknown) => unknown> = {
  trim: (v) => (typeof v === "string" ? v.trim() : v),
  strip_tags: (v) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "") : v),
  escapeHtml: (v) => (typeof v === "string" ? escapeHtml(v) : v),
  lowercase: (v) => (typeof v === "string" ? v.toLowerCase() : v),
  uppercase: (v) => (typeof v === "string" ? v.toUpperCase() : v),
  titlecase: (v) => (typeof v === "string" ? titleCase(v) : v),
  email: (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  url: (v) => (typeof v === "string" ? v.trim() : v),
  integer: (v) => Number.parseInt(String(v).replace(/[^\d-]/g, ""), 10),
  float: (v) => Number.parseFloat(String(v).replace(/[^\d.-]/g, "")),
  boolean: (v) => v === true || v === "true" || v === 1 || v === "1",
  alphanumeric: (v) => (typeof v === "string" ? v.replace(/[^a-zA-Z0-9]/g, "") : v),
  alpha: (v) => (typeof v === "string" ? v.replace(/[^a-zA-Z]/g, "") : v),
  numeric: (v) => (typeof v === "string" ? v.replace(/[^0-9]/g, "") : v),
  normalize_whitespace: (v) => (typeof v === "string" ? v.replace(/\s+/g, " ") : v),
  slug: (v) => {
    if (typeof v !== "string") return v;
    return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  },
  remove_null: (v) => (typeof v === "string" ? v.replace(/\0/g, "") : v),
};

const sanitized: Record<string, unknown> = {};

for (const [field, value] of Object.entries(data)) {
  let fieldRules = rules[field];

  if (fieldRules === undefined) {
    if (typeof value === "string") fieldRules = "string";
    else if (typeof value === "number") fieldRules = Number.isInteger(value) ? "integer" : "float";
    else if (typeof value === "boolean") fieldRules = "boolean";
  }

  let functions: string[] = [];
  if (typeof fieldRules === "string" && defaultRules[fieldRules]) {
    functions = defaultRules[fieldRules];
  } else if (Array.isArray(fieldRules)) {
    functions = fieldRules.map(String);
  }

  let sanitizedValue: unknown = value;
  for (const fn of functions) {
    if (sanitizeFunctions[fn]) {
      sanitizedValue = sanitizeFunctions[fn](sanitizedValue);
    }
  }
  sanitized[field] = sanitizedValue;
}

return {
  success: true,
  data: {
    sanitized,
    field_count: Object.keys(sanitized).length,
  },
};
```

---

## Example 5: JSON Validation

Validate JSON structure:

```typescript
const jsonInput = process_input.result?.json;
const schema = process_input.result?.schema as Record<string, Record<string, unknown>> | null;

const result: Record<string, unknown> = {
  valid: false,
  errors: [] as string[],
  data: null as unknown,
};

const errors = result.errors as string[];

if (typeof jsonInput === "string") {
  try {
    result.data = JSON.parse(jsonInput);
  } catch (e) {
    errors.push(`Syntax error, malformed JSON: ${(e as Error).message}`);
    return { success: false, data: result };
  }
} else if (Array.isArray(jsonInput) || (jsonInput !== null && typeof jsonInput === "object")) {
  result.data = jsonInput;
} else {
  errors.push("Input must be JSON string or object");
  return { success: false, data: result };
}

function isPlainArray(value: unknown): boolean {
  return Array.isArray(value);
}

function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateStructure(
  row: Record<string, unknown>,
  schemaDef: Record<string, Record<string, unknown>>,
  path = ""
): void {
  for (const [key, rules] of Object.entries(schemaDef)) {
    const currentPath = path ? `${path}.${key}` : key;
    const value = row[key];

    if (rules.required && !(key in row)) {
      errors.push(`Missing required field: ${currentPath}`);
      continue;
    }

    if (value === undefined || value === null) continue;

    const expectedType = rules.type ? String(rules.type) : null;
    if (expectedType) {
      const typeOk =
        (expectedType === "string" && typeof value === "string") ||
        (["integer", "int"].includes(expectedType) && Number.isInteger(value)) ||
        (["float", "double", "number"].includes(expectedType) && typeof value === "number") ||
        (["boolean", "bool"].includes(expectedType) && typeof value === "boolean") ||
        (expectedType === "array" && isPlainArray(value)) ||
        (expectedType === "object" && isPlainObject(value));

      if (!typeOk) {
        errors.push(`Field ${currentPath}: expected ${expectedType}, got ${typeof value}`);
      }
    }

    if (rules.properties && isPlainObject(value)) {
      validateStructure(value as Record<string, unknown>, rules.properties as Record<string, Record<string, unknown>>, currentPath);
    }

    if (rules.items && isPlainArray(value)) {
      const itemSchema = rules.items as Record<string, unknown>;
      (value as unknown[]).forEach((item, index) => {
        if (isPlainObject(item) && itemSchema.properties) {
          validateStructure(
            item as Record<string, unknown>,
            itemSchema.properties as Record<string, Record<string, unknown>>,
            `${currentPath}[${index}]`
          );
        }
      });
    }
  }
}

if (schema && result.data) {
  validateStructure(result.data as Record<string, unknown>, schema);
}

result.valid = errors.length === 0;

return { success: Boolean(result.valid), data: result };
```

---

## Example 6: Credit Card Validation

Validate credit card numbers (Luhn algorithm):

```typescript
const cardNumber = String(process_input.result?.card_number ?? "");
const expiryMonth = String(process_input.result?.expiry_month ?? "");
const expiryYear = String(process_input.result?.expiry_year ?? "");
const cvv = String(process_input.result?.cvv ?? "");

const result: Record<string, unknown> = {
  valid: false,
  errors: [] as string[],
  card_type: null as string | null,
  masked: null as string | null,
};

const errors = result.errors as string[];
const cleanCard = cardNumber.replace(/[^0-9]/g, "");

if (!cleanCard) {
  errors.push("Card number is required");
  return { success: false, data: result };
}

if (cleanCard.length < 13 || cleanCard.length > 19) {
  errors.push("Invalid card number length");
}

const cardTypes: Record<string, RegExp> = {
  visa: /^4/,
  mastercard: /^5[1-5]/,
  amex: /^3[47]/,
  discover: /^6(?:011|5)/,
  diners: /^3(?:0[0-5]|[68])/,
  jcb: /^(?:2131|1800|35)/,
};

for (const [type, pattern] of Object.entries(cardTypes)) {
  if (pattern.test(cleanCard)) {
    result.card_type = type;
    break;
  }
}

let sum = 0;
const parity = cleanCard.length % 2;
for (let i = 0; i < cleanCard.length; i++) {
  let digit = Number.parseInt(cleanCard[i], 10);
  if (i % 2 === parity) {
    digit *= 2;
    if (digit > 9) digit -= 9;
  }
  sum += digit;
}

if (sum % 10 !== 0) {
  errors.push("Invalid card number (checksum failed)");
}

if (expiryMonth && expiryYear) {
  let month = Number.parseInt(expiryMonth, 10);
  let year = Number.parseInt(expiryYear, 10);
  if (year < 100) year += 2000;

  if (month < 1 || month > 12) errors.push("Invalid expiry month");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    errors.push("Card has expired");
  }
  if (year > currentYear + 20) errors.push("Invalid expiry year");
}

if (cvv) {
  const cvvDigits = cvv.replace(/[^0-9]/g, "");
  const expectedLength = result.card_type === "amex" ? 4 : 3;
  if (cvvDigits.length !== expectedLength) {
    errors.push(`CVV must be ${expectedLength} digits`);
  }
}

result.masked = "*".repeat(Math.max(0, cleanCard.length - 4)) + cleanCard.slice(-4);
result.valid = errors.length === 0;

return { success: Boolean(result.valid), data: result };
```

---

## Example 7: URL Validation

Comprehensive URL validation:

```typescript
const urlRaw = String(process_input.result?.url ?? "");
const options = (process_input.result?.options ?? {}) as Record<string, unknown>;

const result: Record<string, unknown> = {
  original: urlRaw,
  valid: false,
  errors: [] as string[],
  parsed: null as Record<string, unknown> | null,
  sanitized: null as string | null,
};

const errors = result.errors as string[];
let url = urlRaw.trim();

if (!url) {
  errors.push("URL is required");
  return { success: false, data: result };
}

if (!/^https?:\/\//i.test(url)) {
  url = `https://${url}`;
}

let parsed: URL;
try {
  parsed = new URL(url);
} catch {
  errors.push("Invalid URL format");
  return { success: false, data: result };
}

result.parsed = {
  scheme: parsed.protocol.replace(":", ""),
  host: parsed.hostname,
  port: parsed.port ? Number(parsed.port) : null,
  path: parsed.pathname || "/",
  query: parsed.search ? parsed.search.slice(1) : null,
  fragment: parsed.hash ? parsed.hash.slice(1) : null,
};

const allowedSchemes = (options.allowed_schemes as string[]) ?? ["http", "https"];
if (!allowedSchemes.includes(parsed.protocol.replace(":", ""))) {
  errors.push(`Scheme must be: ${allowedSchemes.join(", ")}`);
}

if (!parsed.hostname) {
  errors.push("Host is required");
} else {
  const host = parsed.hostname;
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");

  if (options.allow_ip === false && isIp) {
    errors.push("IP addresses not allowed");
  }

  if (options.allow_localhost === false && ["localhost", "127.0.0.1", "::1"].includes(host)) {
    errors.push("Localhost not allowed");
  }

  const blacklist = (options.blacklist as string[]) ?? [];
  if (blacklist.includes(host)) {
    errors.push("Domain is blacklisted");
  }

  const whitelist = options.whitelist as string[] | undefined;
  if (whitelist && !whitelist.includes(host)) {
    errors.push("Domain not in whitelist");
  }
}

const requiredPrefix = options.required_path_prefix as string | undefined;
if (requiredPrefix && !parsed.pathname.startsWith(requiredPrefix)) {
  errors.push(`Path must start with: ${requiredPrefix}`);
}

if (errors.length === 0) {
  result.valid = true;
  result.sanitized = parsed.toString();
}

return { success: Boolean(result.valid), data: result };
```

---

## Example 8: Password Strength Validation

Check password strength:

```typescript
const password = String(process_input.result?.password ?? "");
const requirements = (process_input.result?.requirements ?? {}) as Record<string, unknown>;

const config = {
  min_length: 8,
  max_length: 128,
  require_uppercase: true,
  require_lowercase: true,
  require_numbers: true,
  require_special: true,
  min_unique_chars: 4,
  forbid_common: true,
  ...requirements,
};

const result: Record<string, unknown> = {
  valid: false,
  score: 0,
  strength: "weak",
  errors: [] as string[],
  suggestions: [] as string[],
};

const errors = result.errors as string[];
const suggestions = result.suggestions as string[];
const length = password.length;

if (length < Number(config.min_length)) {
  errors.push(`Password must be at least ${config.min_length} characters`);
}
if (length > Number(config.max_length)) {
  errors.push(`Password must not exceed ${config.max_length} characters`);
}

const hasUpper = /[A-Z]/.test(password);
const hasLower = /[a-z]/.test(password);
const hasNumber = /[0-9]/.test(password);
const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/`~]/.test(password);

if (config.require_uppercase && !hasUpper) errors.push("Password must contain at least one uppercase letter");
if (config.require_lowercase && !hasLower) errors.push("Password must contain at least one lowercase letter");
if (config.require_numbers && !hasNumber) errors.push("Password must contain at least one number");
if (config.require_special && !hasSpecial) errors.push("Password must contain at least one special character");

const uniqueChars = new Set(password.split("")).size;
if (uniqueChars < Number(config.min_unique_chars)) {
  errors.push(`Password must contain at least ${config.min_unique_chars} unique characters`);
}

if (config.forbid_common) {
  const common = ["password", "123456", "qwerty", "abc123", "password1", "letmein", "welcome", "admin"];
  if (common.includes(password.toLowerCase())) {
    errors.push("This password is too common");
  }
}

let score = 0;
score += Math.min(length * 4, 40);
score += hasUpper ? 10 : 0;
score += hasLower ? 10 : 0;
score += hasNumber ? 10 : 0;
score += hasSpecial ? 15 : 0;
score += Math.min(uniqueChars * 2, 15);

result.score = Math.min(100, score);
if (score >= 80) result.strength = "very_strong";
else if (score >= 60) result.strength = "strong";
else if (score >= 40) result.strength = "medium";
else if (score >= 20) result.strength = "weak";
else result.strength = "very_weak";

if (length < 12) suggestions.push("Consider using a longer password");
if (!hasSpecial) suggestions.push("Add special characters for more security");
if (uniqueChars < 8) suggestions.push("Use more varied characters");

result.valid = errors.length === 0;

return { success: Boolean(result.valid), data: result };
```

---

## Example 9: Batch Validation

Validate multiple records:

```typescript
const records = (process_input.result?.records ?? []) as Record<string, unknown>[];
const schema = (process_input.result?.schema ?? {}) as Record<string, Record<string, unknown>>;
const stopOnFirstError = Boolean(process_input.result?.stop_on_first_error ?? false);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/.+/i;

const results = {
  valid_count: 0,
  invalid_count: 0,
  total: records.length,
  valid_records: [] as { index: number; data: Record<string, unknown> }[],
  invalid_records: [] as { index: number; data: Record<string, unknown>; errors: Record<string, string[]> }[],
  errors_by_record: {} as Record<number, Record<string, string[]>>,
};

for (let index = 0; index < records.length; index++) {
  const record = records[index];
  const recordErrors: Record<string, string[]> = {};
  let isValid = true;

  for (const [field, rules] of Object.entries(schema)) {
    const value = record[field] ?? null;

    if (rules.required && (value === null || value === "")) {
      recordErrors[field] = ["Required"];
      isValid = false;
      continue;
    }

    if (value === null || value === "") continue;

    const type = String(rules.type ?? "string");
    let typeValid = true;
    switch (type) {
      case "string": typeValid = typeof value === "string"; break;
      case "integer":
      case "int": typeValid = Number.isFinite(Number(value)) && Number.isInteger(Number(value)); break;
      case "float":
      case "number": typeValid = Number.isFinite(Number(value)); break;
      case "boolean":
      case "bool":
        typeValid = typeof value === "boolean" || [0, 1, "0", "1", "true", "false"].includes(value as string | number);
        break;
      case "email": typeValid = EMAIL_RE.test(String(value)); break;
      case "url": typeValid = URL_RE.test(String(value)); break;
      default: typeValid = true;
    }

    if (!typeValid) {
      recordErrors[field] = [`Invalid type, expected ${type}`];
      isValid = false;
    }

    if (rules.min !== undefined && Number.isFinite(Number(value)) && Number(value) < Number(rules.min)) {
      recordErrors[field] = [...(recordErrors[field] ?? []), `Must be >= ${rules.min}`];
      isValid = false;
    }
    if (rules.max !== undefined && Number.isFinite(Number(value)) && Number(value) > Number(rules.max)) {
      recordErrors[field] = [...(recordErrors[field] ?? []), `Must be <= ${rules.max}`];
      isValid = false;
    }
    if (rules.enum && !(rules.enum as unknown[]).includes(value)) {
      recordErrors[field] = [...(recordErrors[field] ?? []), `Must be one of: ${(rules.enum as unknown[]).join(", ")}`];
      isValid = false;
    }
  }

  if (isValid) {
    results.valid_count++;
    results.valid_records.push({ index, data: record });
  } else {
    results.invalid_count++;
    results.invalid_records.push({ index, data: record, errors: recordErrors });
    results.errors_by_record[index] = recordErrors;
    if (stopOnFirstError) break;
  }
}

const allValid = results.invalid_count === 0;

return { success: allValid, data: { ...results, all_valid: allValid } };
```

---

## Best Practices

### 1. Validate Early

```typescript
if (!process_input.result?.required_field) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Missing required field" }, data: null };
}
```

### 2. Use Type-Specific Validation

```typescript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailValid = EMAIL_RE.test(String(input));
```

### 3. Sanitize Before Storage

```typescript
const clean = String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
```

### 4. Return Detailed Errors

```typescript
return {
  success: false,
  data: {
    errors: {
      field1: ["Error message 1"],
      field2: ["Error message 2"],
    },
  },
};
```

---

## See Also

- [Data Transformation & Mapping](Data_Transformation_Mapping.md)
- [String Processing & Text](String_Processing_Text.md)
- [JSON/XML/CSV Parsing](JSON_XML_CSV_Parsing.md)
