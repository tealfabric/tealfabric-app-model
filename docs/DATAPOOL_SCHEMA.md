# DataPool schema

Auth does not use DataPool sessions. Browser identity is a WebApp JWT (`webapp_access`) issued by `jwt.issueWebappAccess`.

## `app_model_items`

Structured schema for demo list/create operations.

| Field | Type | Description |
|-------|------|-------------|
| `data_id` | string | Platform-assigned row ID |
| `title` | string | Required display title |
| `description` | string | Optional body text |
| `status` | string | e.g. `draft`, `active`, `archived` |
| `owner_id` | string | Platform `user_id` of creator |
| `created_at` | string | ISO-8601 UTC |
| `updated_at` | string | ISO-8601 UTC |

Created automatically on first `create_item` call with `auto_create_schema: true`.

## `app_model_files`

File metadata index (optional companion to tenant storage).

| Field | Type | Description |
|-------|------|-------------|
| `filename` | string | Sanitized file name |
| `storage_path` | string | Path under tenant storage |
| `uploaded_by` | string | Platform `user_id` |
| `uploaded_at` | string | ISO-8601 UTC |
| `size_bytes` | number | Approximate size |

## Query examples

```sql
SELECT * FROM app_model_items WHERE status = :status ORDER BY created_at DESC LIMIT :limit
```

Use parameterized queries via `datapool.query()` in process steps — never string-concatenate user input.
