# Config Versioning Strategy

Relasy supports an explicit `configVersion` field in `relasy.json`.

## Current version

- `configVersion: 1`

## Backward compatibility

- If `configVersion` is omitted, Relasy treats the config as version `1`.
- Default values are applied for newly introduced optional fields (for example `labelPolicy`, `nonPrCommitsPolicy`).

## Forward policy

When a future config schema requires breaking changes:

1. introduce `configVersion: 2`
2. keep a migration/compatibility path for older versions where feasible
3. document breaking changes and migration steps in release notes
