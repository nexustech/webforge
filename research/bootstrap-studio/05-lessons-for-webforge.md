# Lessons for Webforge

What to copy, what to change and what to avoid, mapped to the requirements in `ideas.md`. These are inputs to the upcoming stack and structure decisions, not the decisions themselves.

## 1. Copy these patterns

| Pattern in Bootstrap Studio | Why it matters for Webforge |
|---|---|
| **Model-first editing.** Pages are a typed component tree; the canvas, preview and export are all *renderings* of it ("contexts") | This is the core of any reliable visual builder. Webforge should never treat the live DOM or raw HTML as the source of truth |
| **Components declare their own options** (`defineOptions` → auto-generated Options panel) | Lets non-technical users change things through friendly controls. For Tailwind, options map to utility classes (`p-4`, `md:flex`) instead of Bootstrap classes |
| **Preview server that asks the editor for each URL** (no files written) + **SSE live reload with CSS-only hot swap** | Simple, fast, works on phones over Wi-Fi, always shows unsaved state. Easy to rebuild in Node (or reuse Vite's dev server) |
| **Format versioning + migration converters** from day one | They are on format v87 after 10 years. Without this, every model change breaks old projects |
| **Atomic save** (write `.tmp` → rename) + automatic timestamped backups | Non-technical users will lose work otherwise |
| **Linked Components** (shared header/footer) | Obvious user need. Webforge's equivalent might be called "Shared Sections" |
| **Thin main process, heavy tooling via npm in-app** (Sass, minifiers, parsers) | Users never install Node or a CLI. The Tailwind compiler can run the same way |
| **Bundle the editor locally** (they moved away from a remote-loaded web app) | Offline use, versioned with the installer, faster start-up |
| **electron-builder + electron-updater** (per-user install, generic update feed) | Meets the "easy install and upgrade" requirement on Windows and macOS with little effort |

## 2. Do differently

- **Tailwind instead of Bootstrap changes the styling model.** Bootstrap Studio's Options panel works because Bootstrap has a *small, named* class vocabulary per component. Tailwind has thousands of composable utilities. Webforge will need a curated *design-token* layer (spacing scale, colour palette, type scale) with friendly controls ("Padding: Medium") that emit utilities. Compiling CSS is also different: Tailwind v4 scans the generated HTML and builds only the classes in use, so preview and export must run the Tailwind compiler (in-process via `@tailwindcss/node` / the Oxide engine) on each change.
- **Git-friendly project folder instead of one gzipped blob.** Use a folder with `webforge.json` + one JSON/YAML file per page + real image files. This allows diffs, version control (an `ideas.md` goal) and large media without bloating memory.
- **Real end-user CMS editing.** Bootstrap Studio's "CMS" is designer-side only. Webforge's requirement ("click and update text directly on the page") suggests a separate **Content mode** that locks layout and only allows editing text and images of marked components. That can be a later phase.
- **Simpler terminology for non-technical users.** Bootstrap Studio exposes Container/Row/Column, classes and overrides. Webforge should hide the grid behind "Sections" and layout presets.
- **Security.** Bootstrap Studio runs with `nodeIntegration: true`, `contextIsolation: false` and `@electron/remote`, which Electron now discourages. Webforge should use `contextIsolation` + a typed `preload` bridge, and render user content in a sandboxed iframe.
- **AI round-trip.** Their AI edits HTML text and re-imports it, which loses Linked Component metadata (acknowledged on their forum). If Webforge adds AI, give the model **structured tools over the component tree** instead of raw-HTML diffs.

## 3. Open questions this raises for the next research tasks
1. ~~**Electron vs Tauri.**~~ → **Researched: Electron recommended.** See [../stack/01-electron-vs-tauri.md](../stack/01-electron-vs-tauri.md).
2. **UI framework.** Bootstrap Studio shows one isn't required, but a modern team would likely pick React/Svelte for the editor chrome. The canvas still needs custom overlay logic either way.
3. **Canvas approach.** Options are an iframe per breakpoint (Bootstrap Studio), a single resizable iframe, or an existing editor engine (GrapesJS, Craft.js, Puck). Evaluate those before building from scratch.
4. **Project format.** Folder layout and schema, plus how to version and migrate it.
5. **Static output pipeline.** In-process Tailwind build + HTML generation versus driving a static-site generator such as Astro or Eleventy behind the scenes.
6. **Hosting and publishing.** Bootstrap Studio's own hosting is part of its business model. Webforge could start with "Export folder", then add Netlify/Cloudflare Pages/GitHub Pages publishing.
