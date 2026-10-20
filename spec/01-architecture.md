# Webforge Architecture

**Version:** 1.0 (consolidated from research, 2026-10-19)
**Status:** Baseline. Items marked 🔬 must be confirmed by the prototype spikes ([02-mvp-spec.md](02-mvp-spec.md#6-milestones))
**Sources of truth:** decisions are referenced by ID (e.g. **C5**, **X1**) and link back to the research notes in [`../research/`](../research/README.md). The full register is at the end of this document.

## 1. What Webforge is
A **paid, closed-source desktop app** (Windows 10/11 x64 + macOS 13+ on Apple Silicon) that lets **DIY small-business owners** build responsive websites visually:
- **Building:** drag-and-drop sections and elements, click-to-edit text, themes.
- **Output:** a **self-contained static site** (flat HTML/CSS/JS, no server, no CDN) that can be uploaded anywhere or opened from disk.
- **Publishing:** to a folder/ZIP, FTP/FTPS/SFTP or Netlify.

## 2. Technology stack

| Layer | Choice | Decision |
|---|---|---|
| Desktop shell | **Electron 44** (Chromium 152, Node 24), secure-by-default configuration | [01](../research/stack/01-electron-vs-tauri.md) |
| Language | **TypeScript 7** (strict), ESM | [03-engineering-standards](03-engineering-standards.md) |
| Editor UI | **React 19** (+ React Compiler) + **shadcn/ui** on **Tailwind v4**; Bootstrap Studio-like layout and dark theme (UI1) | [02](../research/stack/02-react-vs-svelte.md), [product/04](../research/product/04-editor-look-and-feel.md) |
| Editor state | **Zustand** stores + **Immer** patches; custom History Manager | [03 undo](../research/stack/03-undo-redo.md) |
| Canvas / editor engine | **Puck** (MIT) behind a `CanvasEngine` adapter (C6) ✅ go, runs under our history ([ADR 0004](../docs/adr/0004-puck-with-webforge-history.md)); fallback: own canvas on dnd-kit + Tiptap | [04](../research/stack/04-canvas-engine.md) |
| Rich text | **Tiptap** (MIT packages only) via Puck `richtext` fields | 04, C1 |
| Site components | React components rendering static HTML + Tailwind + **daisyUI 5**; small vanilla `webforge.js` for behaviour | [05](../research/stack/05-site-components.md) |
| Project file | Single **`.wforge`** = **SQLite** DB via **better-sqlite3** ✅, content-addressed blobs, versions | [06](../research/stack/06-project-file-format.md) |
| Build / preview pipeline | In-app: Puck render → Tailwind v4 (programmatic) + daisyUI → esbuild → jSquash images; runs in an Electron `utilityProcess` | [07](../research/stack/07-export-pipeline.md) |
| Publishing | Folder/ZIP · `basic-ftp` · `ssh2-sftp-client` · Netlify REST API | [08](../research/stack/08-publishing.md) |
| Packaging & updates | **electron-vite** (dev/build) + **electron-builder** (NSIS / DMG) + **electron-updater** ✅ (decided 2026-10-19, no Forge comparison needed) | 01 |

Licensing rule for every dependency: **permissive only** (MIT, BSD, Apache-2.0, ISC); MPL-2.0 OK unmodified; **no GPL/AGPL**, and no paid add-ons (C1). Enforced in CI.

## 3. Process model

```mermaid
flowchart TB
  subgraph Main["Main process (Node)"]
    APP[App lifecycle · menus · single instance · file association .wforge]
    STORE[ProjectStore: SQLite .wforge]
    PREV[Preview server: HTTP + SSE live reload]
    PUB[Publishers: Folder/ZIP · FTP/FTPS/SFTP · Netlify]
    KEY[Credentials: safeStorage / OS keychain]
    UPD[Auto-updater]
  end
  subgraph Worker["utilityProcess: Build worker"]
    PIPE[Pipeline: render → classes → Tailwind/daisyUI → esbuild → images → site files → checks]
  end
  subgraph Renderer["Renderer: Editor UI (sandboxed, contextIsolation)"]
    UI[React + shadcn/ui panels]
    DOC[Document store · History Manager · UI store]
    ENG[CanvasEngine adapter → Puck]
  end
  subgraph Canvas["Canvas iframe (sandboxed, site styles only)"]
    SITE[User's page: site components + site Tailwind CSS]
  end
  UI <--> DOC
  DOC <--> ENG
  ENG <--> SITE
  Renderer <-- "typed IPC via preload/contextBridge" --> Main
  Main <-- "MessagePort" --> Worker
  PREV -- "HTML/CSS from worker cache" --> Browser[(Browsers / phones on LAN)]
```

| Process | Responsibilities | Must never |
|---|---|---|
| **Main** | Window/menus, open/save `.wforge`, autosave transactions, versions, preview HTTP/SSE server, publishing, credentials, updates | Render UI; hold editor state of truth |
| **Preload** | Exposes a **typed, minimal API** via `contextBridge` (`window.webforge.*`) | Expose `ipcRenderer`, Node or Electron objects directly |
| **Renderer (editor)** | UI, the in-memory document, history, selection, canvas engine | Access Node/fs directly (`nodeIntegration: false`, `sandbox: true`) |
| **Canvas iframe** | Shows the page being edited with the **site's** CSS only (C8, `syncHostStyles: false`) | Load editor styles; run custom scripts unless the user enables it (05) |
| **Build worker** (`utilityProcess`) | Export/preview builds, image conversion, Site Check | Block the UI; touch the network except during publish |

**Electron hardening:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, no `@electron/remote`, strict CSP, `will-navigate`/`window.open` handlers, Electron Fuses (disable `RunAsNode`, enable ASAR integrity, cookie encryption).

## 4. Package / module structure (pnpm monorepo)

```
wforge/
├── apps/
│   └── desktop/                 Electron app (main, preload, renderer) via electron-vite
├── packages/
│   ├── model/                   Document schema (zod), IDs, migrations, glossary-driven labels
│   ├── history/                 History Manager: transactions, coalescing, labels, selection restore
│   ├── storage/                 .wforge SQLite store: blobs, documents, versions, GC, backup
│   ├── engine/                  CanvasEngine interface + Puck implementation (only place Puck is imported)
│   ├── site-components/         Section & element components, fields, daisyUI markup, webforge.js behaviours
│   ├── themes/                  Curated themes, fonts catalogue, theme → Tailwind @theme generation
│   ├── pipeline/                Render, Tailwind compile, esbuild, images, site files, Site Check rules
│   ├── publish/                 Folder/ZIP, FTP/FTPS/SFTP, Netlify publishers + manifest diffing
│   ├── editor-ui/               shadcn/ui-based editor components, panels, dialogs
│   ├── i18n/                    UI strings (English for MVP), glossary terms
│   └── test-utils/              Fixtures (sample sites, .wforge files per format version), helpers
├── e2e/                         Playwright Electron tests
├── spec/  research/             Documentation
└── tools/                       Scripts (licence check, release, fixture generation)
```

**Dependency rules** (enforced with dependency-cruiser):
- `model`, `history`, `storage`, `pipeline`, `publish` are **framework-free** (no React), except `pipeline` rendering through `site-components`.
- **Only `engine` imports Puck.** Only `editor-ui` and `apps/desktop/renderer` import shadcn/ui.
- Renderer code never imports Node built-ins; main-process code never imports React.
- `site-components` must not import editor code. Its output must render to static HTML.

## 5. Core data model

```
Site (.wforge)
├── settings          Site Settings (X3): name, description, language, URL, social, contact, analytics (B4),
│                     search engines, publish destinations (no secrets), allowed external URLs (C8)
├── theme             Theme preset + brand colours, fonts, radius, spacing (05), stored as CSS-variable tokens
├── layout            Header, Footer (C5): Puck data, stored once, rendered on every page
├── pages[]           Page: slug → about.html (X1), Page Settings, Puck data (sections → elements)
├── media[]           Originals (images, fonts, files) as content-addressed blobs
├── code              custom.css, custom.js, head/body snippets (C7, Advanced mode)
├── versions[]        Named + automatic versions (P3: last 20 automatic, configurable)
└── history           Optional persisted Undo History (D6)
```

- **Element tree:** Puck data (sections and elements with typed props). Every node has a stable `id` and a friendly display label (D2).
- **Styling props** map to Tailwind/daisyUI classes through **design-token fields** (e.g. Padding: Medium → `py-12`), per breakpoint (Desktop · Tablet · Mobile).
- **Format versioning:** `format_version` integer with a migration chain; old versions are migrated lazily (06).

## 6. Key interfaces

```ts
// packages/engine
interface CanvasEngine {
  mount(el: HTMLElement, opts: { library: ComponentLibrary; theme: Theme }): void
  loadPage(page: PageDoc, layout: LayoutDoc): void
  applyChange(change: DocChange): void
  onUserEdit(cb: (edit: EngineEdit) => void): Unsubscribe
  select(nodeId: string | null): void
  onSelectionChange(cb: (nodeId: string | null) => void): Unsubscribe
  onHistoryCommand(cb: (command: 'undo' | 'redo') => void): Unsubscribe   // keys pressed inside the canvas iframe (ADR 0004)
  setViewport(v: 'desktop' | 'tablet' | 'mobile' | number): void
  setMode(mode: 'design' | 'content'): void            // M3
  renderStatic(page: PageDoc, layout: LayoutDoc): string
  destroy(): void
}

// packages/history
interface HistoryManager {
  readonly document: ReadonlyStore<SiteDoc>   // read-only; changes go through run/begin
  run(label: Label, recipe: (draft: SiteDraft) => void, opts?: { coalesceKey?: string }): void
  begin(label: Label): Transaction            // gestures: drag, slider (commit / cancel)
  undo(): boolean; redo(): boolean; jumpTo(entryId: string | null): boolean   // null = before the first step
  entries(): readonly HistoryEntry[]          // Undo History panel (D3)
  endSession(coalesceKey: string): void       // text session ends: merge its chunks into one step (D1)
  breakCoalescing(): void
}

// packages/storage
interface ProjectStore {
  open(path: string): Promise<SiteSnapshot>   // runs migrations
  commit(patches: Patch[]): Promise<void>     // autosave transaction (P2)
  saveVersion(name: string, kind: 'manual' | 'auto'): Promise<VersionId>
  restoreVersion(id: VersionId): Promise<SiteSnapshot>
  exportZip(path: string): Promise<void>; gc(): Promise<void>
}

// packages/pipeline
interface Pipeline {
  build(snapshot: SiteSnapshot, mode: 'preview' | 'export' | 'publish'): AsyncIterable<BuildEvent>
  check(snapshot: SiteSnapshot, mode: 'export' | 'publish'): Promise<CheckResult[]>   // X5
}

// packages/publish
interface Publisher {
  test(dest: Destination): Promise<TestResult>
  publish(build: BuildOutput, dest: Destination, signal: AbortSignal): AsyncIterable<PublishEvent>
}
```

## 7. Key flows

**Edit:**
1. A user action produces `history.run(label, recipe)`, which applies an Immer patch to the document store.
2. The engine updates the canvas.
3. The autosave debounce (~2 s, max 30 s) commits the patches to SQLite (P2).
4. The preview cache is invalidated, and the worker rebuilds the affected page and CSS. SSE pushes a CSS hot-swap or a page reload.

**Undo:**
1. Apply inverse patches.
2. Restore selection, page and viewport (D1–D7).
3. Autosave.

**Export:**
1. Snapshot.
2. Site Check (export rules, X5).
3. Render.
4. Collect classes.
5. CSS (readable, X4).
6. JS (classic scripts, X1).
7. Images (WebP + JPEG/PNG fallback, X2).
8. Site files.
9. Format.
10. Write to a temp folder, then atomically swap it in.

**Publish:**
1. Build with the stricter publish checks (X5).
2. Diff against the destination manifest.
3. Upload assets → pages → `index.html`.
4. Verify.
5. Record an automatic version "Published …" (08).

## 8. Exported site contract
- Flat pages (`index.html`, `about.html`, `services/web-design.html`), relative URLs, opens from disk (X1).
- `assets/css/site.<hash>.css` (readable), `assets/js/webforge.<hash>.js` (classic `defer`, only if needed), `assets/fonts/*.woff2` (Fontsource, OFL), `assets/img/*` (WebP + fallback), favicons, `site.webmanifest`, `sitemap.xml` + canonical links if the URL is set, `robots.txt`, `404.html`.
- **No external requests** except explicitly allowed ones: GA4 `gtag.js` (B4, behind the consent banner B7) and per-URL user allow-list entries.
- Forms POST to the configured form service (B3/B6); Buy buttons are plain links (M1).

## 9. Security & privacy
- **Secrets never in `.wforge`.** Publish credentials live in the OS keychain via `safeStorage` (08).
- **Untrusted projects:** validate the SQLite schema, use SQLite defensive mode, and custom scripts are off in the editor by default.
- **Canvas iframe sandboxed;** no Node access anywhere in renderer contexts.
- **Network:** the editor makes no network calls except updates, publishing, Netlify OAuth and user-initiated "Download and bundle" (C8).
- **Crash reports (local only):**
  - Electron `crashReporter.start({ uploadToServer: false })` for native crashes (minidumps in `app.getPath('crashDumps')`).
  - Main, renderer and worker handlers for uncaught errors and unhandled rejections write a JSON report to `<userData>/crash-reports/crash-<YYYYMMDD-HHMMSS>-<process>.json` (UTC; Windows-safe filename).
  - **Report contents:**
    - app, Electron and OS versions
    - process type
    - error name, message and stack
    - the last ~50 breadcrumbs (action *types* and panel names only)
    - memory usage
  - **Never included:** site content, file paths beyond the app's own, credentials or personal data.
  - Retention: last 50 reports / 90 days.
  - **No automatic upload.** Future enhancement: an in-app viewer and an optional, user-initiated "Share with support".
- **Exported sites:** privacy-first by default (self-hosted fonts, consent banner for GA, click-to-load embeds).

## 10. Performance targets
| Metric | Target |
|---|---|
| Cold start to editable canvas (5-page site) | < 3 s on a mid-range laptop |
| Keystroke / drag to canvas update | < 16 ms (no dropped frames) |
| CSS-only change → preview browser | < 100 ms |
| Page re-render in preview | < 200 ms |
| Autosave commit | < 50 ms, off the UI thread |
| Full export, 20 pages, images cached | < 5 s |
| Installer size | ≤ 150 MB (templates/fonts beyond the core set downloadable) |

## 11. Decision register

| ID | Decision | Note |
|---|---|---|
| — | Electron over Tauri; React over Svelte | [01](../research/stack/01-electron-vs-tauri.md), [02](../research/stack/02-react-vs-svelte.md) |
| U1–U9, D1–D7 | Undo/redo requirements and decisions (session-grouped text, labels, history panel, delete/confirm rules, banner for shared sections) | [03](../research/stack/03-undo-redo.md) |
| C1–C8 | Paid product licence rules, custom HTML/JS, no import, daisyUI components, shared Header/Footer, Puck adapter, self-contained sites | [04](../research/stack/04-canvas-engine.md) |
| — | daisyUI (not Basecoat); no shadcn look in sites | [05](../research/stack/05-site-components.md) |
| P1–P5 | `.wforge`, periodic autosave, 20 automatic versions, videos deferred, "open version as new site" | [06](../research/stack/06-project-file-format.md) |
| X1–X6 | Flat .html, WebP + JPEG fallback, Site Settings, readable output, tiered checks (stricter publish), developer files (no Astro) | [07](../research/stack/07-export-pipeline.md) |
| B1–B7 | Targets, hosting deferred, form presets, GA4, FTP rules, consent scope | [08](../research/stack/08-publishing.md) |
| T1–T4 | DIY users, Simple/Advanced mode, structured layout, "Element" | [product/01](../research/product/01-terminology.md) |
| M1–M5 | MVP CMS scope, Blog v1.1, Content mode toggle, search/i18n later | [product/02](../research/product/02-cms.md) |
| UI1 | Editor look and feel: Bootstrap Studio-like layout, dark/light tokens, compact density | [product/04](../research/product/04-editor-look-and-feel.md) |
