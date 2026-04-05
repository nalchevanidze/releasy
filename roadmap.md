# Roadmap

## Recently delivered

- YAML-first config schema (`relasy.yaml` / `relasy.yml`) with key normalization.
- Path-aware package inference for PR validation.
- Policy/rules engine (`skip | warn | error`) across release checks.
- Auto-add inferred package labels in validation action.
- Hybrid detection pipeline support (`labels`, `commits`) with configurable precedence.
- Template lint/preview and config migration commands in CLI.
- Sandbox E2E harness and scalability checks.

## Next priorities

- Tighten release PR rerun behavior and idempotent refresh guarantees.
- Keep docs/action metadata aligned with runtime behavior and permissions.
- Improve changelog rendering readability for multi-package entries.
- Continue expanding integration tests for real-world monorepo edge cases.
- Expand commit-detection test coverage for edge cases (large PR commit sets, mixed commit types, and fallback behavior).
