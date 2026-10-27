# 0015. The preview server: where it listens, who can open it, what it builds

- Status: Accepted
- Date: 2026-10-27
- Related: #60 (3.2), F-PV-1, [stack/07 §Live preview](../../research/stack/07-export-pipeline.md#live-preview-same-pipeline-in-memory), [Bootstrap Studio's preview](../../research/bootstrap-studio/02-architecture.md#live-preview-how-it-works-), architecture §7 (Edit, step 4), [ADR 0014](0014-time-budgets-under-load.md), R15

## Context
F-PV-1 opens the site in the default browser through a preview server in the main process. Edits reach the browser live: a CSS hot-swap, or a page reload. A QR code lets a phone on the same Wi-Fi open it.

Bootstrap Studio, the precedent:
- binds its server to every network (`0.0.0.0`) from the start;
- asks the renderer for every URL.

Both are a poor fit here:
- **The network.** A preview reachable by anyone on the Wi-Fi, a café's included, from the moment it opens, shows the owner's unpublished site to strangers.
- **The renderer.** A request per URL would need the renderer to render, and images to cross IPC for each request.
- **Our worker already builds.** The 3.1 pipeline keeps its pages, images and stylesheet in memory between builds.

The site's own scripts run in the preview. They must never run with the editor's privileges: the `webforge-media:` and `webforge-font:` protocols, IPC, or an Electron session.

## Decision
1. **Where it opens:** in the default browser, never in an Electron window. The site's scripts run where any visitor's would. No Electron session or partition serves them, so the editor's protocols aren't reachable from a preview page.
2. **One secret path.** Every URL is under `/<128-bit random hex>/`, made when the server starts.
   - Anything else is a 404: another base, a step up (`..`), a file not in the build.
   - A site in another tab, or a device on the network, can't read the preview without being given its link.
   - Only GET and HEAD are answered.
   - Every answer is `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
3. **This computer first.** The server listens on `127.0.0.1` on a random port.
   - Only *Preview on Phone…* starts a second listener on every network, on its own random port, for the address in the QR code.
   - The dialog says that anyone on the Wi-Fi with the address can see the preview while Webforge is open.
   - Both stop when the site closes.
4. **Built in its own worker, only what changed sent.**
   - A long-lived "Webforge preview" utility process builds in `preview` mode. It keeps its last build's files and answers with the files that changed and those removed, so an edit sends a page or a stylesheet, not every image.
   - It is not the export's worker, so an export never waits behind a preview, nor a preview behind an export.
   - Main keeps the files in memory and serves them by exact path. Nothing is written to disk (R15).
5. **The latest site, only while someone watches.**
   - The renderer sends each change: at most one every 100 ms, the first at once.
   - Main keeps the latest and builds it only while a browser has the event stream open, or waits for its first page.
   - A change made during a build is built once, after it, with every edit before it.
6. **A fixed stylesheet name in preview mode** (`assets/css/site.css`).
   - A change to the styles alone (a theme colour, a font) leaves every page's HTML as it was, so the browser gets a `css` event and swaps the stylesheet in place.
   - A changed page gets `reload`. Any other changed file reloads every page.
   - A page switch in the editor sends `show`, which moves the browser.
   - The script defers a reload or a move while its tab is hidden.
   - An export's stylesheet is still named by its content.
7. **A theme's shape and its values (3.2, part 2).**
   - **Compiled once per shape:** a preview compiles Tailwind for the theme's shape (`themeShape`), with its colours, corners, border, depth, noise, spacing, type scale, links and button height set to the default theme's. The real values follow the compiled stylesheet as plain custom properties (`themeValuesCss`), after `THEME_VALUES_MARKER`, outside any layer, so they win.
   - **What stays in the shape:** the preset, fonts, shadow, buttons' shape and style, headings, cards, photos and sections' rhythm, which change the rules or the fonts the stylesheet loads. Changing one compiles again.
   - **Safe by construction:** a test compares the theme's stylesheet source with its shape's, line by line, for a spread of themes. Only custom properties may differ, and each must be in the values block, under the same selector.
   - **No page re-rendered:** a page's cache is keyed on the theme's shape, not the whole theme. A render reads none of the theme's values (they are the stylesheet's), so this holds for an export too.
   - **The values alone over the wire:** when only the values block changed, the server sends it in a `values` event, and the page puts it in a style element of its own, with nothing to download. A later `css` swap removes that element once the new stylesheet has loaded.
   - **An export is untouched:** it is still compiled with the theme itself.
8. **Timing (ADR 0014).**
   - **The spec's targets** are checked by `pnpm e2e:perf` (`e2e/perf/preview.perf.ts`), timed from the edit landing in the editor (the perf build's `lastChange` hook), not from the clicks and dialogs that made it:
     - a theme colour must reach the browser in under 100 ms, the page noting the frame it changes in by its own clock;
     - a changed page must reach the server's reload in under 200 ms. The browser's own reload of the page is the browser's, and is printed beside it.
   - **In every other run,** tests check what load doesn't move: a colour change sends the stylesheet alone, compiles nothing and renders no page, and a text edit sends its page alone.

## Consequences
- **Phone preview needs the network listener.** On Windows, the first *Preview on Phone…* may show the system firewall's question for Webforge; until it's allowed, the phone can't connect. The desktop preview never asks: it stays on `127.0.0.1`.
- **A second worker while a preview is open.** It has its own image cache, so an image encoded for the preview is encoded again for the export, once.
- **GA stays off in preview.** When Google Analytics lands (Phase 3), the build leaves it out in `preview` mode, as its plan item says.
