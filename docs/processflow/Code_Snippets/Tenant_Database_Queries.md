# Tenant Database Queries

This guide covers database operations within ProcessFlow code snippets using the tenant-scoped database service. **TypeScript preferred** — see [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

## Overview

The `tenantDb` service provides secure, tenant-isolated database access. All queries are automatically scoped to the current tenant, preventing cross-tenant data access.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Code Snippet   │────▶│   tenantDb       │────▶│  Tenant Data    │
│  Query          │     │   Service        │     │  (Isolated)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Available Services

| Variable | Type | Description |
|----------|------|-------------|
| `tenantDb` | TenantDatabaseService | **Recommended** — auto-scoped queries |
| `tenant_id` | string | Current tenant ID |

> Raw database drivers are **not** available in standard tenant context. Use `tenantDb` or `tf.dataAccess`.

## TenantDatabaseService Methods

| Method | Description |
|--------|-------------|
| `getOne(sql, params)` | Single row or `null` |
| `query(sql, params)` | Multiple rows |
| `insert(table, data)` | INSERT with auto `tenant_id` |
| `update(table, data, where)` | UPDATE with auto tenant scoping |

Requires **`data-access`** capability when sandbox capabilities are explicitly restricted.

---

## Example 1: Basic Select Query

Retrieve records from a table:

```typescript
const tableName = String(process_input.result?.table ?? "");
const conditions = (process_input.result?.conditions ?? {}) as Record<string, unknown>;
const options = process_input.result?.options ?? {};

if (!tableName) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Table name required" }, data: null };
}

try {
  const params: unknown[] = [];
  const whereParts: string[] = [];
  for (const [col, val] of Object.entries(conditions)) {
    whereParts.push(`\`${col}\` = ?`);
    params.push(val);
  }
  const whereClause = whereParts.length ? ` WHERE ${whereParts.join(" AND ")}` : "";
  const limit = Number(options.limit ?? 100);
  const offset = Number(options.offset ?? 0);
  const orderBy = options.order_by as string | undefined;

  let sql = `SELECT * FROM \`${tableName}\`${whereClause}`;
  if (orderBy) {
    sql += ` ORDER BY ${orderBy}`;
  }
  sql += " LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await tenantDb.query(sql, params);

  return {
    success: true,
    data: {
      records: result,
      count: result.length,
      table: tableName,
    },
  };
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Database query failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 2: Custom SQL Query

Execute custom SQL with parameters:

```typescript
const customQuery = String(process_input.result?.query ?? "");
const params = (process_input.result?.params ?? []) as unknown[];

if (!customQuery) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Query required" }, data: null };
}

try {
  const result = await tenantDb.query(customQuery, params);

  return {
    success: true,
    data: {
      records: result,
      count: result.length,
    },
  };
} catch (e) {
  tf.log("error", "Query failed", { message: e instanceof Error ? e.message : String(e) });
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Query execution failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 3: Insert Record

Insert a new record:

```typescript
const tableName = String(process_input.result?.table ?? "");
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;

if (!tableName || Object.keys(data).length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Table and data required" }, data: null };
}

