# @webforge/model

The site's documents and their zod schemas. Branded IDs, format migrations and glossary-driven display labels come in Phase 1.

## Public API
`src/index.ts` is the only entry point; import the package as `@webforge/model`, never its internal files.

- `PageDoc`, `NodeDoc`, `LayoutDoc` (Header and Footer, C5), `Theme`, with `pageDocSchema`, `layoutDocSchema` and `themeSchema` for data arriving from outside (IPC, files).
- `SiteSnapshot` (pages, layout, theme, media) and `siteSnapshotSchema`: what a build gets (export pipeline stage 1). The schema rejects a missing home page, duplicate page paths, unsafe page paths or media names (X1, X5) and non-binary media.
- `isNodeDoc(value)`: finds the slot arrays inside a node's props.

```ts
import { siteSnapshotSchema } from "@webforge/model";

const site = siteSnapshotSchema.parse(untrusted); // throws on an invalid site
```

## Boundaries
- Framework-free: no React, no Electron.
- Core package: coverage ≥ 90% lines / ≥ 85% branches.
