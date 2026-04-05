# Relasy Architecture

## Monorepo layout

- `packages/core`: release/changelog domain logic, git/github/project integrations
- `packages/cli`: local CLI wrapper around core
- `packages/actions-common`: shared action-domain helpers (context/token/error helpers)
- `actions/*`: GitHub Action entrypoints (thin orchestration layer)

## Design boundaries

### 1) Core domain (`@relasy/core`)
Responsible for:
- loading/validating config
- detecting version bump from labels
- generating changelog
- orchestrating release PR creation

Core should not depend on action runtime APIs (`@actions/*`).

### 2) Action domain (`@relasy/actions-common`)
Responsible for:
- resolving owner/repo/pr context from GitHub event + local env fallbacks
- token requirements
- action error formatting / action logging helpers

This package should stay free of project-specific release logic.

### 3) Action entrypoints (`actions/*`)
Responsible for:
- wiring runtime inputs/outputs
- invoking core APIs
- reporting failures with actionable messages

Action code should remain thin and delegate logic to `core`/`actions-common`.

## Operational invariants

- `GITHUB_TOKEN` must be available for mutating operations.
- Release PRs are idempotent: existing open release PR is reused when possible.
- Base branch:
  - explicit from `project.baseBranch`, otherwise
  - auto-detected from repository default branch, fallback `main`.
- Labels are validated against `relasy.json` contract.

## Testing strategy

- Unit tests in `packages/core` for changelog/labels/git/github logic
- Unit tests in `packages/actions-common` for context/token helpers
- Lightweight action-entry tests in `actions/*/src/*.spec.ts`
- Root `npm test` runs all above suites

## Build/release notes

- Action bundles are committed in `actions/*/dist/index.js`
- Any source change in `actions/*/src` should include regenerated `dist` output
