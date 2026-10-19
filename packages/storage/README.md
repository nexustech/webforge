# @webforge/storage

`.wforge` SQLite project store: content-addressed blobs, documents, versions, garbage collection and backups.

**Status:** empty skeleton. See [architecture §4](../../spec/01-architecture.md#4-package--module-structure-pnpm-monorepo).

## Public API
None yet. `src/index.ts` is the only entry point; import the package as `@webforge/storage`, never its internal files.

## Boundaries
- Framework-free: no React, no Electron renderer APIs.
- Core package: coverage ≥ 90% lines / ≥ 85% branches.