try {
  const insertId = await tenantDb.insert(tableName, data);

  tf.log("info", "Inserted record", { table: tableName, insertId });

  return {
    success: true,
    data: {
      insert_id: insertId,
      table: tableName,
    },
  };
} catch (e) {
  tf.log("error", "Insert failed", { message: e instanceof Error ? e.message : String(e) });
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Insert failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 4: Update Records

Update existing records:

```typescript
const tableName = String(process_input.result?.table ?? "");
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;
const conditions = (process_input.result?.conditions ?? {}) as Record<string, unknown>;

if (!tableName || Object.keys(data).length === 0 || Object.keys(conditions).length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Table, data, and conditions required" }, data: null };
}

try {
  const affectedRows = await tenantDb.update(tableName, data, conditions);

  tf.log("info", "Updated rows", { table: tableName, affectedRows });

  return {
    success: true,
    data: {
      affected_rows: affectedRows,
      table: tableName,
    },
  };
} catch (e) {
  tf.log("error", "Update failed", { message: e instanceof Error ? e.message : String(e) });
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Update failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 5: Delete Records

Delete records (with safety checks):

```typescript
const tableName = String(process_input.result?.table ?? "");
const conditions = (process_input.result?.conditions ?? {}) as Record<string, unknown>;
const confirmDelete = Boolean(process_input.result?.confirm_delete);

if (!tableName || Object.keys(conditions).length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Table and conditions required" }, data: null };
}

const params: unknown[] = [];
const whereParts: string[] = [];
for (const [col, val] of Object.entries(conditions)) {
  whereParts.push(`\`${col}\` = ?`);
  params.push(val);
}
const whereClause = ` WHERE ${whereParts.join(" AND ")}`;

if (!confirmDelete) {
  const countResult = await tenantDb.query(
    `SELECT COUNT(*) as total FROM \`${tableName}\`${whereClause}`,
    params
  );
  const count = Number((countResult[0] as { total?: number })?.total ?? 0);

  return {
    success: false,
    route: "confirm_delete",
    data: {
      records_to_delete: count,
      table: tableName,
      conditions,
      message: "Set confirm_delete=true to proceed",
    },
  };
}

try {
  const deleteResult = await tenantDb.query(
    `DELETE FROM \`${tableName}\`${whereClause}`,
    params
  );
  const deletedRows = Array.isArray(deleteResult) ? deleteResult.length : 0;

  tf.log("info", "Deleted rows", { table: tableName, deletedRows });

  return {
    success: true,
    data: {
      deleted_rows: deletedRows,
      table: tableName,
    },
  };
} catch (e) {
  tf.log("error", "Delete failed", { message: e instanceof Error ? e.message : String(e) });
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Delete failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 6: Aggregation Queries

Perform aggregation operations:

```typescript
const tableName = String(process_input.result?.table ?? "");
const aggregation = String(process_input.result?.aggregation ?? "count");
const field = String(process_input.result?.field ?? "*");
const conditions = (process_input.result?.conditions ?? {}) as Record<string, unknown>;
const groupBy = process_input.result?.group_by as string | undefined;

if (!tableName) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Table name required" }, data: null };
}

const aggFunctions = ["count", "sum", "avg", "min", "max"];
if (!aggFunctions.includes(aggregation)) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid aggregation function" }, data: null };
}

try {
  const aggField = field === "*" ? "*" : `\`${field}\``;
  let selectClause = `${aggregation.toUpperCase()}(${aggField}) as result`;
  if (groupBy) {
    selectClause = `\`${groupBy}\`, ${selectClause}`;
  }

  const params: unknown[] = [];
  const whereParts: string[] = [];
  for (const [col, val] of Object.entries(conditions)) {
    whereParts.push(`\`${col}\` = ?`);
    params.push(val);
  }
  const whereClause = whereParts.length ? ` WHERE ${whereParts.join(" AND ")}` : "";

  let sql = `SELECT ${selectClause} FROM \`${tableName}\`${whereClause}`;
  if (groupBy) {
    sql += ` GROUP BY \`${groupBy}\``;
  }

  const result = await tenantDb.query(sql, params);

  if (groupBy) {
    return {
      success: true,
      data: {
        results: result,
        aggregation,
        grouped_by: groupBy,
      },
    };
  }

  return {
    success: true,
    data: {
      result: (result[0] as { result?: number })?.result ?? 0,
      aggregation,
      field,
      table: tableName,
    },
  };
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Aggregation failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 7: Join Queries

Perform JOIN operations:

```typescript
const mainTable = String(process_input.result?.main_table ?? "");
const joins = (process_input.result?.joins ?? []) as Array<{
  type?: string;
  table: string;
  on: string;
}>;
const conditions = (process_input.result?.conditions ?? {}) as Record<string, unknown>;
const columns = (process_input.result?.columns ?? ["*"]) as string[];

if (!mainTable || joins.length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Main table and joins required" }, data: null };
}

try {
  const selectClause = columns.join(", ");
  const joinClause = joins
    .map((join) => {
      const type = (join.type ?? "LEFT").toUpperCase();
      return `${type} JOIN \`${join.table}\` ON ${join.on}`;
    })
    .join(" ");

  const params: unknown[] = [];
  const whereParts: string[] = [];
  for (const [col, val] of Object.entries(conditions)) {
    whereParts.push(`${col} = ?`);
    params.push(val);
  }
  const whereClause = whereParts.length ? ` WHERE ${whereParts.join(" AND ")}` : "";

  const sql = `SELECT ${selectClause} FROM \`${mainTable}\` ${joinClause}${whereClause}`;

  tf.log("debug", "Executing join query", { sql });

  const result = await tenantDb.query(sql, params);

  return {
    success: true,
    data: {
      records: result,
      count: result.length,
    },
  };
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Join query failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 8: Batch Insert

