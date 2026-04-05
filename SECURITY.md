# Security Guidelines

## Token handling

- `GITHUB_TOKEN` is required for GitHub API mutations.
- Prefer GitHub-provided `secrets.GITHUB_TOKEN` in workflows.
- Do not print tokens in logs.
- Git pushes use `origin` first; auth-header fallback is used when credentials are not preconfigured.

## Workflow permissions (minimum recommended)

- `draft-release`: `contents: write`, `pull-requests: write`
- `publish-release`: `contents: write`
- `validate-pr-labels`: `contents: read`, `pull-requests: read`
- `bootstrap-labels`: `contents: read`, `issues: write`

## Local runs

When running outside Actions context, set:

- `GITHUB_TOKEN`
- `RELASY_OWNER`
- `RELASY_REPO`
- optionally `RELASY_PR_NUMBER`

## Reporting

If you discover a security issue, please avoid public disclosure and contact the maintainer privately first.
