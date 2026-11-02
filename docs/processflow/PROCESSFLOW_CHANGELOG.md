# Changelog — Process Flow Snippets Repository

Repository and content changelog. For **interface** (contract) changes, see `docs/interface/CHANGELOG.md`.

## [Unreleased]

### Changed

- Docs/examples prefer TypeScript naming for tenant file helpers (unprefixed `file_put_contents`, `mkdir`, …); `$`-prefixed aliases noted for migration only.

## [1.0.4] — 2026-11-02 — platform sandbox sync

### Changed

- Interface bumped to **1.0.4** (`INTERFACE_VERSION`, `spec/v1/step-contract.json`, `docs/interface/CHANGELOG.md`).
- Documented `tf.process`, `tf.operations`, `tf.image.thumbnail`, `tf.sleep`/`tf.wait`, `api.put`, `jwt.issueWebappAccess`.
- Clarified dual tenant file helpers (`file_*` / `$file_*`) vs execution-scoped `files.*`.
- Prefer `tf.process.execute` for process-to-process (examples/workflow + Process_Communication).
- Category guides: structured `{ code, message }` errors; removed `llm.callLLMStream`; outbound webhooks via connectors.
- Root/docs READMEs and compatibility matrix aligned with current `dev.tealfabric.io` sandbox.

## [1.0.3] — 2026-06-18 — backend-next / public docs alignment

### Added

- `docs/PROCESSFLOW_SANDBOX_TF_API.md` — full `tf` namespace reference (capabilities, services, async integration, troubleshooting).

### Changed

- `interface/v1/services.md` — `tf.capabilities`, `hmacSha256`, `files.write`, integration `getResult`/`cancel`, datapool timeseries/virtual, OCR, document review, JWT, keystore.
- `interface/v1/variables.md` — `process_output`, `execution_auth_source_id`, correlation ids, `/root` handles, OCR/document services.
- `PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md` — guardrails aligned with public sandbox doc (fetch, child_process, process.env, timeout bounds).
- `PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md` — internal HTTP context requirements, integration async API, `tf` cross-links.
- `interface/v1/return-format.md` — fix `error` type (object, not array).

## [Unreleased prior]

- TypeScript examples for all integration, notification, webhook, data-processing, and llm categories.
- Expanded `reference/cursor-process-step-code-snippet_prototype.ts` with LLM, email, file, and async patterns.

### Changed

- All `docs/Code_Snippets/*.md` guides use TypeScript (`new-sandbox` patterns).
- `PROCESSFLOW_CODE_SNIPPETS_GUIDE.md`, event handling, and WebApp async guides — TypeScript only.
- `interface/v1/variables.md` and `return-format.md` — TypeScript-first.
- Documentation covers TypeScript/JavaScript sandbox only.

### Added (prior)

- `docs/PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md` — languages, modes, profiles, capabilities, API matrix.
- `reference/cursor-process-step-code-snippet_prototype.ts` — TypeScript agent prototype.
- `examples/workflow/process-step-trigger-async-process.ts` — async stub example.
- `docs/Code_Snippets/README.md` — language policy for category guides.

### Changed (prior)

- Documentation aligned with **backend-next** sandbox: TypeScript/JavaScript `new-sandbox`.
- Corrected API surface: `api.get`/`post` only; `files.read`/`list`; `notification.send`/`dispatch`/`update`/`remove`.
- Removed/deprecated guidance for `BackgroundJobQueueService`, `api.put`/`delete`, `getFiles`, `createAdminNotification`.
- Interface docs v1.0.1 changelog entry in `docs/interface/CHANGELOG.md`.

### Initial migration

- Structure, docs, examples, reference, and tenant template from platform repo.

## [1.0.0] — Migration

- Created folder structure: `docs/`, `spec/`, `examples/`, `reference/`, `tenants/`.
- Interface v1 documented under `docs/interface/v1/`.
- Copied documentation: ProcessFlow snippets guide, quick reference, event handling, WebApp async trigger.
- Copied Code_Snippets category docs and reference prototype.
- Added `tenants/_template/` for new tenants.
