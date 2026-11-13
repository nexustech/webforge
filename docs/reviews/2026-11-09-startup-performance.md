# Start-up performance review (9 Nov 2026)

What happens between launching Webforge and an editor you can use, what blocks it, and what could make it faster. It came with the start-up screen (#887), which covers the wait; the changes recommended here are **not** made. Each is a Phase 5 chore ([#892](https://github.com/nexustech/webforge/issues/892)–[#896](https://github.com/nexustech/webforge/issues/896)), measured with the cold-start check [#891](https://github.com/nexustech/webforge/issues/891). **Status since (13 Nov 2026):** all five are made. #892–#896 and the cold-start check #891 merged on 9 Nov (PRs #900, #902–#905, #908). The editor's V8 code cache (#893) was turned off again on 10 Nov (#910, PR #914): the product owner declined its residual risk (ADR 0023).

Architecture §10's target is a cold start to an editable canvas of a 5-page site in under 3 s on a mid-range laptop. Nothing measures that today: `e2e/perf/open-site.perf.ts` times opening a site from the start screen, which reloads the window but doesn't start the app; [#891](https://github.com/nexustech/webforge/issues/891) adds that check.

## How it was measured

- **Machine:** Windows 11, Intel Core i7-8750H, 16 GB: the same mid-range laptop as ADR 0007. Other worktrees' sessions shared it, so every figure is a range across runs, and the ranges are wide.
- **Build:** `electron-vite build` of `main` at 096dec4f, run from `out/` as the E2E tests run it.
- **The main process:** temporary `console.error(performance.now())` lines in the built `out/main/index.js` (never committed), with Electron started directly, not through Playwright, whose inspector slows the main process. Node's `performance.now()` counts from the process's start. A bare Electron app with one `whenReady()` gives the floor.
- **The renderer:** a throwaway Playwright script, launching the app 4 times with a 6-page site (the Shop template) and 4 times with none: the Navigation Timing and Paint Timing entries, and the time until the home page's `h1` shows in the canvas.
- **The bundles:** the size of each module in the built chunks, from the `// path` comments the bundler leaves in them.

## Where the time goes

| Stage                                  | Measured                                                             | What blocks                                                                  |
| -------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Process start → main's own code runs   | **1.3–2.3 s** (a bare Electron app: 0.17–0.23 s)                     | loading main's import graph; no window yet, nothing on screen                |
| → `ready`                              | +0.3–1.0 s                                                           | Electron                                                                     |
| → IPC handlers registered              | +0.04–0.12 s                                                         | preferences, wiring                                                          |
| → a double-clicked site opened         | +0.07–0.09 s                                                         | `openOrRecover`: SQLite open (recovery's dialogs only for a damaged file)    |
| → the window created                   | +0.2–0.5 s                                                           | `new BrowserWindow`                                                          |
| Page navigation → first paint          | 0.5–1.2 s                                                            | the renderer process, `index.html` and its stylesheets                       |
| → `DOMContentLoaded`                   | 1.3–2.4 s                                                            | loading and evaluating 7 MB of the editor's JavaScript                       |
| → first content drawn, **before #887** | **2.2–3.8 s**: an empty window until then (dark, whatever the theme) | the editor's scripts, then the site read over IPC, then React's first render |
| → the canvas shows the page            | 3.6–5.3 s with a site; the start screen at 2.2–2.6 s                 | the canvas: Puck's frame, then the site's CSS compiled in a worker           |

Since #887 the window draws the start-up screen at its first paint (first contentful paint 0.6–1.2 s), in the person's theme, and the time to a usable editor is unchanged within the noise (4.3–5.0 s from navigation with a site, 2.4–2.6 s without).

**What has to finish before the editor can be used:** the renderer's scripts, the four IPC reads in `main.tsx` (app info, preferences, the open site, its editor state) and React's first render. Opening a site in main before the window exists takes under 0.1 s, so it stays where it is. The canvas then draws in its own time (Puck's frame, then the compiled CSS); the rest of the editor works meanwhile.

## Recommendations

Most benefit first. **Measured** means the cost is measured; **hypothesis** means the cause or the gain still has to be shown.

### 1. Stop the main process loading the export's tooling at start-up ([#892](https://github.com/nexustech/webforge/issues/892))

- **Evidence (measured):** main's code starts running 1.3–2.3 s after the process, against 0.2 s for a bare Electron app, and no window can exist before it does. `out/main/index.js` imports a 5.1 MB chunk shared with the export worker: react-dom (1.1 MB, server rendering), terser (0.8 MB), lucide-static (0.5 MB), tailwindcss (0.36 MB), clean-css (0.34 MB), js-beautify, postcss, `@jsquash/jpeg` and basic-ftp, plus ssh2 and the MCP SDK from `node_modules`. Main uses a handful of names from that chunk (schemas, `publisherFor`, `PREVIEW_STYLESHEET`, the font catalogue); the tools themselves run in the workers.
- **Hypothesis:** most of the 1.1–2 s is loading and compiling that graph.
- **Change:** split what main imports from what only the workers run (schemas and small constants in modules of their own, so the bundler doesn't merge them with the export pipeline), and load publishing (ssh2, basic-ftp, Netlify), the MCP server and Site ZIP with `import()` when first used.
- **Benefit:** possibly 1 s or more before the window appears, on every launch.
- **Risk:** chunking is easy to undo with one import; a check that fails when `out/main/index.js`'s static graph grows past a budget would keep it. Lazy loading moves a delay to the first publish or the first AI app's request.
- **Measure:** `performance.mark` at the top of main's entry, at `ready` and when the window is created, logged by code in perf builds; a new `e2e/perf/cold-start.perf.ts` from launch to an editable canvas (architecture §10), on CI's nightly Performance job.

### 2. A V8 code cache for the editor's scripts and for main ([#893](https://github.com/nexustech/webforge/issues/893))

- **Evidence:** `APP_SCHEME_PRIVILEGES` (`main/app-scheme.ts`) has no `codeCache: true`. Chromium keeps a code cache for http(s) by default, but for a custom scheme only with that privilege, so the editor's 7 MB of JavaScript is probably compiled again on every launch. `DOMContentLoaded` comes 0.9–1.4 s after `domInteractive` (measured). Main doesn't call `module.enableCompileCache()` either.
- **Hypothesis:** a code cache saves most of the compile time on every launch after the first; the saving isn't measured.
- **Change:** `codeCache: true` in the scheme's privileges (it needs `standard: true`, which it has), and `module.enableCompileCache()` at the top of main's entry, with the cache in the user data folder.
- **Benefit:** perhaps 0.3–0.8 s on each warm start, for two small changes.
- **Risk:** the cache lives in the user's profile, and a new version's scripts have new names, so stale entries are ignored. The security review should confirm the privilege adds nothing else (S5).
- **Measure:** the renderer's `DOMContentLoaded` minus `domInteractive`, and main's first mark, on a second launch, with and without the cache.
- **Result (#893, 9 Nov):** the cold-start check three times with each build, alternating, on the machine above, after #892, #894 and #895. Medians of the 12 launches after the first, on the same profile (first launch in brackets):

  | Stage (ms)                                  | Without     | With both caches |
  | ------------------------------------------- | ----------- | ---------------- |
  | Main's first mark, after the process starts | 387 (407)   | 364 (454)        |
  | `DOMContentLoaded` − `domInteractive`       | 781 (803)   | 802 (1040)       |
  | The editor's first render, after navigation | 1922 (2033) | 1660 (2142)      |
  | A styled canvas, after the launch           | 3211 (3380) | 3036 (3477)      |
  - **The renderer's cache helps, later than expected:** V8 compiles most functions only when they first run, so the saving shows in React's first render (−0.26 s), not before `DOMContentLoaded`. The first launch, which builds the cache, is about 0.1 s slower. Kept in #893.
  - **Main's compile cache saves too little to measure:** since #892, main loads 1.4 MB at start-up, and Node's log showed every cached module accepted. Dropped. Both caches let someone who can write to the profile give the app code to run, and main's is checked against less: [ADR 0023](../adr/0023-app-scheme-and-canvas-boundary.md#amendment-9-nov-2026-893-the-code-cache).
- **Removed (10 Nov):** the product owner declined that risk for the renderer's cache too, so the scheme no longer has `codeCache` and neither cache is used: start-up is back to the table's "Without" column. Entries the cached build wrote are never read again (ADR 0023).

### 3. Start the canvas's CSS worker while the editor loads ([#894](https://github.com/nexustech/webforge/issues/894))

- **Evidence (measured):** a site's page appears in the canvas 1.3–1.5 s after the rest of the editor. The CSS that styles it comes from a utility process (`createCanvasStyles`, `main/canvas-css.ts`) that is forked only when the first compile is asked for, then loads `export-worker.js` (1.7 MB) and Tailwind.
- **Hypothesis:** much of that 1.3–1.5 s is the worker's start, which could overlap the renderer's 2–3 s of loading.
- **Change:** fork the canvas-styles worker as the window is created when a site is open (a double-clicked one), without a job.
- **Benefit:** perhaps 0.5–1 s off a styled canvas.
- **Risk:** one more process starts during the busiest second of start-up, and runs for nothing if the person stays on the start screen; start it only when a site is open.
- **Measure:** time from the editor's first render to `style[data-webforge-site-css]` in the canvas (what `waitForCanvas` waits for), in the cold-start perf check.

### 4. Collecting the site's classes before the first compile ([#895](https://github.com/nexustech/webforge/issues/895))

- **Evidence:** `connectSiteCss` (`renderer/editor/site-css.ts`) renders every page, the Header and the Footer to HTML twice, synchronously on the renderer's main thread, before it asks for the canvas's CSS. react-dom appears twice in the renderer's chunks (446 KB and 518 KB), probably its server renderer for this. Not timed.
- **Hypothesis:** this grows with the site and holds up the first paint of the canvas on large sites.
- **Change:** collect classes from the shown page first and the rest after, or in a worker, or keep the last set with the site (`uiState`).
- **Measure:** a perf mark around `siteClasses()` on the 20-page fixture site (`bench/`).

### 5. A smaller first bundle for the start screen ([#896](https://github.com/nexustech/webforge/issues/896))

- **Evidence (measured):** the start screen shares the editor's 7 MB of scripts (`main.tsx` imports `App` and `StartScreen` statically), and shows 2.4–2.6 s after navigation.
- **Change:** `import()` the editor only when a site is open, so the start screen loads a fraction of the code.
- **Benefit:** perhaps 1 s for a launch without a site, and the start-up screen's time in the window with it; little for a launch with a site.
- **Risk:** a second loading step when the start screen opens a site, which reloads the window anyway.
- **Measure:** the start screen's heading visible, from navigation.

## Not recommended

- **A second, splash window:** a window can't exist before main's code runs (recommendation 1 is the fix for that wait), and a second window brings the flash, focus and lifecycle problems the in-page screen avoids.
- **Opening the double-clicked site after creating the window:** it takes under 0.1 s; the reordering would make the renderer wait on main for nothing.
