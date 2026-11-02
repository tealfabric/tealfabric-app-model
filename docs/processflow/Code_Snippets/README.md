# Code Snippets — Category Guides

Category-specific examples for ProcessFlow steps. **All guides use TypeScript** for `new-sandbox` execution.

## Language policy

| Language | Status |
|----------|--------|
| **TypeScript** | **Preferred** — `new-sandbox` (Node VM) |
| **JavaScript** | Supported — same sandbox as TypeScript |

When authoring steps:

1. Use [../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md) for APIs and capabilities.
2. Prefer `tf.*` over root globals.
3. Use `api.get` / `api.post` / `api.put` (no `api.delete`). Prefer `tf.api` in new code.
4. Prefer `tf.process.execute` for process-to-process calls.
5. Use `files.read` / `files.write` / `files.list` for execution uploads.
6. Tenant file helpers: prefer unprefixed names (`file_put_contents`, `mkdir`, …); `$`-prefixed aliases exist for migration.
7. Prefer structured error objects: `{ code, message }` with `success: false` and `data: null`.
8. Use `notification.send` / `dispatch` (not `createAdminNotification`).
9. Start from [../../reference/cursor-process-step-code-snippet_prototype.ts](../../reference/cursor-process-step-code-snippet_prototype.ts).

## Guides

| Guide | Topics |
|-------|--------|
| [Array_Collection_Operations.md](Array_Collection_Operations.md) | map, filter, reduce, grouping |
| [Conditional_Logic_Routing.md](Conditional_Logic_Routing.md) | branching, routing output |
| [Data_Transformation_Mapping.md](Data_Transformation_Mapping.md) | reshape, merge, normalize |
| [Data_Validation_Sanitization.md](Data_Validation_Sanitization.md) | schema validation, sanitization |
| [Date_Time_Operations.md](Date_Time_Operations.md) | Date, Intl, timestamps |
| [Email_MIME_Parsing.md](Email_MIME_Parsing.md) | inline MIME parsing (no external libs) |
| [Email_Sending.md](Email_Sending.md) | `email.send`, HTML templates |
| [File_Operations.md](File_Operations.md) | uploads + tenantdata files |
| [Integration_Connectors.md](Integration_Connectors.md) | `integration.executeSync` |
| [JSON_XML_CSV_Parsing.md](JSON_XML_CSV_Parsing.md) | parse structured data |
| [LLM_Integration.md](LLM_Integration.md) | `tf.llm.callLLM` / `complete` |
| [LLM_Summarizer.md](LLM_Summarizer.md) | structured summaries |
| [Math_Statistics.md](Math_Statistics.md) | calculations, aggregates |
| [Notifications.md](Notifications.md) | in-app + email notifications |
| [Process_Communication.md](Process_Communication.md) | API calls, async triggers |
| [String_Processing_Text.md](String_Processing_Text.md) | text manipulation |
| [Tenant_Database_Queries.md](Tenant_Database_Queries.md) | `tenantDb` patterns |
| [Webhook_Calls.md](Webhook_Calls.md) | inbound/outbound webhooks |
