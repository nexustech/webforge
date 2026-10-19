# @webforge/site-components

Section and element components, their fields, daisyUI markup and the `webforge.js` behaviours used by exported sites.

**Status:** empty skeleton. See [architecture §4](../../spec/01-architecture.md#4-package--module-structure-pnpm-monorepo).

## Public API
None yet. `src/index.ts` is the only entry point; import the package as `@webforge/site-components`, never its internal files.

## Boundaries
- Must not import editor packages (engine, editor-ui, history, storage, publish).
- Components must render with `renderToStaticMarkup` without browser globals (no DOM types in this package).
