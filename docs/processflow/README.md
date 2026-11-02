# ProcessFlow documentation

Guides for authoring ProcessFlow code snippets used by this App Model (and any Tealfabric process). The **snippet runtime** lives on the platform (`new-sandbox`); this folder holds the authoring contract and patterns.

**Language policy:** TypeScript preferred, JavaScript supported.

## How this fits the App Model

- **Production BFF** for the demo app lives under `backend/tenants/_template/snippets/`.
- **Shared examples** (notifications, webhooks, LLM, WebApp envelope, …) live under repo-root `examples/`.
- Keep tenant-specific production code under `backend/tenants/tenant-<id>/`, not in `_template` or `examples/`.

## Contents

- **PROCESSFLOW_SANDBOX_TF_API.md** — `tf` namespace API: capabilities, services, async integration, troubleshooting
- **PROCESSFLOW_RUNTIME_COMPATIBILITY_MATRIX.md** — Languages, execution modes, profiles, capabilities, service API matrix
- **PROCESSFLOW_CODE_SNIPPETS_GUIDE.md** — Full guide: structure, input/output, variables, error handling, examples
- **PROCESSFLOW_QUICK_REFERENCE.md** — Quick reference and common patterns
- **PROCESSFLOW_EVENT_HANDLING_GUIDE.md** — Event Broker pattern and event-driven orchestration
- **WEBAPP_ASYNC_PROCESS_TRIGGER_GUIDE.md** — Async process trigger for WebApp/Webhook (stub process pattern)
- **PROCESSFLOW_SANDBOX_AND_API_RESTRICTIONS.md** — Sandbox restrictions, blocked APIs/patterns, validation limits
- **Code_Snippets/** — Category-specific guides (TypeScript). See [Code_Snippets/README.md](Code_Snippets/README.md)
- **interface/** — Versioned step contract. See `interface/v1/` and [interface/CHANGELOG.md](interface/CHANGELOG.md)
- **PROCESSFLOW_CHANGELOG.md** — Historical ProcessFlow doc changelog from the merge source

Also see:

- [examples/webapps/](../../examples/webapps/README.md) — inbound `process_input` + sandbox HTTP envelope when a WebApp triggers a process
- [spec/v1/step-contract.json](../../spec/v1/step-contract.json) — machine-readable contract

## Interface version

Repository root **`INTERFACE_VERSION`** (currently `1.0.4`). Prefer **`tf.*`** and TypeScript for `new-sandbox`.
