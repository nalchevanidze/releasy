# Roadmap

## Current architecture and quality status

- [x] App-layer refactor (`packages/core/src/app/*`)
- [x] Action-domain helper library (`packages/actions-common`)
- [x] Structured use-case result codes
- [x] Expanded CLI (`validate-config`, `labels --check`, `plan`)
- [x] Action output contract coverage (including draft-release)
- [x] Changelog snapshot testing

## Next high-impact improvements

- [ ] True end-to-end sandbox tests
  - Run full flow against a temporary/sandbox repo (or high-fidelity fixture harness).

- [ ] Changelog template flexibility (next step)
  - Extend from current header/section controls to full section/body templates or pluggable renderers.

- [ ] Non-PR commit handling policy
  - Add explicit options for commits not linked to PRs: `include` / `skip` / `strict-fail`.

## Confidence-boosting test strategy (highest ROI first)

- [ ] End-to-end sandbox repo tests
  - Spin up temp repo (or dedicated sandbox repo), then run full flow:
    - label bootstrap
    - PR labeling validation
    - draft release
    - merge release PR
    - publish release
  - Expected confidence impact: high (+10–15 points).

- [ ] Contract tests for GitHub event payload variants
  - Cover different `pull_request` payload shapes, missing fields, and local-run fallbacks.

- [ ] Failure-mode integration tests
  - Cover rate limit / transient 5xx / missing permissions / missing token / no tags / no associated PR.
  - Verify retry behavior and actionable failure messages.

- [ ] Idempotency tests
  - Re-run draft/publish flows and assert no duplicates or state corruption.

- [ ] Expanded golden tests for changelog rendering
  - Add snapshot fixtures for:
    - custom templates
    - package grouping
    - edge label combinations

- [ ] Extensive snapshot changelog testing
  - Build a broad fixture matrix (small/large release sets, multiline bodies, missing authors, mixed labels, non-PR commit policy variants).
  - Freeze expected markdown outputs and review snapshot diffs as part of PR quality gates.
