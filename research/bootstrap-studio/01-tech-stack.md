# Bootstrap Studio — Technology Stack

**Short answer: yes, Bootstrap Studio is an Electron application.** Everything in the editor (UI, canvas, code generation, export) is JavaScript running in Electron's renderer. The Node.js main process only handles OS-level jobs: files, HTTP servers, SASS, SFTP, updates.

Evidence comes from unpacking `resources/app.asar` from both installs on this machine (see [README](README.md#what-was-examined)).

## Current install: Bootstrap Studio 8.0.1 (built March 2026)

Location: `C:\Users\jabz_\AppData\Local\Programs\bstudio`

| Layer | Technology | Evidence |
|---|---|---|
| Desktop shell | **Electron 37.10.3** (Chromium 138, Node 22.x) | `Electron/37.10.3`, `Chrome/138.0.7204.251` strings in `Bootstrap Studio.exe`; `LICENSE.electron.txt` |
| Language | Plain **JavaScript** (ES2020+, classes). No TypeScript in the shipped code | `start.js`, `addons/*.js`; `eslint.config.mjs`, `.prettierrc.json` |
| UI framework | **None (no React, Vue or Svelte).** It uses jQuery plus hand-written classes and HTML template strings | ~700 `jQuery` references in `static.js`; panels built with `` $(`<div class=…>`) ``; no React runtime present |
| Bundler | **esbuild** (prod also uses terser). `chokidar` watches files in dev | `static.js` starts with esbuild's `__create/__defProp` prelude; confirmed by their CLAUDE.md |
| Renderer bundle | One 19 MB `app/static.js`, loaded by `app/index.html` | — |
| Main↔renderer | `ipcMain`/`ipcRenderer` plus **`@electron/remote`**. `nodeIntegration: true`, `contextIsolation: false` | `start.js` webPreferences |
| Code editor | **CodeMirror 5** | `assets/css/codemirror.css`, ~380 refs |
| CSS tooling | `postcss`, `clean-css` (minify), `specificity`, `css` parser; **Dart Sass** (`sass` npm) compiled in the main process | `node_modules/sass`, `helpers/compileSASS.js` |
| HTML tooling | `htmlparser2`, `domhandler`, `dom-serializer`, `sanitize-html`, `js-beautify` | module paths inside `static.js` |
| JS tooling | `terser` (minify on export), `acorn` | — |
| Diff / patch | `diff` (used by the AI assistant's SEARCH/REPLACE edits) | `package.json` |
| AI | **Vercel AI SDK** (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/gateway`, `ollama-ai-provider-v2`, `zod`) | module paths + model ids (`claude-sonnet-4-5`, `gpt-5`, `gemini-2.5-flash`…) |
| Publishing | `ssh2` / `ssh2-sftp-client` (native module, kept in `app.asar.unpacked`); their own bss.design hosting API | `addons/sftp-connection.js` |
| Live reload | Small `sse` library + an injected `livereload.js` | `addons/sseserver.js`, `embed/js/livereload.js` |
| Misc libs | `qrcode`, `pngjs`, `masonry-layout`, `moment`, `marked`, `chroma`, `fuzzaldrin` (command palette fuzzy search), `@sindresorhus/slugify`, `gravatar` | — |
| Packaging | **electron-builder** → NSIS installer on Windows (`Uninstall Bootstrap Studio.exe`, `elevate.exe`) | `resources/app-update.yml` |
| Auto-update | **electron-updater**, `provider: generic`, feed `https://bootstrapstudio.io/app/updates?token=<license>` | `addons/update.js` |
| Licensing | License key + named device, checked online; RSA public key in `bstudio.js` verifies an offline "Lab edition" key file | `helpers/is-lab-edition.js`, `index.html` activation form |
| Shared codebase | The same repo also builds **Mail Studio** (email designer). Separate entry points `bstudio.js` / `mstudio.js` | CLAUDE.md, render-worker `mstudio-export` command |

### Assets bundled for exported sites (`app/embed/`)
- Bootstrap **3, 4 and 5**. For BS5 there are **49 prebuilt theme builds**, i.e. one `bootstrap.min.css` per theme (default, Bootswatch themes such as cerulean/cosmo/cyborg/darkly/flatly, plus their own templates' themes)
- jQuery 1.12 → 4.0 (8 versions, selectable per design)
- Icon fonts and SVG sets: Font Awesome 4/5/6, Material Icons, Bootstrap Icons, Tabler, Heroicons, css.gg, Ionicons, Line Awesome, Simple Line Icons, Typicons
- Animate.css, AOS, Swiper, Chart.js, Lottie, their own "Smart Forms" JS
- Their own "Reflow" component kit (v1, v2), used for blog and e-commerce

## Legacy install: Bootstrap Studio 4.x shell (2017)

Location: `C:\Program Files\Bootstrap Studio`. The `version` file reads `v1.7.9`, but that is the **Electron** version, not the app version.

This was a ~300-line "thin shell". `main.js` simply ran `win.loadURL('https://bootstrapstudio.io/app/?shell=4')`. **The whole editor was a web app served from their server** (and cached by a Service Worker; 51 MB of it is still in `Roaming\bstudio\Service Worker`). The local Node code only provided:
- `httpserver.js`: preview server
- `sseserver.js`: live reload
- `sftp.js`: publishing
- `singleinstance.js`: named pipe `\\.\pipe\bootstrapstudio-sock`

Between v4 and v8 they moved from **remote-hosted web app** to **fully bundled local app** (`app/index.html` loaded via `file://`). That's a useful data point: bundling locally gives offline use, predictable versions and faster start-up.

## Takeaways for the stack
- A commercial, well-regarded visual builder has done fine for 10 years on **Electron + vanilla JS + jQuery**. The editor's hard parts (component model, canvas, serialisation) don't depend on a UI framework.
- The heavy tooling (Sass, minifiers, HTML parsing) is all **npm packages running inside Electron**. No external runtime is installed for the user, which matters for non-technical users.
- Their security posture is loose (`nodeIntegration` on, `contextIsolation` off, `allowRunningInsecureContent`). That's fine for a trusted local app but not something to copy (see [05-lessons-for-webforge.md](05-lessons-for-webforge.md)).
