# Canvas / Editor Engine

**Status:** Researched 2026-10-19. Recommendation pending a spike. Product decisions recorded in [Decisions](#decisions-2026-10-19)
**Recommendation:** **Puck** (MIT, React) as the primary candidate, validated by a 3–4 day spike. **Fallback:** build our own canvas on the same open-source building blocks Puck itself uses (dnd-kit, Tiptap, Zustand). **GrapesJS** is the only serious alternative engine but fits our decisions poorly.

**Constraints:** open source only; no paid/commercial tools; prefer an existing engine over building from scratch. It must also fit earlier decisions: Electron, React + shadcn/ui, Tailwind v4, static HTML/CSS/JS output, our own undo/redo design (D1–D7), and click-to-edit text for non-technical users.

## Shortlist at a glance (checked on npm/GitHub, Oct 2026)

| Engine | Licence | Latest release | Activity | Framework | Model | Verdict |
|---|---|---|---|---|---|---|
| **Puck** (`@puckeditor/core`) | **MIT** | 0.23.0 (Aug 2026), published Oct 2026 | ✅ Active; ~13.5K★ | React 18/19 | Curated React components + typed fields | **Primary candidate** |
| **GrapesJS** (`grapesjs`) | **BSD-3** | 0.23.8 (Oct 2026) | ✅ Active since 2016; ~26K★ | Framework-agnostic (Backbone); `@grapesjs/react` 2.0 for UI | Free-form HTML/CSS | Viable alternative, poor Tailwind/undo fit |
| Build our own | — | — | — | React | Our model | **Fallback** |
| Craft.js | MIT | 0.2.12 (**Feb 2025**) | ⚠️ Stalled | React | React components | ❌ Maintenance risk |
| Reka.js | MIT | 0.1.31 (**Jan 2025**) | ⚠️ Stalled | Agnostic core | AST state for editors | ❌ Too early, stalled |
| ChaiBuilder SDK | BSD-3 | 4.0.0-beta.51 (Mar 2026) | ⚠️ Repo archived / moved; beta stalled | React + **Tailwind** | Blocks | ❌ Risky; worth reading the code for Tailwind ideas |
| Webstudio | **AGPL-3.0** | 0.306 (Oct 2026) | Active | React | Full SaaS platform | ❌ AGPL + a platform, not an embeddable engine |
| Silex | GPL-3.0 / MPL-2.0 | 3.0.0-alpha (Dec 2025) | Slow | Built on GrapesJS | Static sites | ❌ Copyleft, alpha; useful reference only |
| Onlook | Apache-2.0 | — | Active; ~27K★ | Next.js + Tailwind | Edits a developer's React code | ❌ For developers' codebases, not an embeddable engine |
| GrapesJS Studio SDK, Builder.io, Plasmic (hosted) | Commercial | — | — | — | — | ❌ Paid / commercial (excluded) |

## The two real options

### Option A: Puck (recommended)

**What it is:** an MIT-licensed visual editor *component* for React. You give it a `config` of React components, each with typed **fields** (text, select, number, radio, array, object, external data, slots, **rich text**). It provides the editor around them.

**What we'd get for free**
- Drag-and-drop palette → canvas, nested layouts (**slots**), an outline/layers tree, a fields (inspector) panel
- **Iframe canvas** with **viewports** (phone/tablet/desktop), with an option to isolate host styles (`syncHostStyles: false`), so the editor's Tailwind doesn't leak into the user's site
- **Inline rich-text editing on the canvas** via a Tiptap-based `richtext` field (`contentEditable: true`). That's our click-to-edit requirement
- `permissions` (e.g. lock delete/drag per component), `overrides` and `plugins` to replace any part of the UI with our own shadcn/ui panels
- Serialisable JSON `data`, `onChange`/`onAction` hooks, data migration utilities
- Internally uses **Zustand, dnd-kit and Tiptap**, the exact libraries we'd pick ourselves

**Why it fits Webforge's users:** Puck is built for *constrained* editing: people arrange and configure a curated set of components rather than hand-crafting arbitrary HTML. That's Bootstrap Studio's model (components with options) and suits non-technical users. Our Webforge component library (Section, Columns, Heading, Text, Image, Button, Navbar, Footer, Card, Form…) is written as plain React + Tailwind components. Their fields map to friendly design-token choices ("Padding: Medium" → `py-12`).

**Static export:** pages render with Puck's `<Render config data />`, so export = `renderToStaticMarkup()` per page → `.html`, plus one compiled Tailwind v4 CSS file scanned from that HTML. No React is shipped unless a component needs interactivity (e.g. a mobile menu, which ships a few lines of vanilla JS).

**Gaps / risks**

| Gap | Impact | Mitigation |
|---|---|---|
| **Undo/redo ownership.** Puck has its own snapshot history; `data` is *uncontrolled* after mount. History can only be seeded/replaced via `initialHistory` / `usePuck().history.setHistories` | **High**: our design (labelled steps, per-session text grouping, selection restore, history panel, confirmations) assumes we own history | Spike: either (a) drive Puck from our store via `dispatch`/`setHistories` and hide its undo UI, or (b) derive our labelled entries from `onAction` and map to Puck's history index. If neither works cleanly, that's the trigger for the fallback |
| **Pre-1.0** (0.23); `overrides`/`plugins` are marked experimental | Medium: API churn | Pin versions; wrap Puck behind our own adapter layer |
| **No style/design panel** for Tailwind | Medium | Needed with any engine. We build a Tailwind "design token" field set (spacing, colour, typography, layout per breakpoint) as custom fields |
| **Single page at a time**; no site/pages/assets management | Low | Webforge owns the project (pages, shared sections, assets, theme) and gives Puck one page's data at a time |
| **Shared sections across pages** (linked components) | Medium | Store shared sections in our project model; render via a slot/component that reads the master copy; show the "Editing shared Footer" banner (D7) |
| **Import arbitrary HTML** | None (out of scope, C3) | Not needed. A post-MVP "Custom HTML" component covers ad-hoc snippets (C2) |
| Commercial upsell (Puck Cloud/AI) | Low | Core is MIT and fully self-contained; we don't use Cloud |

### Option B: GrapesJS

**What it is:** the most mature open-source web-builder framework (BSD-3, since 2016). Framework-agnostic, with managers for Blocks, Layers, Styles, Traits, Devices, Assets, Pages, rich-text and code import/export. React can be used for the surrounding UI via `@grapesjs/react`.

**Strengths:** very complete; free-form HTML/CSS; multi-page support; imports existing HTML; huge plugin ecosystem; actively released.

**Why it fits poorly**
- **Styling model is CSS rules / inline styles**, not Tailwind utility classes. The built-in Style Manager writes CSS. Tailwind support exists only as community plugins (`grapesjs-tailwind` 1.0.13, Tailwind blocks + CDN), so a Tailwind-first style panel would be a substantial custom build that fights the engine.
- **Its own UndoManager** (Backbone-based; can `stop()`, `skip()`, `clear()`) tracks every model change. Replacing it with our labelled, patch-based history (D1–D7) means working against the core.
- **Backbone-era architecture** inside a React/Zustand app: two state systems and two component models.
- **Free-form editing** gives non-technical users more ways to break layouts. We'd spend effort *constraining* it.
- The vendor now steers embedders to the paid **Studio SDK**. The core stays BSD and usable, but new polish lands in the commercial product.

GrapesJS would be the better choice if Webforge targeted free-form HTML editing or importing arbitrary existing sites. **Both are now confirmed out of scope (C2, C3)**, so GrapesJS is dropped from consideration.

### Fallback: build our own canvas on open-source parts
If the Puck spike fails on undo/history control, build the canvas ourselves with:
- **iframe** canvas, selection/hover overlays
- **dnd-kit** (`@dnd-kit/react`) for drag-and-drop
- **Tiptap** for inline text
- **Zustand + Immer** document store with our history manager
- **react-arborist** for the layers tree

This is lower risk than it sounds: our component library, fields/design-token controls and export pipeline are the same in both paths, so the Puck spike work carries over. Rough cost: **6–10 weeks** for canvas basics (insert, move, nest, select, inline text, viewports) vs ~1–2 weeks to integrate Puck.

## Evaluation against Webforge requirements

| Requirement | Puck | GrapesJS | Build own |
|---|---|---|---|
| Open source, no paid tools | ✅ MIT | ✅ BSD-3 (avoid Studio SDK) | ✅ |
| Avoid building from scratch | ✅ Most | ✅ Most | ❌ |
| React editor chrome (shadcn/ui) | ✅ Native; overrides | ⚠️ Wrapper; Backbone core | ✅ |
| Tailwind v4 output & controls | ✅ Components are Tailwind; custom fields | ❌ CSS-rule model | ✅ |
| Static HTML/CSS/JS export | ✅ `renderToStaticMarkup` | ✅ `getHtml/getCss` | ✅ |
| Click-to-edit text (Tiptap) | ✅ `richtext` field | ⚠️ Basic RTE (replaceable) | ✅ |
| Drag-and-drop + nesting | ✅ dnd-kit, slots | ✅ | Build (dnd-kit) |
| Responsive viewports | ✅ | ✅ Device Manager | Build |
| Our undo/redo design (D1–D7) | ⚠️ **Spike needed** | ❌ Fights UndoManager | ✅ Full control |
| Non-technical-user safety (constrained editing) | ✅ By design | ⚠️ Free-form | ✅ |
| Multi-page, shared sections, assets | ⚠️ We build (needed anyway) | ✅ Built in | We build |
| Maturity / API stability | ⚠️ Pre-1.0, active | ✅ Mature | ✅ Ours |

## Spike plan (3–4 days, Puck)
Build a single-page prototype in the Electron + React + shadcn/ui shell with 6 components (Section, Columns, Heading, Text, Image, Button) styled with Tailwind v4. **Pass criteria:**

1. **Undo ownership:** our history manager produces labelled steps (*"Edited Heading text"*, *"Moved Section"*) shown in a history panel. Undo/redo/jump update Puck's canvas correctly, and Puck's built-in undo UI is hidden or unused. ← *critical; failing this triggers the fallback*
2. **Text grouping:** one inline-text editing session = one step (D1).
3. **Tailwind fields:** a "Spacing / Colour / Font size" custom field set emits Tailwind classes, with a per-breakpoint toggle.
4. **Isolation:** the iframe canvas uses only the site's Tailwind build (`syncHostStyles: false`), with no editor styles leaking.
5. **Export:** the page exports to a static `index.html` + compiled `styles.css` with no React runtime, and opens correctly from disk.
6. **Custom UI:** Puck's header/sidebars replaced with our shadcn/ui panels via `overrides`.

## Decisions (2026-10-19)

| # | Topic | Decision | Consequence |
|---|---|---|---|
| C1 | **Webforge licence** | **Paid, closed-source commercial product** | Only permissive dependencies (MIT, BSD, Apache-2.0, ISC). **No GPL/AGPL** anywhere in the shipped app (rules out Webstudio, Silex). See licence rules below |
| C2 | **Custom HTML** | **Nice-to-have, not critical** → post-MVP | Puck's constrained component model is fine for MVP. Later: a "Custom HTML" component (code-editor field, rendered as-is, not visually editable). Scope extended by C7 to include custom JavaScript |
| C3 | **Importing existing websites** | **Out of scope** | Removes GrapesJS's main advantage (free-form HTML import/editing) and **strengthens the case for Puck** |
| C4 | **Prebuilt site components** | Use shadcn's design language/theming, but **not Radix/React at runtime** in published sites | Site components are React components that render static HTML + Tailwind, based on **daisyUI or Basecoat** (MIT, no React needed). Details in [05-site-components.md](05-site-components.md) |
| C5 | **Shared sections** | **Edited once, reused on every page.** One master copy; no per-page variants (a different footer per page is unlikely) | See "Shared sections design" below |
| C6 | **Puck adapter layer** | ✅ Yes: wrap Puck behind a small `CanvasEngine` interface | See "Adapter layer" below |
| C7 | **Custom HTML & JavaScript** | **In scope to build and deploy** (post-MVP is fine) | Bundled at export; see [05-site-components.md](05-site-components.md#custom-html-and-javascript-decided-build--deploy) |
| C8 | **Self-contained sites** | **No hosted JS, CSS or fonts.** Everything is packaged with the built site | Fonts via Fontsource, icons inlined, external-resource check before export; see [05](05-site-components.md#self-contained-output-no-hosted-css-js-or-fonts) |

### Shared sections design (C5)
- **Site Layout:** every site has a layout with **Header** and **Footer** regions that wrap every page automatically, like a master page. MVP covers exactly this.
- **Stored once:** `site/layout/header.json` and `site/layout/footer.json` (Puck data), separate from page files. Pages don't contain copies.
- **Editing:** click the footer on *any* page to edit it in place. The persistent banner *"Editing shared Footer: changes apply to all 6 pages"* shows while it's selected (D7). Changes appear on every page immediately; one undo reverts it everywhere.
- **Implementation in Puck:** the page canvas renders `Header` + page content + `Footer`. Header/Footer are fed from the layout store, and edits are routed back to the layout file through the adapter. *Validate in the spike* (fallback: a dedicated "Edit layout" mode that opens the layout in its own Puck instance).
- **Per-page opt-out (only):** a page setting *"Hide header/footer on this page"* (e.g. a landing page). No per-page variants.
- **Later (post-MVP):** user-defined reusable sections ("Saved sections", e.g. a newsletter signup used on several pages), same mechanism.

### Adapter layer (C6)
A thin `CanvasEngine` interface owned by Webforge; Puck is one implementation. The rest of the app never imports Puck directly.
```ts
interface CanvasEngine {
  mount(el: HTMLElement, opts: { library: ComponentLibrary; theme: Theme }): void
  loadPage(page: PageDoc, layout: LayoutDoc): void      // our model → engine
  applyChange(change: DocChange): void                  // undo/redo/jump drive the engine
  onUserEdit(cb: (edit: EngineEdit) => void): Unsubscribe // engine → our history manager
  select(nodeId: string | null): void
  onSelectionChange(cb: (nodeId: string | null) => void): Unsubscribe
  setViewport(v: 'phone' | 'tablet' | 'desktop' | number): void
  renderStatic(page: PageDoc, layout: LayoutDoc): string // export → HTML
  destroy(): void
}
```
Benefits: Puck upgrades (pre-1.0) touch one module; the fallback "own canvas" is a second implementation of the same interface; history, project files and export stay engine-independent.

### Licence rules for a paid product (C1)
- ✅ **Allowed:** MIT, BSD-2/3, Apache-2.0, ISC, 0BSD, CC0.
- ⚠️ **Review first:** LGPL (Electron's bundled ffmpeg is an LGPL build and is fine as shipped), MPL-2.0 (file-level copyleft; OK if unmodified), anything "source-available".
- ❌ **Not allowed:** GPL, AGPL, SSPL, "non-commercial" licences, and *paid add-ons* of otherwise-open projects. Specifically avoid **Tiptap Pro/Cloud extensions** (use only MIT `@tiptap/*` packages), **Puck Cloud**, and **GrapesJS Studio SDK**.
- **Obligations:** MIT/BSD/Apache require shipping copyright + licence notices. Add an **"Open-source licences"** screen in the app and a generated `THIRD_PARTY_NOTICES` file (Electron already ships `LICENSES.chromium.html`). Apache-2.0 also requires preserving `NOTICE` files.
- **Enforce in CI:** run a licence checker (e.g. `license-checker-rseidelsohn`) with an allow-list; fail the build on a disallowed licence.
- **Assets count too:** fonts, icon sets and template images bundled with Webforge or used in templates must permit commercial redistribution (e.g. Google Fonts under OFL ✅; check every icon set and stock photo licence).
- *Not legal advice. Have a lawyer review the final dependency and asset list before launch.*

## Remaining open questions
1. **Component library scope for MVP:** which ~15–20 components and templates? (Depends on the daisyUI vs Basecoat choice in [05](05-site-components.md).)
2. **Puck API stability:** watch for 1.0; the adapter (C6) limits the blast radius.
3. **Custom HTML sandbox details:** scripts in the editor are off by default (see [05](05-site-components.md)). Are any restrictions needed in exported sites, or is it "user's responsibility"?

## Sources
- Puck: [GitHub](https://github.com/puckeditor/puck) · [`<Puck>` API reference](https://puckeditor.com/docs/api-reference/components/puck) · [richtext field](https://puckeditor.com/docs/api-reference/fields/richtext) · [v0.16 history APIs](https://dev.to/chrisvxd/puck-v016-permissions-3p5d) · [EveryDev listing](https://www.everydev.ai/tools/puck)
- GrapesJS: [GitHub](https://github.com/GrapesJS/grapesjs) · [UndoManager API](https://grapesjs.com/docs/api/undo_manager.html)
- Craft.js: [GitHub](https://github.com/prevwong/craft.js) · Reka.js: [GitHub](https://github.com/prevwong/reka.js)
- ChaiBuilder: [GitHub (archived SDK repo)](https://github.com/chaibuilder/sdk)
- Onlook: [GitHub](https://github.com/onlook-dev/onlook)
- Landscape: [OpenAlternative: Webstudio alternatives](https://openalternative.co/alternatives/webstudio)
- Versions, licences and publish dates: npm registry (`npm view`), checked 2026-10-19
