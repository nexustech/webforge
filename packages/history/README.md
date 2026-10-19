# @webforge/history

History Manager: transactions, coalescing, undo labels and selection restore. Every document change goes through `HistoryManager.run/begin`.

**Status:** empty skeleton. See [architecture §4](../../spec/01-architecture.md#4-package--module-structure-pnpm-monorepo).

## Public API
None yet. `src/index.ts` is the only entry point; import the package as `@webforge/history`, never its internal files.

## Boundaries
- Framework-free: no React, no Electron.
- Core package: coverage ≥ 90% lines / ≥ 85% branches; undo invariants are property-tested with fast-check.
