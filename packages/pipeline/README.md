# @webforge/pipeline

Builds a self-contained static site from a `SiteSnapshot` and writes it to a folder ([research 07](../../research/stack/07-export-pipeline.md), [ADR 0005](../../docs/adr/0005-export-pipeline-spike.md)). Preview mode, progress events and the full Site Check rules come in Phase 3.

## Public API
- `@webforge/pipeline` (`src/index.ts`):
  - `buildSite(snapshot, library, resources)` → `{ files, report }`. It produces:
    - flat `page.html` files with relative links (X1);
    - readable CSS compiled with Tailwind v4 and daisyUI from the classes the pages use (X4);
    - `assets/js/webforge.<hash>.js`, only when a component needs it;
    - fonts;
    - WebP images with a JPEG/PNG fallback at 640/1280/1920 px, never upscaled (X2).

    Throws `BuildError` (`invalid-site`, `unknown-component`, `missing-media`). Broken page links are reported as warnings.
  - `writeSiteFolder(files, folder)`: writes to a staging folder and swaps it in. Replaces only an empty folder or an earlier export (`.webforge-export` marker), else throws `WriteError` (`folder-not-empty`, `write-failed`).
  - `PipelineResources`, `compileCodecs(bytes)`: the files the pipeline needs, supplied by the caller (Tailwind stylesheets, the daisyUI plugin, fonts, jSquash WebAssembly codecs).
- `@webforge/pipeline/node` (`src/node-resources.ts`): `loadNodeResources()` loads those resources from `node_modules`, for tests and Node scripts. The desktop app's export worker bundles them instead.

```ts
const built = await buildSite(snapshot, siteLibrary, await loadNodeResources());
await writeSiteFolder(built.files, "C:/Users/sam/Desktop/my-site");
```

## Tests
- Unit tests next to the code; integration and golden tests in `test/`.
- `test/golden/` holds the reviewed `index.html`, `about.html` and `webforge.js` of the fixture site (`@webforge/test-utils`). A change to the output shows up as a diff in review. Update them with `vitest -u` only when the change is intended. Biome leaves these files alone.

## Boundaries
- No React of its own; renders only through `site-components`.
- Runs in Node (the export utility process), never in the renderer.
- Core package: coverage ≥ 90% lines / ≥ 85% branches.
