# Roadmap

## Upcoming migration and feature expansion

- [ ] Migrate configuration format from `relasy.json` to `relasy.yaml`
  - [ ] Add YAML config loader (`relasy.yaml` / `relasy.yml`) in core.
  - [ ] Deprecate JSON loader path and add clear migration warnings.
  - [ ] Update CLI commands (`init`, `validate-config`, `migrate-config`, `template-*`) to use YAML.
  - [ ] Update docs/examples/workflows to reference YAML as the source of truth.
  - [ ] Add migration utility to convert existing JSON -> YAML safely.

- [ ] Path-aware package intelligence
  - [ ] Extend config with `packageScopes` object shape:
    - key = scope label key
    - fields include `pkg` and `paths`.
  - [ ] Resolve PR changed files and infer package scopes from glob matches.
  - [ ] Add tests for single-scope, multi-scope, shared-path, and no-match scenarios.

- [ ] First-class release rules engine
  - [ ] Add configurable policy rules (e.g. require labels for path scopes).
  - [ ] Add block conditions (e.g. fail when policy violations exist).
  - [ ] Add conflict checks (manual labels vs inferred labels).
  - [ ] Add rule evaluation test matrix.

- [ ] Auto-add package labels during validation
  - [ ] Add `auto_add_package_labels` option to validation flow (or dedicated sync action mode).
  - [ ] Add dry-run preview output showing inferred vs applied labels.
  - [ ] Add permission checks and actionable failures for label mutation.
  - [ ] Add tests for idempotent re-runs and mutation safety.

## Additional hardening after rollout

- [ ] Live sandbox mutation E2E for inferred labels + rules engine.
- [ ] Performance check with large PR file lists and many package scopes.
- [ ] Backward-compatibility/deprecation docs for old config format.
