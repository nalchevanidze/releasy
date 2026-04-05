# Config Schema Status

Relasy config is currently in **beta schema mode**.

## Current policy

- `configVersion` is not required and not used as a routing key.
- Canonical config shape is defined by the latest `relasy.yaml` schema and loader normalization.
- YAML keys are canonical **kebab-case** and normalized to camelCase internally.
- Supported config files are YAML-only: `relasy.yaml` or `relasy.yml`.

## Migration behavior

- `relasy migrate-config` rewrites older config styles into the current canonical shape.
- Ambiguous/duplicate semantic keys after normalization are treated as configuration errors.

## Future versioning

When schema stabilizes, explicit versioning can be introduced again with a formal migration contract.
