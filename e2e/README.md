# @webforge/e2e

End-to-end tests with Playwright: the real desktop app (Playwright's Electron support) and the sites it exports (Chromium, Firefox and WebKit).

| Folder | What |
|---|---|
| `app/` | Electron app tests. `smoke.spec.ts` checks the shell: window and version (main → IPC → preload → renderer), OS sandbox, no Node in the renderer, strict CSP, pop-ups and navigation blocked, creating and opening a `.wforge` site |
| `app/export.spec.ts` | **Export site** from the editor: the page is built in the export utility process and written to the chosen folder; folders with other files are refused |
| `export/` | `export.setup.ts` exports the two-page fixture site (with photo) through the app; `exported-site.spec.ts` then opens it from disk (`file://`) in Chromium, Firefox and WebKit with the network blocked: styles, fonts, image, links, mobile menu, FAQ keyboard access, axe (X1, C8) |
| `packaged/` | Tests of the packaged app (`pnpm e2e:packaged`): opens a `.wforge` passed on the command line |

Visual-regression and template accessibility suites (`e2e/visual/`, `e2e/a11y/`, standards §5) will join this workspace later.

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

```sh
pnpm e2e:packaged
```

This packages the app with `electron-builder --dir` (asar, Fuses, unpacked better-sqlite3) and runs `packaged/` against the packaged executable on Windows or macOS. Fuses switch off `--inspect`, so these tests start the executable themselves and connect over the Chrome DevTools Protocol; they reach the renderer only ([ADR 0003](../docs/adr/0003-wforge-sqlite-storage.md)).

## Writing tests
- Launch the app with `launchDesktopApp()` from `app/launch.ts`.
- Use `page` for the window (`page.evaluate()` callbacks run in the renderer) and `app.evaluate()` for the main process.
- Biome's Playwright rules apply here (no missing `await`, no `waitForTimeout`, no `page.pause()`).
