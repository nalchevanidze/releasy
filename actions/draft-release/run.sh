#!/usr/bin/env bash
set -euo pipefail

# Many tools look for either name; keep both available.
export GITHUB_API_TOKEN="${GITHUB_TOKEN:-}"

# Ensure we have full refs/tags for tools that inspect history
git fetch --all --tags --prune

# Install the *consumer repo* deps (this repo is already checked out by workflow)
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

# Rerun safety: delete the remote publish-release/<version> branch if it already exists
VERSION="$(node -p "require('./package.json').version")"
BRANCH="publish-release/${VERSION}"

if git ls-remote --exit-code --heads origin "${BRANCH}" >/dev/null 2>&1; then
  echo "Remote branch ${BRANCH} already exists; deleting to allow rerun..."
  git push origin --delete "${BRANCH}"
fi

# Run the vendored tool from the action repo.
# IMPORTANT: Adjust this path to the actual built entry file of gh-rel-easy.
node "${GITHUB_ACTION_PATH}/../gh-rel-easy/dist/releasy.js" open
