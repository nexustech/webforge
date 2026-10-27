# @webforge/pipeline

Builds a self-contained static site from a `SiteSnapshot` and writes it to a folder ([research 07](../../research/stack/07-export-pipeline.md), [ADR 0005](../../docs/adr/0005-export-pipeline-spike.md)). Preview mode and progress events come in Phase 3. Site Check's rules are in `packages/site-check`, run in the renderer ([ADR 0015](../../docs/adr/0015-site-check-in-the-renderer.md)).

## Public API
- `@webforge/pipeline` (`src/index.ts`):
  - `buildSite(snapshot, library, resources)` → `{ files, report }`. It produces:
    - flat `page.html` files with relative links (X1);
    - readable CSS compiled with Tailwind v4 and daisyUI from the classes the pages use (X4);
    - `assets/js/webforge.<hash>.js`, only when a component needs it;
    - the fonts the theme uses, and only those (2.2);
    - WebP images with a JPEG/PNG fallback at 640/1280/1920 px, never upscaled (X2).

    Throws `BuildError` (`invalid-site`, `unknown-component`, `missing-font`). Broken page links are reported as warnings.
  - `writeSiteFolder(files, folder)`: writes to a staging folder and swaps it in. Replaces only an empty folder or one holding nothing but an earlier export (the `.webforge-export` marker lists the files it wrote), else throws `WriteError` (`folder-not-empty`, `write-failed`).
  - `PipelineResources`, `compileCodecs(bytes)`: the files the pipeline needs, supplied by the caller (Tailwind stylesheets, the daisyUI plugin, jSquash WebAssembly codecs, and `readFont(face)` for the font files a site uses, which the build checks against the font catalogue's SHA-256). `fonts` adds the families downloaded on the computer (2.2) to the catalogue's; `buildSiteCss` takes them as its `fonts` option too. The catalogue's font packages are this package's dependencies; `loadNodeResources` reads them, and the desktop build copies them into the installer.
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
