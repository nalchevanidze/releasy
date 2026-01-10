# Relasy Actions

## Overview

This repository contains GitHub Actions developed to facilitate release management. These actions can be integrated into your GitHub workflows to automate the process of creating and publishing releases.

## Draft Release Action Template

requires the following Workflow permissions to be set to "Read and write":

  1. Go to your GitHub repository.
  2. Navigate to:  Repo → Settings → Actions → General → Workflow permissions
  3. Select "Read and write permissions".
  4. Enable Allow GitHub Actions to create and approve pull requests

```yaml
name: Draft Release
on: workflow_dispatch

permissions:
  contents: write
  pull-requests: write

jobs:
  draft-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0

      - name: Setup
        run: # Commands to setup release environment and bump version

      - name: Draft Release
        uses: nalchevanidze/relasy/actions/draft-release@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

```

## Publish Release Action Template

```yaml
name: Publish Release
on:
  pull_request:
    types: [closed]

jobs:
  publish_release:
    if: ${{ github.base_ref == 'main' && startsWith(github.head_ref, 'publish-release/') && github.event.pull_request.merged == true  }}
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Publish to Registry
        run: # Commands to publish package to registry

      - uses: nalchevanidze/relasy/actions/publish-release@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

```
