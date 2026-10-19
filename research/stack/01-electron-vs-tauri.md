# Desktop Shell: Electron vs Tauri

**Status:** Research complete, 2026-10-19
**Recommendation:** **Electron** (confirms the initial preference), with a secure-by-default setup. Revisit Tauri only if install size becomes a real user complaint *and* Tauri's Chromium (CEF) runtime has reached stable.

## TL;DR

For most apps, Tauri's smaller size and memory use win. **Webforge is not most apps.** It is a visual designer whose canvas must show users *exactly* what their published site will look like, and whose core build step (Tailwind CSS) is a JavaScript tool. Both facts favour Electron:

1. **Rendering fidelity.** Electron ships one known Chromium version everywhere. Tauri uses whatever web engine the OS provides: Edge/Chromium on Windows and **Safari's WebKit on macOS**. A designer that renders differently on each OS, and changes behaviour whenever Apple ships a Safari update, is a support burden.
2. **Tailwind and the build toolchain run natively in Node.** In Electron, Tailwind v4, PostCSS, HTML parsing and minifiers are just `import`s in the main process (the same way Bootstrap Studio runs Dart Sass). In Tauri they need a bundled Node "sidecar" binary, a Rust rewrite, or the dev-only in-browser Tailwind build.
3. **Proven precedent.** Bootstrap Studio, the closest product to Webforge, has shipped on Electron for 10 years. VS Code, Figma's desktop app, Notion and Slack also run on Electron.

Tauri's main counter-argument is size: ~5–15 MB vs ~100+ MB installers. For a design tool installed once and used for hours, that matters less than fidelity.

## Current state (October 2026)

| | Electron | Tauri |
|---|---|---|
| Latest stable | **44.x** (Chromium 152, Node 24), released Aug 2026 | **2.12.x** (Oct 2026) |
| Next | New major every **8 weeks**; latest **3 majors** supported (~6 months each) | **3.0 alpha** (Oct 2026) adds an optional **CEF (Chromium) runtime** |
| Backend language | JavaScript/TypeScript (Node.js) | **Rust** (+ JS frontend) |
| Web engine | Bundled Chromium, same on every OS | System webview: **WebView2** (Win), **WKWebView/Safari** (macOS), WebKitGTK (Linux) |
| Licence | MIT | MIT / Apache-2.0 |
| Adoption | ~4M weekly npm downloads, ~121K GitHub stars | ~1.3M weekly (`@tauri-apps/api`), ~107K stars |

## Head-to-head for Webforge's requirements

