# Data Transformation & Mapping

**TypeScript preferred** — new-sandbox. See [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

This guide covers techniques for transforming and mapping data structures within ProcessFlow code snippets. The step contract uses **`process_input`** for data from the previous step ([interface v1](../interface/v1/variables.md)). In the examples below, local variables are used as shorthand for `process_input.result` (or `process_input`) where the step receives a nested payload.

## Overview

Data transformation is one of the most common operations in ProcessFlow. These are **idempotent operations** — they take input data and produce output data without side effects, making them safe and predictable.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Input Data    │────▶│  Transformation  │────▶│  Output Data    │
│   (JSON/Array)  │     │    Code Snippet  │     │   (JSON/Array)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Available Context Variables

| Variable | Type | Description |
|----------|------|-------------|
| `process_input` | object | Input data from previous step |
| `tenant_id` | string | Current tenant ID |
| `user_id` | string | Executing user ID |
| `tf.log` | function | Structured logging (`debug` \| `info` \| `warn` \| `error`) |

## JavaScript/TypeScript APIs

Use native methods: `map`, `filter`, `reduce`, `Object.keys`, `Object.entries`, `JSON.parse`, `JSON.stringify`, `String` methods (`trim`, `toLowerCase`, `replace`), `Number`, `RegExp`, `Date`, and spread (`...`) for merging.

---

## Example 1: Field Mapping (Rename Keys)

Transform field names from one format to another:

```typescript
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;

if (Object.keys(data).length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "No input data" }, data: null };
}

const fieldMap: Record<string, string> = {
  firstName: "first_name",
  lastName: "last_name",
  emailAddress: "email",
  phoneNumber: "phone",
  companyName: "company",
  jobTitle: "position",
};

const transformed: Record<string, unknown> = {};
for (const [source, target] of Object.entries(fieldMap)) {
  if (source in data) {
    transformed[target] = data[source];
  }
}

for (const [key, value] of Object.entries(data)) {
  if (!(key in fieldMap) && !(key in transformed)) {
    transformed[key] = value;
  }
}

return { success: true, data: transformed };
```

---

## Example 2: Batch Field Mapping (Multiple Records)

Transform an array of records:

```typescript
const records = (process_input.result?.records ?? []) as Record<string, unknown>[];

if (records.length === 0) {
  return { success: true, data: { records: [], count: 0 } };
}

const fieldMap: Record<string, string> = {
  id: "customer_id",
  name: "customer_name",
  email: "contact_email",
  created: "registration_date",
};

const transformed = records.map((record) => {
  const result: Record<string, unknown> = {};
  for (const [source, target] of Object.entries(fieldMap)) {
    result[target] = record[source] ?? null;
  }
  return result;
});

return {
  success: true,
  data: {
    records: transformed,
    count: transformed.length,
  },
};
```

---

## Example 3: Flatten Nested Structure

Convert nested data to flat structure:

```typescript
/**
 * Input:
 * {
 *   user: {
 *     profile: { name: "John", age: 30 },
 *     contact: { email: "john@example.com", phone: "123" }
 *   }
 * }
 *
 * Output:
 * {
 *   user_profile_name: "John",
 *   user_profile_age: 30,
 *   user_contact_email: "john@example.com",
 *   user_contact_phone: "123"
 * }
 */

const data = (process_input.result?.data ?? {}) as Record<string, unknown>;

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flatten(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

const flattened = flatten(data);

return { success: true, data: flattened };
```

---

## Example 4: Unflatten to Nested Structure

Convert flat keys back to nested structure:

```typescript
/**
 * Input: { user_name: "John", user_email: "john@ex.com", address_city: "NYC" }
 * Output: { user: { name: "John", email: "john@ex.com" }, address: { city: "NYC" } }
 */

const data = (process_input.result?.data ?? {}) as Record<string, unknown>;

function unflatten(obj: Record<string, unknown>, delimiter = "_"): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split(delimiter);
    let current = result;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = value;
      } else {
        if (!(part in current) || typeof current[part] !== "object") {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
    }
  }
  return result;
}

const nested = unflatten(data);

return { success: true, data: nested };
```

---

## Example 5: Data Type Conversion

Convert and normalize data types:

```typescript
const record = (process_input.result?.record ?? {}) as Record<string, unknown>;

const typeSpec: Record<string, string> = {
  id: "int",
  name: "string",
  price: "float",
  quantity: "int",
  is_active: "bool",
  tags: "array",
  created_at: "datetime",
};

function parseBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return null;
}

const converted: Record<string, unknown> = {};

for (const [field, type] of Object.entries(typeSpec)) {
  const value = record[field] ?? null;

  if (value === null) {
    converted[field] = null;
    continue;
  }

  switch (type) {
    case "int":
      converted[field] = Number.parseInt(String(value), 10);
      break;
    case "float":
      converted[field] = Number.parseFloat(String(value));
      break;
    case "string":
      converted[field] = String(value).trim();
      break;
    case "bool": {
      const b = parseBool(value);
      converted[field] = b;
      break;
    }
    case "array":
      converted[field] = Array.isArray(value) ? value : [value];
      break;
    case "datetime": {
      const d = typeof value === "number" ? new Date(value * 1000) : new Date(String(value));
      converted[field] = d.toISOString().replace("T", " ").slice(0, 19);
      break;
    }
    default:
      converted[field] = value;
  }
}

return { success: true, data: converted };
```

---

## Example 6: Merge Multiple Data Sources

Combine data from different sources:

```typescript
const customer = (process_input.result?.customer ?? {}) as Record<string, unknown>;
const orders = (process_input.result?.orders ?? []) as Record<string, unknown>[];
const preferences = process_input.result?.preferences ?? {};

const merged = {
  customer_id: customer.id ?? null,
  profile: {
    name: customer.name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
  },
  order_summary: {
    total_orders: orders.length,
    total_value: orders.reduce((sum, o) => sum + Number(o.total ?? 0), 0),
    last_order_date: orders.length > 0
      ? orders.reduce((max, o) => String(o.created_at ?? "") > max ? String(o.created_at) : max, "")
      : null,
  },
  preferences,
  merged_at: new Date().toISOString().replace("T", " ").slice(0, 19),
};

return { success: true, data: merged };
```

---

## Example 7: Conditional Field Mapping

Map fields based on conditions:

```typescript
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;
const sourceType = String(process_input.result?.source_type ?? "default");

const mappings: Record<string, Record<string, string>> = {
  shopify: {
    order_id: "id",
    order_number: "name",
    order_total: "total_price",
    customer_email: "email",
  },
  woocommerce: {
    order_id: "id",
    order_number: "number",
    order_total: "total",
    customer_email: "billing.email",
  },
  default: {
    order_id: "id",
    order_number: "order_number",
    order_total: "total",
    customer_email: "email",
  },
};

const fieldMap = mappings[sourceType] ?? mappings.default;

function getValue(obj: Record<string, unknown>, path: string): unknown {
  let value: unknown = obj;
  for (const key of path.split(".")) {
    if (value === null || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[key];
    if (value === undefined) return null;
  }
  return value;
}

const transformed: Record<string, unknown> = {};
for (const [target, source] of Object.entries(fieldMap)) {
  transformed[target] = getValue(data, source);
}

return {
  success: true,
  data: {
    source_type: sourceType,
    transformed,
  },
};
```

---

## Example 8: Array Restructuring

Convert between different array structures:

```typescript
const input = (process_input.result ?? {}) as Record<string, unknown>;
const operation = String(input.operation ?? "to_objects");
const data = input.data ?? [];

if (operation === "to_objects") {
  const result = Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
    key,
    value,
  }));
  return { success: true, data: result };
}

if (operation === "to_map") {
  const result: Record<string, unknown> = {};
  for (const item of data as Record<string, unknown>[]) {
    if ("key" in item) {
      result[String(item.key)] = item.value ?? null;
    }
  }
  return { success: true, data: result };
}

if (operation === "group_by") {
  const groupField = String(input.group_by ?? "category");
  const result: Record<string, unknown[]> = {};
  for (const item of data as Record<string, unknown>[]) {
    const key = String(item[groupField] ?? "unknown");
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return { success: true, data: result };
}

return { success: false, error: { code: "UNKNOWN_OPERATION", message: "Unknown operation" }, data: null };
```

---

## Example 9: Data Enrichment

Add calculated fields to existing data:

```typescript
const orders = (process_input.result?.orders ?? []) as Record<string, unknown>[];

const enriched = orders.map((order) => {
  const subtotal = Number(order.subtotal ?? 0);
  const tax = Number(order.tax ?? 0);
  const shipping = Number(order.shipping ?? 0);
  const discount = Number(order.discount ?? 0);
  const cost = Number(order.cost ?? 0);

  const total = subtotal + tax + shipping - discount;
  const marginPercent = subtotal > 0 ? Math.round(((subtotal - cost) / subtotal) * 10000) / 100 : 0;

  return {
    ...order,
    calculated_total: Math.round(total * 100) / 100,
    margin_percent: marginPercent,
    has_discount: discount > 0,
    is_free_shipping: shipping === 0,
    processed_at: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
});

const totalValue = enriched.reduce((sum, o) => sum + Number(o.calculated_total ?? 0), 0);
const avgMargin = enriched.length > 0
  ? Math.round(enriched.reduce((sum, o) => sum + Number(o.margin_percent ?? 0), 0) / enriched.length * 100) / 100
  : 0;

return {
  success: true,
  data: {
    orders: enriched,
    summary: {
      count: enriched.length,
      total_value: totalValue,
      avg_margin: avgMargin,
    },
  },
};
```

---

## Best Practices

### 1. Always Validate Input

```typescript
if (!process_input.result?.data) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Missing required input: data" }, data: null };
}
```

### 2. Handle Missing Fields Gracefully

```typescript
const value = data.field ?? "default_value";
```

### 3. Log Important Transformations

```typescript
tf.log("info", `Transformed ${records.length} records`);
```

### 4. Return Consistent Output Structure

```typescript
return {
  success: true,
  data: { ... },
  metadata: {
    input_count: inputCount,
    output_count: outputCount,
    transformed_at: new Date().toISOString(),
  },
};
```

### 5. Keep Transformations Pure

- Don't modify input data directly
- Don't make API calls or database queries
- Don't use file operations for pure transformations

---

## Common Pitfalls

| Issue | Solution |
|-------|----------|
| Modifying nested arrays | Use recursive functions or spread/clone data first |
| Type mismatches | Explicitly convert types before operations |
| Missing array keys | Use nullish coalescing (`??`) |
| Performance with large arrays | Use chunk processing |

---

## See Also

- [Array & Collection Operations](Array_Collection_Operations.md)
- [Data Validation & Sanitization](Data_Validation_Sanitization.md)
- [JSON/XML/CSV Parsing](JSON_XML_CSV_Parsing.md)
