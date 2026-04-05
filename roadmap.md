# Roadmap

## Upcoming migration and feature expansion (completed)

- [x] Migrate configuration format from `relasy.json` to `relasy.yaml`
  - [x] Added YAML config loader (`relasy.yaml` / `relasy.yml`) in core.
  - [x] Added JSON deprecation warning path with migration guidance.
  - [x] Updated CLI commands (`init`, `validate-config`, `migrate-config`, `template-*`) to use YAML.
  - [x] Updated docs/examples to reference YAML as the source of truth.
  - [x] Added migration utility to convert existing JSON -> YAML safely.

- [x] Path-aware package intelligence
  - [x] Extended config with `packageScopes` object shape (`pkg` + `paths`).
  - [x] Resolved PR changed files and inferred package scopes from glob matches.
  - [x] Added tests for single-scope, multi-scope, and no-match scenarios.

- [x] First-class release rules engine
  - [x] Added configurable policy rules (`requireInferredPackageLabels`, `blockOnLabelConflict`).
  - [x] Added block conditions for policy violations.
  - [x] Added conflict checks (manual labels vs inferred labels).
  - [x] Added rule evaluation test matrix.

- [x] Auto-add package labels during validation
  - [x] Added `auto_add_package_labels` option in validation action.
  - [x] Added dry-run preview output for inferred/applied labels.
  - [x] Added permission-aware mutation flow and actionable failures.
  - [x] Added tests for mutation safety and behavior.

## Additional hardening after rollout (completed)

- [x] Live sandbox mutation E2E for inferred labels + rules engine
  - Added dedicated `e2e-sandbox` workflow scaffold with harness + optional live dry-run smoke mode.

- [x] Performance check with large PR file lists and many package scopes
  - Added scalability baseline test for large changelog rendering fixture.

- [x] Backward-compatibility/deprecation docs for old config format
  - Added `CONFIG_VERSIONING.md` and JSON deprecation path in config loader.