| Requirement / concern | Electron | Tauri 2 | Winner |
|---|---|---|---|
| **Canvas matches published site** | Identical Chromium on Win + Mac; pinned per release | Chromium on Windows, Safari on macOS; version is set by the user's OS, not you | **Electron** |
| **Tailwind v4 compilation** (needs Chrome 111 / Safari 16.4+) | Run `tailwindcss` / `@tailwindcss/node` in-process | Node sidecar (pkg/SEA binary per platform), Tailwind standalone CLI as sidecar, or port to Rust | **Electron** |
| Other build tooling (HTML parse, minify, image optimisation, Sass) | Entire npm ecosystem in-process (e.g. `sharp`, `terser`, `htmlparser2`) | Rust crates (`lightningcss`, `image`) or sidecar | Electron (one language) |
| **Live preview server** (HTTP + SSE live reload, Bootstrap Studio-style) | Node `http` in main process: ~100 lines | Rust (`axum`/`tiny_http`) or sidecar; very doable | Tie (slight edge to Electron: one language) |
| Multi-breakpoint canvas, thumbnails, screenshots | `WebContentsView`, `capturePage()`, device emulation, Chrome DevTools Protocol all built in | Multi-webview still maturing; no built-in page capture on all platforms | **Electron** |
| Inline text editing (`contenteditable`) and drag-drop | One engine's quirks to handle | Two engines' quirks (WebKit `contenteditable` differs from Chromium) | **Electron** |
| **Installer size** | ~80–150 MB installer. Bootstrap Studio: **535 MB installed** (196 MB exe + 216 MB app bundle, inflated by bundled templates and assets) | ~5–15 MB typical | **Tauri** |
| Memory at idle | ~100–300 MB | ~20–100 MB | **Tauri** |
| Startup time | Slower (Chromium boot) | Faster | Tauri |
| **Install / auto-update** (requirement) | `electron-builder` (NSIS/DMG) + `electron-updater`, or Electron Forge + `update.electronjs.org`. Mature; used by Bootstrap Studio | Built-in bundler (NSIS/MSI, DMG) + updater plugin with mandatory signed manifests. Good in v2. Windows update forces app exit | Tie |
| Update payload size | Large when Chromium changes (~every 8 weeks) | Small; web engine updates come from the OS | Tauri |
| Code signing / notarisation | Required on macOS for both; well documented | Same requirement; well documented | Tie |
| Security model | Powerful but opt-in: you must enable `contextIsolation`, `sandbox` and a preload bridge (Bootstrap Studio doesn't) | **Secure by default**: capability/permission system, Rust backend, no Node in the webview | **Tauri** |
| Maintenance cadence | Must bump Electron at least every ~6 months to stay supported | Engine security patches come with the OS | Tauri |
| Team skills / hiring | JS/TS only | JS/TS **plus Rust** for any native feature | **Electron** |
| Ecosystem maturity for desktop editors | Very deep (VS Code, Figma, Bootstrap Studio, Obsidian) | Growing fast, fewer complex-editor precedents | Electron |
| Mobile (future) | None | iOS/Android in v2 (not a Webforge requirement) | Tauri (n/a) |

## The deciding issue: rendering fidelity

Webforge's canvas is where non-technical users judge their site. With Tauri on macOS:
- The canvas renders with **WKWebView, which matches the installed Safari version**. Two Mac users on different macOS/Safari versions can see different results, and you can't pin or ship a fix.
- Tailwind v4 needs Safari 16.4+. That's fine on current Macs, but it creates a support floor you don't control.
- Editor interactions built on `contenteditable`, selection ranges, HTML5 drag-and-drop and `ResizeObserver` timing behave subtly differently in WebKit vs Chromium. You end up testing and patching two engines **for the editor itself**, not just the output.

*Counterpoint:* seeing Safari rendering on a Mac is arguably "real". But users publish for all browsers. Cross-browser checking belongs in the **live preview** feature (open the preview in Safari, Firefox or a phone), which works the same with either shell. The **editing canvas** needs to be predictable.

### What about Tauri 3 + CEF?
Tauri 3.0 (alpha, Oct 2026) can swap the system webview for a bundled Chromium (CEF). That would remove the fidelity problem, but:
- It's **alpha**, and the Tauri team recommends production stay on 2.x.
- Bundles grow by **hundreds of MB**, which erases Tauri's size advantage. The first build also downloads ~1 GB per platform and needs CMake/Ninja.
- **Windows runs unsandboxed** under CEF (no sandbox broker since Chromium M138). Only `en-US` locale ships, and it is one runtime per binary.
- You still need Rust and still lack in-process Node for Tailwind.

At that point Tauri+CEF is "Electron with a Rust backend". That's worth watching, but no reason to choose it today.

## Risks of choosing Electron, and mitigations

| Risk | Mitigation |
|---|---|
| Large download (~100 MB+) | Acceptable for a design tool. Keep templates/assets downloadable on demand rather than bundled (Bootstrap Studio bundles everything, hence 535 MB). Use differential updates (`electron-updater` supports blockmap diffs for NSIS) |
| Memory use | Fine on modern dev/design machines. Avoid one renderer per breakpoint if possible; consider one canvas + scaled previews |
| Security footguns | Start secure from day one: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, a typed `preload` + `contextBridge` API, no `@electron/remote`. Render user sites in a separate `WebContentsView`/iframe with no Node access. Turn on Electron Fuses (disable `RunAsNode`, enable ASAR integrity) |
| 8-week upgrade treadmill | Plan a quarterly Electron bump. Keep native modules to a minimum (prefer pure JS/WASM) so upgrades are painless |
| Chromium-only output bias | Live preview in the user's real browsers + an optional "check in Safari/Firefox" prompt before publishing |

## Suggested Electron baseline (to validate in a spike)

- **Tooling:** ✅ **Decided 2026-10-19: electron-builder + electron-updater** (mature since 2015, actively released, MIT; Bootstrap Studio uses it; strongest NSIS/DMG + auto-update story), with **electron-vite** for development builds. No Forge comparison spike needed.
- **Processes:**
  - **Main:** file I/O, project save/load, preview HTTP + SSE server, Tailwind compile, export, updater
  - **Editor UI renderer:** isolated, via `contextBridge`
  - **Canvas:** sandboxed iframe or `WebContentsView` showing the user's page
- **Tailwind:** compile in the main process (or a `utilityProcess` worker so the UI never stalls) on each model change. Send CSS to the canvas and preview via IPC/SSE.
- **Distribution:** Windows NSIS (per-user, no admin) and macOS DMG with Developer ID signing + notarisation, plus a generic update feed (S3/R2 or GitHub Releases).

## Spike to confirm (≈2–3 days)
1. Hello-world Electron app built with the secure baseline above, packaged as a signed Windows installer and macOS DMG, with auto-update from a static feed. Measure installer size, cold start and idle memory.
2. In-process Tailwind v4 compile of a generated page: time a full and an incremental build.
3. Canvas iframe with click-to-select overlay + `contenteditable` text editing + live preview over SSE to a phone.

If all three hold up, lock in Electron and move on to the next open question (UI framework / canvas engine).

## Sources
- [Electron release & support schedule — endoflife.date](https://endoflife.date/electron)
- [Electron Releases](https://releases.electronjs.org/)
- [Electron vs Tauri 2026 — PkgPulse](https://www.pkgpulse.com/guides/electron-vs-tauri-2026) (size/memory ranges, adoption figures)
- [Tauri releases (2.12.x stable, 3.0 alpha)](https://releasealert.dev/github/tauri-apps/tauri) · [GitHub releases](https://github.com/tauri-apps/tauri/releases)
- [Tauri 3 — Chromium Embedded Framework docs](https://v3.tauri.app/develop/cef/)
- [Independent Tauri 3 CEF evaluation (kontourai/station #3527)](https://github.com/kontourai/station/issues/3527)
- [Tauri 2 — Node.js as a sidecar](https://v2.tauri.app/learn/sidecar-nodejs/)
- [Tauri 2 — Updater plugin](https://v2.tauri.app/plugin/updater/)
- [Tailwind CSS v4 browser compatibility](https://tailwindcss.com/docs/compatibility)
- [Tauri vs Electron for indie hackers 2026 — DEV](https://dev.to/devtoolpicks/tauri-vs-electron-for-indie-hackers-in-2026-honest-comparison-o0e)
- Local measurement: Bootstrap Studio 8.0.1 install folder (see [../bootstrap-studio/01-tech-stack.md](../bootstrap-studio/01-tech-stack.md))
