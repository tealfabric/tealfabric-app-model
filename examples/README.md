# Examples — Shared ProcessFlow Code Snippets

Reference implementations for **interface v1** (`INTERFACE_VERSION`, `docs/processflow/interface/v1/`). App BFF handlers live under `backend/tenants/_template/snippets/`; tenant-specific production code under `backend/tenants/tenant-<id>/snippets/`.

## Language policy

| Extension | Runtime |
|-----------|---------|
| `.ts` | **Preferred** — `new-sandbox` (Node VM) |
| `.js` | Supported — `new-sandbox` |

All examples in this directory are TypeScript.

## Categories

| Directory | Description | Files |
|-----------|-------------|--------|
| **webapps/** | WebApp ↔ ProcessFlow envelope + form handler | `README.md` (envelope contract), `process-step-webapp-form-handler.ts` |
| **workflow/** | Async process trigger (WebApp stub) | `process-step-trigger-async-process.ts` |
| **notifications/** | Mattermost, user email | `process-step-notify-mattermost.ts`, `process-step-notify-user-email.ts` |
| **integrations/** | GitLab issue fetch and LLM analysis | `process-step-fetch-gitlab-issue.ts`, `process-step-analyze-gitlab-issue.ts` |
| **webhooks/** | WebApp API router with JWT allowlist | `webapp-api-router-process-template.ts` |
| **data-processing/** | Error aggregation, MIME attachment parsing | `collect-process-and-integration-errors.ts`, `parse_attachments_from_imap_emails.ts` |
| **llm/** | Structured LLM summary | `process-step-llm-summary.ts` |

## Capabilities

Match process step capabilities to what each snippet uses:

| Snippet | Typical capabilities |
|---------|---------------------|
| Error collection | `data-access`, `file` |
| MIME parsing | `file`, `logging` |
| GitLab / email / Mattermost | `connector` |
| LLM analyze / summary | `connector`, `llm` |
| WebApp form handler | `logging` |
| WebApp router | `api` |
| Async trigger | `api` |

See [docs/processflow/PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md](../docs/processflow/PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md).

## Usage

1. Start from [reference/cursor-process-step-code-snippet_prototype.ts](../reference/cursor-process-step-code-snippet_prototype.ts).
2. Copy snippet **body** into a process step in the platform UI, or deploy via API/MCP.
3. Replace placeholder integration IDs (`fill-integration-id-here`) during deployment.
4. Set step language to **TypeScript** and enable required capabilities.
