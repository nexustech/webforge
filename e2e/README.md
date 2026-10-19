# @webforge/e2e

End-to-end tests with Playwright. They drive the real desktop app through Playwright's Electron support, so no browser download is needed.

| Folder | What |
|---|---|
| `app/` | Electron app tests. `smoke.spec.ts` checks the shell: window and version (main → IPC → preload → renderer), OS sandbox, no Node in the renderer, strict CSP, pop-ups and navigation blocked |

Exported-site, visual and accessibility suites (`e2e/export/`, `e2e/visual/`, `e2e/a11y/`, standards §5) will join this workspace later.

## Running
From the repository root:

```sh
pnpm e2e
```

This builds `apps/desktop` and runs the tests against the production build (`out/`, loaded from `file://`), with the Electron version that `apps/desktop` depends on. On Linux, run it under a virtual display (`xvfb-run --auto-servernum pnpm e2e`); CI does this.

## Writing tests
- Launch the app with `launchDesktopApp()` from `app/launch.ts`.
- Use `page` for the window (`page.evaluate()` callbacks run in the renderer) and `app.evaluate()` for the main process.
- Biome's Playwright rules apply here (no missing `await`, no `waitForTimeout`, no `page.pause()`).
