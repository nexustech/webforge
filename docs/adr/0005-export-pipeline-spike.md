# 0005. Export pipeline: site components, static build and file:// output

- Status: Accepted
- Date: 2026-10-20
- Related: [MVP spec §6, Phase 0](../../spec/02-mvp-spec.md#6-milestones), [export pipeline research](../../research/stack/07-export-pipeline.md) (X1–X6), [site components research](../../research/stack/05-site-components.md), [architecture §4–8](../../spec/01-architecture.md), [ADR 0004](0004-puck-with-webforge-history.md) (follow-ups)

## Context
Phase 0 had to show that Webforge can turn a site into a self-contained static site (X1–X5):
- flat `.html` pages with relative links that work when opened from disk;
- readable CSS from Tailwind v4 and daisyUI 5, compiled from code inside the app;
- classic `<script defer>` only, and no external requests (C8);
- WebP images with a JPEG/PNG fallback (X2).

The build has to run off the UI thread, in an Electron `utilityProcess`, and work in the packaged app.

## Decision
**Go.** The pipeline works end to end, from a site snapshot to a folder that opens from disk in Chromium and WebKit with zero external requests. The design below is the baseline for Phase 3.

### What was built
- **`@webforge/model`** owns the documents: `PageDoc`, `NodeDoc`, `LayoutDoc`, `Theme` and a new `SiteSnapshot` (pages, layout, theme, media), each with a zod schema. The snapshot schema rejects a missing home page, duplicate page paths, unsafe page paths or media names, and non-binary media. (ADR 0004 follow-up.)
- **`@webforge/site-components`** owns the component library contract (`ComponentDef`, `FieldDef`, moved from `engine`, so `engine` now depends on it and not the other way round). It also holds the catalogue, all with daisyUI markup and `site-*` hook classes:
  - Header with a mobile menu, and Footer;
  - Section with padding tokens;
  - Hero with an optional responsive image;
  - FAQ, using native `<details>`;
  - Heading and Text.

  `renderNodesToHtml()` renders static HTML **without Puck**: it walks the page tree itself, so the export carries no editor wrappers. Rich text is sanitised with `sanitize-html` (formatting tags and safe links only). Components get a `RenderContext` for navigation, page links and resolved images. On the canvas it is `EDITOR_RENDER_CONTEXT`. `webforge.js` behaviours are plain classic-script files (`behaviours/menu.js`), included only when a used component declares them.
- **`@webforge/pipeline`**:
  - `buildSite(snapshot, library, resources)` → files plus a report;
  - `writeSiteFolder(files, folder)` writes to a staging folder, then swaps it in, with rollback;
  - `loadNodeResources()` (subpath `@webforge/pipeline/node`) loads the resources from `node_modules` for tests and Node scripts.
- **Desktop:**
  - an **Export site** button;
  - the `exportSite` IPC call, which takes a validated `SiteSnapshot` and no path (main asks for the folder with a native dialog);
  - one `utilityProcess` per export (`src/worker/export-worker.ts`), with zod-validated messages in both directions, stopped after 10 minutes so an export can never hang;
  - errors are logged as codes only.

### Findings
1. **Tailwind v4 and daisyUI compile in-process with no native modules.** The pipeline uses `tailwindcss`'s own `compile()` and supplies `loadStylesheet` (theme, preflight and utilities CSS) and `loadModule` (the daisyUI plugin) itself. Class candidates come from the `class` attributes of our own HTML, which we fully control. So the spike needs neither `@tailwindcss/oxide` (a native scanner) nor `@tailwindcss/node`. Custom HTML (C7) will need a real scanner later.
2. **The "@plugin resolution from inside app.asar" risk disappears.** The worker resolves nothing at run time:
   - Tailwind's CSS is bundled as text (`?raw`);
   - the WASM codecs and fonts are bundled as base64 by a small `?base64` Vite plugin, because Vite has no `?inline` for `.wasm` (it fails on Windows with os error 123);
   - the daisyUI plugin is bundled as code.
   The worker bundle is **4.1 MB**.
3. **jSquash runs in Node and in the utility process,** given precompiled `WebAssembly.Module`s (`compileCodecs`) and a minimal `ImageData` stand-in. Neither Node nor a utility process has `ImageData`. Its output is deterministic: two builds are byte-identical, which the golden tests check.
4. **Measured on this Windows machine** (2-page fixture with one 1600×1000 photo):

   | | Time / size |
   |---|---|
   | Build in Node (Vitest), cold, 6 image encodes | ≈ 2.3 s |
   | Export from the app, page without images (utility process) | ≈ 1.0–1.4 s |
   | Export from the **packaged** app, page with the photo | ≈ 3.0 s |
   | CSS for the fixture site (readable, theme + used classes only) | 50 KB |
   | `webforge.js` (menu) | 1.2 KB |
   | Photo at 640 / 1280 / 1600 px: WebP vs JPEG | 3.3 / 8.4 / 12.1 KB vs 6.5 / 16.0 / 16.8 KB |

   Image encoding dominates. The research's plan to cache derivatives by image hash (07) is needed before real projects with 20+ photos.
5. **`file://` works.** Playwright opens the exported fixture from disk with all non-file requests blocked, in Chromium and WebKit, and checks that:
   - the fonts load (Inter 400/700 from `assets/fonts/`);
   - the image loads and daisyUI's theme is applied;
   - relative links navigate between pages;
   - the mobile menu opens and closes (button, `aria-expanded`, Escape returns focus);
   - the FAQ opens with the keyboard;
   - axe finds no serious or critical violations.

   Firefox runs in CI. It could not start on the spike machine because the Visual C++ runtime that Playwright's Firefox needs is missing.
6. **The packaged app exports.** `electron-builder --dir` with asar and Fuses, checked by hand on Windows: the utility process starts from inside `app.asar`, compiles the CSS, encodes the image and writes the folder. This needed a temporary, reverted dialog override, because the packaged test reaches only the renderer (Fuses switch off `--inspect`). An automated packaged export test needs a test-only way to answer the folder dialog. Decide that with the E2E strategy in Phase 1.
7. **Safe destination handling (X5).**
   - Webforge writes only into an empty folder, or one that holds nothing but an earlier export: the `.webforge-export` marker lists the files that export wrote, so a file the user added (say a host's verification page) makes the folder count as someone else's, and Webforge never deletes a user's files.
   - The new site goes to a staging folder first. The old export is swapped out and put back if the swap fails.
   - Windows folder locks (`EBUSY`/`EPERM`) are retried.
8. **daisyUI details:**
   - the theme is set with `@plugin "daisyui" { themes: <name> --default; }`, and the selector is `[data-theme=<name>]`;
   - the plugin prints a banner to stdout (harmless in the worker);
   - `menu` needs `w-full` for a full-width mobile menu.
9. **Licences:** `@fontsource/inter` is OFL-1.1. OFL-1.1 is added to the licence allow-list (ADR 0002), because exported sites bundle Fontsource fonts by design (architecture §8). Everything else is MIT or Apache-2.0, plus MPL-2.0 for `@axe-core/playwright`.

## Consequences
- `CanvasEngine.renderStatic` should delegate to `renderNodesToHtml` instead of Puck's `<Render>`, so the canvas and the export share one renderer. Done in 2.5 (#47): both used `renderPage` from `@webforge/site-components`.
- **Since R8 (#306):** `renderStatic` is gone; it only wrapped `renderPage`, and only engine tests called it.
  - **What is still claimed:** the canvas and the export draw each component with the same `render` function. The canvas calls it through Puck (`toPuckConfig`, tested in `config.test.tsx`); the export calls it through `renderPage`. Both use the same values, slots and render context shape.
  - **What is no longer claimed:** byte-identical markup. On the canvas, Puck wraps every element and puts editors in inline and rich text, so its markup differs by design. A test stripping that chrome would mostly test Puck.
  - **Where the export's HTML is tested:** site-components' renderer tests (`render-static.test.tsx`: every component, hidden elements, linked copies) and the pipeline's golden files.
- The pipeline API is the spike's, not yet architecture §6's: no `AsyncIterable` progress events, no preview mode, no `check()`. Phase 3 adds those on top of `buildSite`.
- **Not covered here (follow-ups):**
  - the preview server with SSE hot-swap (07, spike item 4);
  - image derivative cache;
  - theme-driven font choice (only Inter is bundled);
  - `sitemap.xml`, `robots.txt`, `404.html`, favicons and Open Graph tags;
  - the full Site Check rules (X5): so far only three blocking errors (invalid site, unknown component, missing image) and the broken-link warning;
  - esbuild for `custom.js`.
- **Editor gaps found while wiring the catalogue:**
  - the canvas iframe has no site CSS yet, so daisyUI components look unstyled while editing;
  - Puck's component list offers Header, Footer and FAQ items at the page's top level. The engine should hide layout-only and child-only components (`FaqItem`).
- **Output details to revisit:**
  - React writes `srcSet` in camel case (valid HTML, but untidy in readable output);
  - without JavaScript, the small-screen navigation stays hidden. Consider a no-JS fallback.
- **Tooling:**
  - `pnpm e2e` now also needs Playwright's browsers (`playwright install chromium firefox webkit`), which CI installs;
  - golden output lives in `packages/pipeline/test/golden/` and is excluded from Biome;
  - `tempDirFactory` moved to `@webforge/test-utils` and is shared by the storage and pipeline tests.

## Amendment, 26 Oct 2026 (R15, #248)
The architecture review asked for a build that can be cancelled and followed, that doesn't encode the same image twice, and that doesn't carry every image through the main process.
- **Cancel and progress.** `buildSite(snapshot, library, resources, { signal, onProgress })`:
  - it checks `signal` before each image, document and page, and before the stylesheet and the fonts, then throws a `cancelled` `BuildError`;
  - `onProgress` gets `BuildEvent`s (each image and page as it starts, then `styles` and `fonts`);
  - `writeSiteFolder(files, destination, signal)` stops between files and removes its temporary folder, so the destination is left as it was.

  The full §6 `Pipeline` interface (an `AsyncIterable`, preview mode, `check()`) is still 3.1's.
- **Bytes when needed.** A snapshot's images and documents may carry `hash` instead of `data`. The build reads each one through `resources.readMedia(hash)` as it reaches it.
  - In the app, the export worker asks the main process (`read-blob`), which reads it from the open site through the store gate. Main never holds more than the one being read; before, it read every image into its heap and sent them all in one message.
  - The worker doesn't open the `.wforge` itself. The main process's connection uses a rollback journal, so a second process reading would block saves, and the gate only coordinates access within main.
- **Image cache, in memory only.**
  - `PipelineResources.imageCache` takes an `ImageCache`, keyed by the original's SHA-256, its crop, the width, the format and the encoder's settings, so a key never stands for other bytes.
  - On a hit for every file, the original is neither read nor decoded.
  - In the app, the export worker now lives while the site is open (`createExportRunner`) and keeps a 256 MB cache, least recently used first out (`createMemoryImageCache`). It's stopped when the site closes, so the cache goes with it.
  - **Not on disk:** a cache of encoded copies of the person's photos in the user data would outlive the site, survive its deletion and be a second copy outside the file they control. That breaks "never store site content" and R13d. If measurements show that first exports are too slow, the place is the `.wforge` itself (format 2, a derivatives table), so the copies live and die with the site. That's the product owner's call, for the file-size trade-off.
- **Codecs.** A failed codec preparation, or a failed load of the worker's bundled resources, is forgotten (`onceUntilFailure`), so the long-lived workers try again with their next job. The `ImageData` stand-in is defined only where the runtime has none.

## Amendment, 26 Oct 2026 (3.1, #59)
The §6 `Pipeline` interface, as `createPipeline(library)`: one per open site, in the export worker.
- **`build(snapshot, resources, { mode, signal })`** is an `AsyncIterable` of the R15 `BuildEvent`s, ending with `{ stage: "done", site }`. `buildSite` is the same build without the caches below. `check()` is 3.6's.
- **Modes.** `export` and `publish` build the same files. `preview` (3.2) lets the stylesheet keep classes a page no longer uses, so an edit's CSS is ready at once.
- **Kept between builds, in memory only:**
  - the R15 image cache (256 MB);
  - each page's rendered Header, content and Footer, keyed by a hash of the page and of everything else its render reads (the site without its pages' content or Media, the resolved images and the documents' paths). Only the last finished build's pages are kept, and a cancelled build leaves them as they were;
  - the Tailwind compiler. Preparing one takes about 120 ms and building from it about 10. A compiler only adds the classes it's given to its CSS, so an export uses the kept one only when no class it has seen is gone; otherwise it prepares a new one. An export's CSS is therefore always exactly what a fresh compiler makes.
- **Progress and cancel in the app.** The worker reports each stage (`progress`), then `writing`. Main passes them to the window (`site:export-progress`), and `site:cancel-export` aborts the exports under way. The export toast shows the stage, with a Cancel button.
