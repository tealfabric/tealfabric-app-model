# Array & Collection Operations

**TypeScript preferred** — new-sandbox. See [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

This guide covers array manipulation and collection processing within ProcessFlow code snippets.

## Overview

Array operations are fundamental for processing lists, filtering data, and aggregating results. These are **idempotent operations** that transform collections without side effects.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Input Array    │────▶│  Array Process   │────▶│  Output Array   │
│  Collection     │     │  Code Snippet    │     │  Collection     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## JavaScript/TypeScript APIs

Use native array methods: `map`, `filter`, `reduce`, `sort`, `slice`, `flat`, `find`, `some`, `every`, `includes`, `indexOf`, spread (`...`), `Object.keys`, `Object.values`, `Object.entries`, `JSON.parse` / `JSON.stringify`, and `RegExp` for pattern matching.

---

## Example 1: Filtering Arrays

Filter arrays by various criteria:

```typescript
const items = (process_input.result?.items as Record<string, unknown>[]) ?? [];
const filters = (process_input.result?.filters as Record<string, unknown>) ?? {};

if (items.length === 0) {
  return { success: true, data: { items: [], count: 0 } };
}

let filtered = [...items];

for (const [field, condition] of Object.entries(filters)) {
  let operator: string;
  let value: unknown;

  if (condition !== null && typeof condition === "object" && !Array.isArray(condition)) {
    const c = condition as Record<string, unknown>;
    operator = String(c.operator ?? "equals");
    value = c.value ?? null;
  } else {
    operator = "equals";
    value = condition;
  }

  filtered = filtered.filter((item) => {
    const itemValue = item[field] ?? null;
    const strValue = String(itemValue ?? "");
    const listValue = Array.isArray(value) ? value : [value];

    switch (operator) {
      case "equals":
        return itemValue == value;
      case "not_equals":
        return itemValue != value;
      case "greater_than":
        return Number(itemValue) > Number(value);
      case "less_than":
        return Number(itemValue) < Number(value);
      case "greater_or_equal":
        return Number(itemValue) >= Number(value);
      case "less_or_equal":
        return Number(itemValue) <= Number(value);
      case "contains":
        return strValue.toLowerCase().includes(String(value).toLowerCase());
      case "starts_with":
        return strValue.startsWith(String(value));
      case "ends_with":
        return strValue.endsWith(String(value));
      case "in":
        return listValue.includes(itemValue);
      case "not_in":
        return !listValue.includes(itemValue);
      case "is_null":
        return itemValue === null;
      case "is_not_null":
        return itemValue !== null;
      case "is_empty":
        return itemValue === null || itemValue === "" || (Array.isArray(itemValue) && itemValue.length === 0);
      case "is_not_empty":
        return itemValue !== null && itemValue !== "" && !(Array.isArray(itemValue) && itemValue.length === 0);
      default:
        return true;
    }
  });
}

return {
  success: true,
  data: {
    items: filtered,
    original_count: items.length,
    filtered_count: filtered.length,
    filters_applied: Object.keys(filters),
  },
};
```

---

## Example 2: Sorting Arrays

Sort arrays by multiple criteria:

```typescript
const items = [...((process_input.result?.items as Record<string, unknown>[]) ?? [])];
let sortBy = process_input.result?.sort_by ?? [];
const caseSensitive = Boolean(process_input.result?.case_sensitive ?? false);

if (items.length === 0) {
  return { success: true, data: { items: [] } };
}

if (typeof sortBy === "string") {
  sortBy = [{ field: sortBy, direction: "asc" }];
}

const sortRules = sortBy as { field?: string; direction?: string }[];

items.sort((a, b) => {
  for (const sort of sortRules) {
    const field = sort.field ?? String(sort);
    const direction = String(sort.direction ?? "asc").toLowerCase();

    let valA = a[field] ?? null;
    let valB = b[field] ?? null;

    if (typeof valA === "string" && typeof valB === "string" && !caseSensitive) {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA === null && valB === null) continue;
    if (valA === null) return direction === "asc" ? 1 : -1;
    if (valB === null) return direction === "asc" ? -1 : 1;

    if (valA < valB) return direction === "asc" ? -1 : 1;
    if (valA > valB) return direction === "asc" ? 1 : -1;
  }
  return 0;
});

return {
  success: true,
  data: {
    items,
    count: items.length,
    sorted_by: sortBy,
  },
};
```

---

## Example 3: Grouping Arrays

Group items by field values:

```typescript
const items = (process_input.result?.items as Record<string, unknown>[]) ?? [];
const groupBy = String(process_input.result?.group_by ?? "category");
const includeStats = Boolean(process_input.result?.include_stats ?? true);

if (items.length === 0) {
  return { success: true, data: { groups: [] } };
}

const groups: Record<string, { key: unknown; items: Record<string, unknown>[]; count?: number; sums?: Record<string, number> }> = {};

for (const item of items) {
  const keys = groupBy.split(".");
  let key: unknown = item;
  for (const k of keys) {
    key = (key as Record<string, unknown>)?.[k] ?? null;
  }

  const groupKey = key ?? "_ungrouped";
  const groupKeyStr = String(groupKey);

  if (!groups[groupKeyStr]) {
    groups[groupKeyStr] = { key: groupKey, items: [] };
  }
  groups[groupKeyStr].items.push(item);
}

if (includeStats) {
  for (const group of Object.values(groups)) {
    group.count = group.items.length;

    const numericFields: Record<string, number> = {};
    if (group.items.length > 0) {
      const firstItem = group.items[0];
      for (const [field, value] of Object.entries(firstItem)) {
        if (typeof value === "number" && !Number.isNaN(value)) {
          numericFields[field] = group.items.reduce(
            (sum, row) => sum + (Number(row[field]) || 0),
            0
          );
        }
      }
    }
    group.sums = numericFields;
  }
}

return {
  success: true,
  data: {
    groups: Object.values(groups),
    group_count: Object.keys(groups).length,
    total_items: items.length,
    grouped_by: groupBy,
  },
};
```

---

## Example 4: Array Aggregation

Aggregate array data with multiple operations:

```typescript
const items = (process_input.result?.items as Record<string, unknown>[]) ?? [];
let aggregations = (process_input.result?.aggregations as Record<string, { type?: string; field?: string }>) ?? {};

if (items.length === 0) {
  return { success: true, data: { results: {}, count: 0 } };
}

const results: Record<string, unknown> = { count: items.length };

if (Object.keys(aggregations).length === 0) {
  aggregations = { count: { type: "count" } };
}

for (const [name, config] of Object.entries(aggregations)) {
  const type = config.type ?? "count";
  const field = config.field ?? null;

  switch (type) {
    case "count":
      results[name] = items.length;
      break;

    case "sum":
      if (field) {
        const values = items.map((i) => i[field]).filter((v) => typeof v === "number");
        results[name] = values.reduce((a, b) => a + b, 0);
      }
      break;

    case "avg": {
      if (field) {
        const values = items.map((i) => i[field]).filter((v) => typeof v === "number") as number[];
        results[name] = values.length > 0
          ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10000) / 10000
          : 0;
      }
      break;
    }

    case "min": {
      if (field) {
        const values = items.map((i) => i[field]).filter((v) => typeof v === "number") as number[];
        results[name] = values.length > 0 ? Math.min(...values) : null;
      }
      break;
    }

    case "max": {
      if (field) {
        const values = items.map((i) => i[field]).filter((v) => typeof v === "number") as number[];
        results[name] = values.length > 0 ? Math.max(...values) : null;
      }
      break;
    }

    case "distinct":
      if (field) {
        const values = items.map((i) => i[field]);
        const unique = [...new Set(values)];
        results[name] = unique;
        results[`${name}_count`] = unique.length;
      }
      break;

    case "first":
      results[name] = field ? items[0]?.[field] ?? null : items[0];
      break;

    case "last": {
      const last = items[items.length - 1];
      results[name] = field ? last?.[field] ?? null : last;
      break;
    }
  }
}

return {
  success: true,
  data: {
    results,
    item_count: items.length,
  },
};
```

---

## Example 5: Array Comparison

Compare and find differences between arrays:

```typescript
const array1 = (process_input.result?.array1 as Record<string, unknown>[]) ?? [];
const array2 = (process_input.result?.array2 as Record<string, unknown>[]) ?? [];
const keyField = process_input.result?.key_field as string | undefined;

function objectDiff(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[key] !== b[key]) changes[key] = b[key];
  }
  return changes;
}

if (keyField) {
  const indexed1: Record<string, Record<string, unknown>> = {};
  const indexed2: Record<string, Record<string, unknown>> = {};

  for (const item of array1) {
    const key = item[keyField];
    if (key !== null && key !== undefined) indexed1[String(key)] = item;
  }

  for (const item of array2) {
    const key = item[keyField];
    if (key !== null && key !== undefined) indexed2[String(key)] = item;
  }

  const onlyIn1 = Object.keys(indexed1)
    .filter((k) => !(k in indexed2))
    .map((k) => indexed1[k]);
  const onlyIn2 = Object.keys(indexed2)
    .filter((k) => !(k in indexed1))
    .map((k) => indexed2[k]);
  const inBothKeys = Object.keys(indexed1).filter((k) => k in indexed2);

  const modified = inBothKeys
    .filter((key) => JSON.stringify(indexed1[key]) !== JSON.stringify(indexed2[key]))
    .map((key) => ({
      key,
      old: indexed1[key],
      new: indexed2[key],
      changes: objectDiff(indexed1[key], indexed2[key]),
    }));

  return {
    success: true,
    data: {
      only_in_first: onlyIn1,
      only_in_second: onlyIn2,
      in_both: inBothKeys.length,
      modified,
      summary: {
        added: onlyIn2.length,
        removed: onlyIn1.length,
        modified: modified.length,
        unchanged: inBothKeys.length - modified.length,
      },
    },
  };
}

const set1 = new Set(array1.map((v) => JSON.stringify(v)));
const set2 = new Set(array2.map((v) => JSON.stringify(v)));

return {
  success: true,
  data: {
    only_in_first: array1.filter((v) => !set2.has(JSON.stringify(v))),
    only_in_second: array2.filter((v) => !set1.has(JSON.stringify(v))),
    in_both: array1.filter((v) => set2.has(JSON.stringify(v))),
  },
};
```

---

## Example 6: Pagination

Paginate array data:

```typescript
const items = (process_input.result?.items as unknown[]) ?? [];
let page = Math.max(1, Number(process_input.result?.page ?? 1));
const perPage = Math.max(1, Math.min(100, Number(process_input.result?.per_page ?? 25)));

const total = items.length;
const totalPages = Math.ceil(total / perPage) || 1;
page = Math.min(page, Math.max(1, totalPages));

const offset = (page - 1) * perPage;
const pageItems = items.slice(offset, offset + perPage);

return {
  success: true,
  data: {
    items: pageItems,
    pagination: {
      current_page: page,
      per_page: perPage,
      total_items: total,
      total_pages: totalPages,
      has_previous: page > 1,
      has_next: page < totalPages,
      previous_page: page > 1 ? page - 1 : null,
      next_page: page < totalPages ? page + 1 : null,
      first_item: total > 0 ? offset + 1 : 0,
      last_item: Math.min(offset + perPage, total),
    },
  },
};
```

---

## Example 7: Array Deduplication

Remove duplicates with various strategies:

```typescript
const items = (process_input.result?.items as unknown[]) ?? [];
const strategy = String(process_input.result?.strategy ?? "first");
const keyFields = process_input.result?.key_fields as string | string[] | null;

if (items.length === 0) {
  return { success: true, data: { items: [], removed: 0 } };
}

const originalCount = items.length;

if (typeof items[0] !== "object" || items[0] === null) {
  const unique = [...new Set(items)];
  return {
    success: true,
    data: {
      items: unique,
      original_count: originalCount,
      unique_count: unique.length,
      duplicates_removed: originalCount - unique.length,
    },
  };
}

const seen: Record<string, number> = {};
const unique: Record<string, unknown>[] = [];
const duplicates: { item: unknown; duplicate_of_index: number }[] = [];
const fields = keyFields ? (Array.isArray(keyFields) ? keyFields : [keyFields]) : null;

for (let index = 0; index < items.length; index++) {
  const item = items[index] as Record<string, unknown>;
  const key = fields
    ? fields.map((f) => String(item[f] ?? "")).join("|")
    : JSON.stringify(item);

  if (key in seen) {
    duplicates.push({ item, duplicate_of_index: seen[key] });

    if (strategy === "merge") {
      const existing = unique.find((u) => u._dedup_key === key);
      if (existing) Object.assign(existing, item);
    } else if (strategy === "last") {
      const i = unique.findIndex((u) => u._dedup_key === key);
      if (i >= 0) unique[i] = { ...item, _dedup_key: key };
    }
  } else {
    seen[key] = index;
    unique.push({ ...item, _dedup_key: key });
  }
}

const cleaned = unique.map(({ _dedup_key, ...rest }) => rest);

return {
  success: true,
  data: {
    items: cleaned,
    original_count: originalCount,
    unique_count: cleaned.length,
    duplicates_removed: duplicates.length,
    strategy_used: strategy,
    key_fields: keyFields,
  },
};
```

---

## Example 8: Array Chunking and Batching

Split arrays into chunks for batch processing:

```typescript
const items = (process_input.result?.items as unknown[]) ?? [];
const chunkSize = Math.max(1, Number(process_input.result?.chunk_size ?? 10));
const includeMetadata = Boolean(process_input.result?.include_metadata ?? true);

if (items.length === 0) {
  return { success: true, data: { chunks: [], total_chunks: 0 } };
}

const chunks: unknown[][] = [];
for (let i = 0; i < items.length; i += chunkSize) {
  chunks.push(items.slice(i, i + chunkSize));
}

const result = chunks.map((chunk, index) => {
  const chunkData: Record<string, unknown> = { items: chunk };
  if (includeMetadata) {
    chunkData.metadata = {
      chunk_number: index + 1,
      chunk_size: chunk.length,
      start_index: index * chunkSize,
      end_index: index * chunkSize + chunk.length - 1,
      is_first: index === 0,
      is_last: index === chunks.length - 1,
    };
  }
  return chunkData;
});

return {
  success: true,
  data: {
    chunks: result,
    total_items: items.length,
    total_chunks: chunks.length,
    chunk_size: chunkSize,
  },
};
```

---

## Example 9: Array Flattening and Plucking

Extract specific fields or flatten nested arrays:

```typescript
const items = (process_input.result?.items as unknown[]) ?? [];
const operation = String(process_input.result?.operation ?? "pluck");
const field = process_input.result?.field;
const depth = Number(process_input.result?.depth ?? 1);

if (items.length === 0) {
  return { success: true, data: { result: [] } };
}

function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let value: unknown = obj;
  for (const key of keys) {
    value = (value as Record<string, unknown>)?.[key] ?? null;
    if (value === null) break;
  }
  return value;
}

function flattenArray(array: unknown[], currentDepth = 0): unknown[] {
  const result: unknown[] = [];
  for (const item of array) {
    if (Array.isArray(item) && (depth === -1 || currentDepth < depth)) {
      result.push(...flattenArray(item, currentDepth + 1));
    } else {
      result.push(item);
    }
  }
  return result;
}

switch (operation) {
  case "pluck": {
    if (!field) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: "Field required for pluck" }, data: null };
    }
    const fieldStr = String(field);
    const plucked = items.map((item) => getNestedValue(item, fieldStr));
    const filtered = plucked.filter((v) => v !== null);
    return {
      success: true,
      data: { result: filtered, field: fieldStr, count: plucked.length },
    };
  }

  case "flatten":
    return {
      success: true,
      data: { result: flattenArray(items), depth },
    };

  case "key_by": {
    if (!field) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: "Field required for key_by" }, data: null };
    }
    const fieldStr = String(field);
    const keyed: Record<string, unknown> = {};
    for (const item of items) {
      const key = (item as Record<string, unknown>)[fieldStr];
      if (key !== null && key !== undefined) keyed[String(key)] = item;
    }
    return {
      success: true,
      data: { result: keyed, field: fieldStr, count: Object.keys(keyed).length },
    };
  }

  case "select": {
    const fields = Array.isArray(field) ? field.map(String) : [String(field)];
    const selected = items.map((item) => {
      const row = item as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const f of fields) {
        if (f in row) out[f] = row[f];
      }
      return out;
    });
    return {
      success: true,
      data: { result: selected, fields, count: selected.length },
    };
  }

  default:
    return { success: false, error: { code: "UNKNOWN_OPERATION", message: `Unknown operation: ${operation}` }, data: null };
}
```

---

## Example 10: Array Merging and Joining

Merge arrays with various strategies:

```typescript
const arrays = (process_input.result?.arrays as unknown[][]) ?? [];
const strategy = String(process_input.result?.strategy ?? "append");
const joinField = process_input.result?.join_field as string | undefined;

if (arrays.length < 2) {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Need at least 2 arrays to merge" },
    data: null,
  };
}

function mergeRecursive(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const result = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (Array.isArray(result[key]) && Array.isArray(value)) {
      result[key] = [...(result[key] as unknown[]), ...value];
    } else if (
      result[key] !== null && typeof result[key] === "object" && !Array.isArray(result[key]) &&
      value !== null && typeof value === "object" && !Array.isArray(value)
    ) {
      result[key] = mergeRecursive(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

let result: unknown;

switch (strategy) {
  case "append":
    result = arrays.flat();
    break;

  case "merge_recursive": {
    let merged = arrays[0] as Record<string, unknown>;
    for (let i = 1; i < arrays.length; i++) {
      merged = mergeRecursive(merged, arrays[i] as Record<string, unknown>);
    }
    result = merged;
    break;
  }

  case "replace": {
    result = { ...(arrays[0] as Record<string, unknown>) };
    for (let i = 1; i < arrays.length; i++) {
      result = { ...(result as Record<string, unknown>), ...(arrays[i] as Record<string, unknown>) };
    }
    break;
  }

  case "left_join": {
    if (!joinField) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: "join_field required" }, data: null };
    }
    const left = arrays[0] as Record<string, unknown>[];
    const right: Record<string, Record<string, unknown>> = {};

    for (let i = 1; i < arrays.length; i++) {
      for (const item of arrays[i] as Record<string, unknown>[]) {
        const key = item[joinField];
        if (key !== null && key !== undefined) {
          const k = String(key);
          right[k] = { ...(right[k] ?? {}), ...item };
        }
      }
    }

    result = left.map((leftItem) => {
      const key = leftItem[joinField];
      const k = key !== null && key !== undefined ? String(key) : null;
      return k && right[k] ? { ...leftItem, ...right[k] } : leftItem;
    });
    break;
  }

  case "intersect": {
    const first = arrays[0] as unknown[];
    const serialized = first.map((v) => JSON.stringify(v));
    result = first.filter((v, i) =>
      arrays.slice(1).every((arr) => (arr as unknown[]).some((x) => JSON.stringify(x) === serialized[i]))
    );
    break;
  }

  case "union": {
    const all = arrays.flat();
    const seen = new Set<string>();
    result = all.filter((v) => {
      const s = JSON.stringify(v);
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
    break;
  }

  default:
    return { success: false, error: { code: "UNKNOWN_STRATEGY", message: `Unknown strategy: ${strategy}` }, data: null };
}

const count = Array.isArray(result) ? result.length : Object.keys(result as object).length;

return {
  success: true,
  data: {
    result,
    count,
    strategy,
    input_arrays: arrays.length,
  },
};
```

---

## Best Practices

### 1. Always Return Array Values

```typescript
// Reset indices after filtering
const filtered = items.filter(callback);
```

### 2. Handle Empty Arrays

```typescript
if (items.length === 0) {
  return { success: true, data: { items: [] } };
}
```

### 3. Use Type-Safe Comparisons

```typescript
// Use === for exact matching
const exists = array.includes(value);
```

### 4. Avoid Modifying During Iteration

```typescript
// Good: create new array
const result = items.map((item) => transform(item));
```

---

## See Also

- [Data Transformation & Mapping](Data_Transformation_Mapping.md)
- [Data Validation & Sanitization](Data_Validation_Sanitization.md)
- [Mathematical & Statistical Calculations](Math_Statistics.md)
