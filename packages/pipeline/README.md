# @webforge/pipeline

Build pipeline: render, Tailwind compile, esbuild, images, site files and Site Check rules.

**Status:** empty skeleton. See [architecture §4](../../spec/01-architecture.md#4-package--module-structure-pnpm-monorepo).

## Public API
None yet. `src/index.ts` is the only entry point; import the package as `@webforge/pipeline`, never its internal files.

## Boundaries
- No React of its own; renders only through `site-components`.
- Core package: coverage ≥ 90% lines / ≥ 85% branches.