Insert multiple records efficiently:

```typescript
const tableName = String(process_input.result?.table ?? "");
const records = (process_input.result?.records ?? []) as Record<string, unknown>[];

if (!tableName || records.length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Table and records required" }, data: null };
}

let insertedCount = 0;
const errors: Array<{ index: number; error: { code: string; message: string } }> = [];

for (let index = 0; index < records.length; index++) {
  try {
    await tenantDb.insert(tableName, records[index]);
    insertedCount++;
  } catch (e) {
    errors.push({
      index,
      error: { code: "RUNTIME_ERROR", message: e instanceof Error ? e.message : String(e) },
    });
  }
}

tf.log("info", "Batch insert complete", {
  table: tableName,
  insertedCount,
  total: records.length,
});

return {
  success: errors.length === 0,
  data: {
    inserted_count: insertedCount,
    total_records: records.length,
    errors,
    table: tableName,
  },
};
```

---

## Example 9: Search with Pagination

Search with filtering and pagination:

```typescript
const tableName = String(process_input.result?.table ?? "");
const searchFields = (process_input.result?.search_fields ?? []) as string[];
const searchTerm = String(process_input.result?.search_term ?? "");
const filters = (process_input.result?.filters ?? {}) as Record<string, unknown>;
const page = Math.max(1, Number(process_input.result?.page ?? 1));
const perPage = Math.min(100, Math.max(1, Number(process_input.result?.per_page ?? 25)));
const orderBy = String(process_input.result?.order_by ?? "created_at");
let orderDir = String(process_input.result?.order_dir ?? "DESC").toUpperCase();

if (!tableName) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Table name required" }, data: null };
}

try {
  const offset = (page - 1) * perPage;
  const whereParts: string[] = [];
  const params: unknown[] = [];

  if (searchTerm && searchFields.length > 0) {
    const searchParts = searchFields.map((field) => {
      params.push(`%${searchTerm}%`);
      return `\`${field}\` LIKE ?`;
    });
    whereParts.push(`(${searchParts.join(" OR ")})`);
  }

  for (const [field, value] of Object.entries(filters)) {
    if (value === null) {
      whereParts.push(`\`${field}\` IS NULL`);
    } else if (Array.isArray(value)) {
      const placeholders = value.map(() => "?").join(",");
      whereParts.push(`\`${field}\` IN (${placeholders})`);
      params.push(...value);
    } else {
      whereParts.push(`\`${field}\` = ?`);
      params.push(value);
    }
  }

  const whereClause = whereParts.length ? ` WHERE ${whereParts.join(" AND ")}` : "";

  const countResult = await tenantDb.query(
    `SELECT COUNT(*) as total FROM \`${tableName}\`${whereClause}`,
    params
  );
  const total = Number((countResult[0] as { total?: number })?.total ?? 0);

  orderDir = orderDir === "ASC" || orderDir === "DESC" ? orderDir : "DESC";
  const pageParams = [...params, perPage, offset];
  const records = await tenantDb.query(
    `SELECT * FROM \`${tableName}\`${whereClause} ORDER BY \`${orderBy}\` ${orderDir} LIMIT ? OFFSET ?`,
    pageParams
  );

  const totalPages = Math.ceil(total / perPage);

  return {
    success: true,
    data: {
      records,
      pagination: {
        current_page: page,
        per_page: perPage,
        total_items: total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_previous: page > 1,
      },
    },
  };
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Search failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Example 10: Upsert (Insert or Update)

