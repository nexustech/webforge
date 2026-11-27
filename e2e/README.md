# @webforge/e2e

End-to-end tests with Playwright: the real desktop app (Playwright's Electron support) and the sites it exports (Chromium, Firefox and WebKit).

| Folder               | What                                                                                                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`               | Electron app tests. `smoke.spec.ts` checks the shell: window and version (main → IPC → preload → renderer), OS sandbox, no Node in the renderer, strict CSP, pop-ups and navigation blocked, creating and opening a `.wforge` site                                                  |
| `app/export.spec.ts` | **Export site** from the editor: the page is built in the export utility process and written to the chosen folder; folders with other files are refused                                                                                                                             |
| `export/`            | `export.setup.ts` exports the two-page fixture site (with photo) through the app; `exported-site.spec.ts` then opens it from disk (`file://`) in Chromium, Firefox and WebKit with the network blocked: styles, fonts, image, links, mobile menu, FAQ keyboard access, axe (X1, C8) |
| `packaged/`          | Tests of the packaged app (`pnpm e2e:packaged`): opens a `.wforge` passed on the command line                                                                                                                                                                                       |
| `visual/`            | Editor UI stories (`pnpm visual`): every Storybook story of `packages/editor-ui` in dark and light, with axe (no serious or critical violations) and, in CI's Linux container, a screenshot compared with `visual/__screenshots__/` (R8)                                            |
| `perf/`              | Large-page performance check (`pnpm e2e:perf`): typing, dragging, undo/redo and memory on a 225-element page against architecture §10 ([ADR 0007](../docs/adr/0007-large-page-performance.md)). On demand only, not in CI                                                           |

The template accessibility suite (`e2e/a11y/`, standards §5) will join this workspace later.

## Running

Once per machine, install the browsers for the exported-site tests:

```sh
pnpm --filter @webforge/e2e exec playwright install chromium firefox webkit
```

Then, from the repository root:

```sh
pnpm e2e
```

This builds `apps/desktop` and runs the tests against the production build (`out/`, loaded from `file://`), with the Electron version that `apps/desktop` depends on. On Linux, run it under a virtual display (`xvfb-run --auto-servernum pnpm e2e`); CI does this.

CI runs the tests in parts side by side on each OS (#1286): the app's (`--project=app`) in shards, two on Linux and three on Windows and macOS, and the exported site's (`--project=export-setup` and the browsers) in a job of its own, whose exported site Linux's Firefox and WebKit job opens. Playwright's `--shard` splits by test count, and an app test takes several times an export test, so the two are sharded apart. To run one part locally:

```sh
pnpm e2e --project=app --shard=2/3
pnpm e2e --project=export-setup --project=export-chromium
```

To check that a test waiting on timing, such as a drag, holds on a busy runner, slow the app's renderer from the moment its canvas shows (`waitForCanvas`) with `WEBFORGE_E2E_CPU_SLOWDOWN`, how many times slower, and repeat it ([anti-pattern 22](../docs/anti-patterns.md)):

```sh
WEBFORGE_E2E_CPU_SLOWDOWN=3 pnpm --filter @webforge/e2e exec playwright test --project=app app/shared-layout.spec.ts --repeat-each 20
```

In PowerShell:

```powershell
$env:WEBFORGE_E2E_CPU_SLOWDOWN=3; pnpm --filter @webforge/e2e exec playwright test --project=app app/shared-layout.spec.ts --repeat-each 20
```

That stays set for the rest of the session: `Remove-Item Env:WEBFORGE_E2E_CPU_SLOWDOWN` turns it off.

```sh
pnpm e2e:packaged
```

This packages the app with `electron-builder --dir` (asar, Fuses, unpacked better-sqlite3) and runs `packaged/` against the packaged executable on Windows or macOS. Fuses switch off `--inspect`, so these tests start the executable themselves and connect over the Chrome DevTools Protocol; they reach the renderer only ([ADR 0003](../docs/adr/0003-wforge-sqlite-storage.md)).

```sh
pnpm visual
```

This builds the editor UI's Storybook (`packages/editor-ui/storybook-static`, served on 127.0.0.1 by `visual/serve-storybook.ts`) and runs `visual/` in Chromium: axe on every story in both themes. Screenshots are compared only with `VISUAL_SCREENSHOTS=1`, which CI sets in the pinned `mcr.microsoft.com/playwright` Linux container, because fonts and anti-aliasing differ between machines. To make or update screenshots before CI, run `pnpm visual:docker` (Docker Desktop running): it runs these tests in that same container on this machine and writes screenshots for new stories into `visual/__screenshots__/`; after an intended visual change, `pnpm visual:docker --update` rewrites the changed ones. Commit them with the PR. If a PR reaches CI without them, CI writes the missing ones, fails, and uploads them as the `visual-screenshots` artifact. CI runs the stories and templates in three shards side by side (`--shard=1/3` and so on, #1347), each with Playwright's two workers: more made screenshots time out under load (#754).

```sh
pnpm e2e:perf
```

This builds the app in perf mode (`electron-vite build --mode perf`, which adds the `__webforgePerf` hooks for loading a large page and adding history steps) and runs `perf/`. Results are printed and written to `perf-results/large-page.json` (git-ignored; outside `test-results/`, which every Playwright run empties). Budget misses fail softly, so every measurement is still recorded. `perf/cold-start.perf.ts` starts the app itself rather than through Playwright's launcher, which holds Electron's `ready` back, and connects to its window over DevTools: it times each stage from the launch to an editable canvas (#891), from the line a perf build's main process logs and the window's own marks, and writes them to `perf-results/cold-start.json`, the first launch on a new profile apart from the later ones. It times launches without a site too, to the start screen's first render (`startScreen`, #896). Timings depend on the machine; compare runs on the same one. Afterwards run `pnpm e2e` (or rebuild) before the other tests: the smoke test checks that normal builds don't contain the hooks.

## Writing tests

- Launch the app with `launchDesktopApp()` from `app/launch.ts`.
- Use `page` for the window (`page.evaluate()` callbacks run in the renderer) and `app.evaluate()` for the main process.
- Biome's Playwright rules apply here (no missing `await`, no `waitForTimeout`, no `page.pause()`).
- **Every dialog and panel fits the window:** `app/dialog-fit.spec.ts` (#1433) opens each dialog, menu and panel in `CASES`, in six rounds (960 × 600 and 1366 × 768 in Dark and Light, 1366 × 768 at 125% text, and 1440 × 900 at 150% for the dialogs alone), and holds each to `app/fits.ts`'s rules: inside the window and below the title bar, nothing scrolling sideways, no scrolling itself as well as a list inside it, its top still through its changes of state (Dark rounds), and the title bar fitting with its optional controls showing.
  - Each case is a step with soft checks, so one failing dialog doesn't hide the rest; a case that leaves something open starts the app again for the next, and the round lists it.
  - A fault filed and not yet fixed goes in `KNOWN_FAULTS`, with its issue. The check then asserts that exact rule still fails there, and fails once it passes, so the fix removes the entry. Nothing is skipped silently.
  - A failure names the case, the round and what was measured (anti-pattern 20). Its last test breaks one dialog per rule on purpose, to show each check catches it.

### Motion is off (#1493)

Tests run with motion off, so none reads the screen while something on it still moves.

- **What's off:** every page asks for reduced motion, and has a sheet that ends each transition and animation at once (`no-motion.ts`; 0.01 ms, so `transitionend` and `animationend` still fire).
- **The app:** `launchDesktopApp()` applies both to each window and frame, the canvas's included, from the test's side, as Playwright's `reducedMotion` doesn't reach Electron's windows.
- **The exported site:** its projects set `reducedMotion: "reduce"`, and `export/test.ts` adds a sheet with no transitions or animations at all, as no script of the site's waits for one's end with reduced motion, and WebKit didn't always finish a 0.01 ms one before a test read it. Its specs import `test` and `expect` from `./test.js`, never `test` from `@playwright/test`; Biome says so.

A test about motion itself turns it back on, and says why:

- **The app:** `launchDesktopApp({ motion: true })`. The performance suite does, as it measures what people wait for.
- **The exported site:** `test.use({ motion: true, reducedMotion: "no-preference" })` in its `describe`.
- **A test of reduced motion itself** still asks for it with `page.emulateMedia({ reducedMotion: "reduce" })`, so it reads the same either way.
