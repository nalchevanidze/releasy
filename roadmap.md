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

## Next implementation topics

- [ ] Beta schema refresh (minimal + explicit)
  - [ ] Remove `configVersion` while schema is in beta.
  - [ ] Adopt kebab-case as canonical YAML key style.
  - [ ] Canonical policy shape:
    - [ ] `policies.label-mode`
    - [ ] `policies.auto-add-inferred-packages`
    - [ ] `policies.detection-use: [labels, commits]` (ordered priority)
    - [ ] `policies.rules.<rule>: skip | warn | error`
  - [ ] Keep `changes.<type> = { icon, title, bump, paths }` as canonical change model.
  - [ ] Move changelog rendering to `changelog.templates.{header,section,item}`.
  - [ ] Replace `groupByPackage` with `changelog.grouping: package | scope | none`.
  - [ ] Explicitly remove legacy schema fields from canonical docs/validation (`labelPolicy`, `nonPrCommitsPolicy`, top-level `rules`, `groupByPackage`, template legacy keys).
  - [ ] Add hard-fail validation for mixed legacy+new keys in the same config.

- [ ] Rules severity unification
  - [ ] Add `policies.rules.label-conflict`.
  - [ ] Add `policies.rules.inferred-package-missing`.
  - [ ] Add `policies.rules.detection-conflict`.
  - [ ] Add `policies.rules.non-pr-commit`.
  - [ ] Define common semantics: `skip` = ignore, `warn` = report+continue, `error` = fail.

- [ ] Hybrid change detection (PR labels + commitlint/conventional commits)
  - [ ] Implement Conventional Commits parser adapter.
  - [ ] Normalize labels/commits into one internal change model before bump/changelog.
  - [ ] Apply `policies.detection-use` priority when multiple inputs are enabled.
  - [ ] Use `policies.rules.detection-conflict` for mismatch behavior.
  - [ ] Add validator diagnostics for source mismatch with actionable messages.
  - [ ] Add tests for labels-only, commits-only, hybrid-agree, hybrid-conflict scenarios.

- [ ] Action/workflow migration to new schema naming
  - [ ] Update validate/bootstrap/draft/publish actions to read new canonical config keys.
  - [ ] Update action input/output docs/examples to reference new policy/rule terms.
  - [ ] Update workflow examples in README to avoid legacy field names.

- [ ] Config naming/style normalization implementation
  - [ ] Add recursive key normalizer (kebab-case -> camelCase) at config load time.
  - [ ] Reject duplicate semantic keys after normalization (e.g. `auto-add` + `autoAdd`).
  - [ ] Validate only canonical normalized object.
  - [ ] Ensure CLI (`plan`, `validate-config`, `migrate-config`) emits only canonical new-key terminology.
  - [ ] Document naming conventions and examples in README.