Insert or update based on unique key:

```typescript
const tableName = String(process_input.result?.table ?? "");
const data = (process_input.result?.data ?? {}) as Record<string, unknown>;
const uniqueKeys = (process_input.result?.unique_keys ?? []) as string[];

if (!tableName || Object.keys(data).length === 0 || uniqueKeys.length === 0) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Table, data, and unique_keys required" }, data: null };
}

try {
  const conditions: Record<string, unknown> = {};
  for (const key of uniqueKeys) {
    if (data[key] === undefined) {
      return { success: false, error: { code: "VALIDATION_ERROR", message: `Missing unique key value: ${key}` }, data: null };
    }
    conditions[key] = data[key];
  }

  const params: unknown[] = [];
  const whereParts: string[] = [];
  for (const [col, val] of Object.entries(conditions)) {
    whereParts.push(`\`${col}\` = ?`);
    params.push(val);
  }

  const existing = await tenantDb.getOne(
    `SELECT * FROM \`${tableName}\` WHERE ${whereParts.join(" AND ")} LIMIT 1`,
    params
  );

  if (existing) {
    const affectedRows = await tenantDb.update(tableName, data, conditions);

    tf.log("info", "Updated existing record", { table: tableName });

    return {
      success: true,
      data: {
        action: "update",
        affected_rows: affectedRows,
        table: tableName,
      },
    };
  }

  const insertId = await tenantDb.insert(tableName, data);

  tf.log("info", "Inserted new record", { table: tableName, insertId });

  return {
    success: true,
    data: {
      action: "insert",
      insert_id: insertId,
      table: tableName,
    },
  };
} catch (e) {
  return {
    success: false,
    error: { code: "RUNTIME_ERROR", message: `Upsert failed: ${e instanceof Error ? e.message : String(e)}` },
    data: null,
  };
}
```

---

## Security Considerations

### Important Security Notes

1. **Always use `tenantDb`** — it automatically adds `tenant_id` to tenant-scoped operations
2. **Use parameterized queries** — never concatenate user input into SQL
3. **Validate table names** — whitelist allowed tables if accepting dynamic input
4. **Limit query scope** — always use conditions to limit affected rows

```typescript
// Good — parameterized
await tenantDb.getOne("SELECT * FROM users WHERE email = ?", [email]);

// Bad — SQL injection risk
await tenantDb.query(`SELECT * FROM users WHERE email = '${email}'`);
```

### Allowed Tables

The tenant database service only allows queries on tenant-scoped tables. System tables like `Tenants`, `SubscriptionPlans` are protected.

---

## Best Practices

### 1. Handle Errors Gracefully

```typescript
try {
  const result = await tenantDb.query(sql, params);
  return { success: true, data: result };
} catch (e) {
  tf.log("error", "Database error", { message: e instanceof Error ? e.message : String(e) });
  return { success: false, error: { code: "RUNTIME_ERROR", message: e instanceof Error ? e.message : String(e) }, data: null };
}
```

### 2. Log Important Operations

```typescript
tf.log("info", "Inserted record", { insertId, tableName });
```

### 3. Use Transactions for Multi-Step Operations

Multi-step writes should be coordinated across process steps or platform APIs when atomic transactions are required.

### 4. Validate Input Before Queries

```typescript
if (!tableName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
  return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid table name" }, data: null };
}
```

---

## See Also

- [Integration Connector Usage](Integration_Connectors.md)
- [Data Validation & Sanitization](Data_Validation_Sanitization.md)
