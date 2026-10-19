# Site Component Library, Theming and Self-Contained Output

**Status:** ✅ **Decided 2026-10-19: daisyUI** for site components and theming (validation build still recommended)
**Scope:** The components *end users* drag onto their pages (Navbar, Hero, Card, Accordion, Footer…), how users style them, and the rule that published sites carry **all** their own CSS, JS and fonts. This is separate from the *editor chrome*, which uses shadcn/ui ([02](02-react-vs-svelte.md)).

## The question
> "May be sensible to use Radix or shadcn for prebuilt components if they can be styled easily by the user."

**Short answer:** use **shadcn's design language and theming system**, but **not the Radix/React components themselves** in published sites.

**Why not ship Radix/shadcn React components in the sites?** Radix components (Dialog, Accordion, Tabs, Dropdown…) get their behaviour from **React running in the browser**. Webforge exports static HTML. To keep a Radix accordion working on the live site we'd have to ship React (~45 KB+ gzipped) and "hydrate" every page. That makes sites heavier and more complex, and goes against the static-output requirement. In the editor canvas they'd work fine, which hides the problem until export.

**What to use instead:** components whose interactivity comes from **native HTML** (`<details>`, `<dialog>`, the `popover` attribute, CSS) plus a **tiny vanilla-JS file** for the few things HTML can't do (mobile menu toggle, tabs, carousel). Two MIT libraries do exactly this on Tailwind:

| Library | Licence | Latest | Approach | Look | Theming for users | Fit |
|---|---|---|---|---|---|---|
| **daisyUI 5** | MIT | 5.7.50 (Oct 2026) | Tailwind v4 plugin; semantic classes (`btn`, `card`, `collapse`) + utilities; **pure CSS**, no JS | Neutral, many styles | ⭐ **35 built-in themes**, theme generator; themes are CSS variables (`--color-primary`, radius, border, depth) | ✅ Mature, very large user base; easiest themes for non-technical users |
| **Basecoat UI** | MIT | 1.0.2 (Jul 2026) | Tailwind classes + small vanilla JS for interactive parts | **shadcn/ui look**, "all of the shadcn/ui magic, none of the React" | shadcn-style CSS variables (`--primary`, `--radius`…) | ✅ Matches the shadcn aesthetic; younger and smaller |
| Flowbite (core) | MIT (Pro is paid ❌) | 4.0.2 (May 2026) | Tailwind + vanilla JS | Generic | CSS variables | ⚠️ OK, but avoid Pro blocks |
| Preline | MIT **+ "Fair Use" licence** | 5.0.0 | Tailwind + JS | — | — | ❌ Licence not clean for a paid product |
| Radix / shadcn/ui (React) | MIT | — | React runtime required | shadcn | shadcn variables | ❌ For published sites (✅ for editor chrome) |

**Recommendation:** build Webforge's site components as **React components that render plain HTML + Tailwind classes**. That's what Puck needs on the canvas, and at export it becomes static markup. Base their markup and CSS on **daisyUI** (preferred for themes and maturity) or **Basecoat** (if we want the shadcn look). Decide with a 1-day side-by-side: build Navbar + Hero + Card + Accordion + Footer in both and compare look, theme switching and output size.

## daisyUI vs Basecoat (researched 2026-10-19)

| Criterion | **daisyUI 5** | **Basecoat 1.0** | Edge |
|---|---|---|---|
| Licence | MIT | MIT | — |
| Maturity | Since **2020**; v5 since Sep 2024 with ~290 v5 releases; **~42K★**; latest 5.7.50 (Oct 2026) | Since **May 2025**; 1.0 in Jun 2026 (class names changed at 1.0); **~4.3K★**; latest 1.0.2 (Jul 2026) | **daisyUI** |
| Maintainers | One lead maintainer + Open Collective sponsors | One maintainer | daisyUI (longer track record) |
| Component count | **68** | **41** | daisyUI |
| Website / marketing components (what Webforge users build) | ✅ Hero, Navbar, Footer, Megamenu, Carousel, Timeline, Stat, Steps, Countdown, Rating, device/browser mockups… | ❌ Mostly **app UI** (forms, dialogs, tables, sidebar, command palette); no hero/footer/carousel | **daisyUI** |
| JavaScript needed | **None.** Pure CSS using native HTML (`<details>`, `<dialog>`) or checkbox/radio techniques | Small vanilla JS for 11 components (accordion, tabs, dropdown, select, combobox, drawer, popover, slider, toast…); per-component files available | daisyUI (zero JS) |
| Accessibility | ⚠️ Mixed. `<details>`/`<dialog>` patterns are good; **checkbox/radio "hack" patterns** (tabs, drawer, some toggles) lack proper ARIA roles and keyboard behaviour | ✅ Semantic HTML-first, with JS providing ARIA + keyboard patterns (shadcn-quality) | **Basecoat** |
| Theming for non-technical users | ⭐ **35 built-in themes**, online theme generator, CSS-variable themes (colours, radius, border, depth, noise); **nestable** (`data-theme` on a section, e.g. a dark band in a light site) | 8 style packs; **compatible with shadcn/ui themes**, so the large shadcn theme ecosystem (e.g. theme generators) works | **daisyUI** (richer, nestable) |
| Look & feel | Distinct "daisy" look; can be styled close to shadcn with a custom theme | **Exactly the shadcn/ui look**, matching our editor chrome | Basecoat |
| Class style | Semantic component classes (`btn btn-primary`, `card`) + Tailwind utilities | Semantic classes + utilities | — |
| Tailwind v4 | ✅ Native v4 plugin (`@plugin "daisyui"`) | ✅ v4 source + bundles | — |
| Output size | CSS only, purged to used classes | CSS + small JS per interactive component | daisyUI |

### Decision: **daisyUI**, with our own accessible behaviour for interactive components

> **Deciding factor:** Webforge builds *websites*, and sites made with Webforge must **not all look the same** (and in particular not like shadcn/ui). daisyUI's broad theme system gives each site its own identity; Basecoat would push every site towards the shadcn look.

Webforge users build **websites** (landing pages, small business sites, portfolios), not app dashboards. daisyUI covers those sections out of the box. Its theme system (35 presets, generator, nestable themes) is the easiest way to give non-technical users "pick a look, change brand colours". It's also more mature and needs no JavaScript at all.

**Mitigations for daisyUI's weak spots**
1. **Accessibility:** for the handful of interactive components (Tabs, Dropdown/Megamenu, Drawer/mobile nav, Carousel), Webforge's component templates emit proper ARIA markup and use a small vanilla `webforge.js` for keyboard support, instead of daisyUI's checkbox/radio techniques. Use `<details>`/`<dialog>`/`popover` where they're accessible natively. **Basecoat's MIT JS and markup are a good reference** for these patterns.
2. **Visual variety (no house look):** templates and themes must be visibly distinct from each other. Avoid a single default look that most sites end up with; offer a theme picker at project creation, and let users adjust brand colours, fonts and roundness from day one. The editor's own shadcn/ui styling never leaks into sites (iframe isolation).
3. **Single-maintainer risk:** we generate markup through our own React components and only depend on daisyUI's CSS plugin. If needed, the MIT CSS can be **vendored/forked**, which limits the risk.

**When Basecoat would be the better pick:** if Webforge pivots toward app-like sites (dashboards, forms-heavy tools) or the exact shadcn aesthetic becomes a brand requirement.

**Validate with the planned 1-day build:** Navbar (with mobile menu), Hero, Feature cards, Accordion (FAQ), Tabs and Footer in daisyUI. Check theme switching, nested section themes, keyboard/screen-reader behaviour (axe + manual), and exported CSS/JS size.

## How users style components ("styled easily by the user")

Three layers, from broad to specific. Non-technical users mostly use the first two:

1. **Site theme** (Theme panel): pick a preset theme (daisyUI's 35, or our curated set), then adjust brand colours, font pair, corner roundness and spacing scale. These are **CSS variables**, so changing the theme restyles every component on every page instantly. Theme changes are site-wide, so per D7 they ask for confirmation and are undoable.
2. **Component options** (Puck fields): friendly choices per instance, such as *Variant: Primary / Outline / Ghost*, *Size: S / M / L*, *Padding: None / Small / Medium / Large*, *Align: Left / Centre*, with optional per-breakpoint values. Each option maps to Tailwind classes behind the scenes.
3. **Advanced** (collapsed by default): a raw "CSS classes" field for power users, plus Custom HTML/JS (below).

## Self-contained output: no hosted CSS, JS or fonts

**Requirement:** a published site must contain everything it needs. No CDN links, no Google Fonts URLs, no externally hosted scripts. *(Bonus: better privacy and GDPR posture. A Munich court in 2022 awarded damages against a site that loaded Google Fonts from Google's servers. Sites also keep working offline and won't break if a CDN goes away.)*

| Asset | How Webforge packages it |
|---|---|
| **CSS** | One compiled, minified Tailwind v4 file per site (theme variables + only the classes used), written to `assets/css/site.css` |
| **Component JS** | One small `assets/js/webforge.js` (vanilla, tree-shaken to the components actually used; target a few KB) |
| **Fonts** | Bundled from **Fontsource** packages (self-hostable Google Fonts, OFL licence): only the chosen families/weights, as `woff2` in `assets/fonts/`, with `@font-face` in `site.css`. Webforge ships a curated offline font catalogue, so no network is needed to pick a font |
| **Icons** | **Lucide** (ISC) inlined as SVG at export, with no icon font or CDN |
| **Images** | Copied into `assets/img/`, optionally resized/converted to WebP/AVIF at export (e.g. `sharp`, Apache-2.0) |
| **Custom HTML** | Exported as written, *after* an external-resource check (below) |
| **Custom JS** | User `.js` files bundled and minified with **esbuild** (MIT, runs inside Electron) into `assets/js/custom.js`. Optionally allow importing from a vetted, offline-bundled set of libraries (e.g. Alpine.js, Swiper), never from a CDN |

**External-resource check** (runs on save and before export/publish):
- Scans pages, Custom HTML, custom CSS and JS for `http(s)://` and `//` references to scripts, stylesheets, fonts and images.
- For each one found, it shows a warning listing the references, with a **"Download and bundle"** action that fetches the file once into `assets/` and rewrites the reference.
- **Built-in allowed exception:** Google Analytics `gtag.js` when enabled in Site Settings (decision B4, [08-publishing.md](08-publishing.md#google-analytics-b4)).
- **Unavoidable embeds** (YouTube, Vimeo, Google Maps) are inherently external. Offer them as dedicated components that use privacy-enhanced modes (e.g. `youtube-nocookie.com`) and a **click-to-load placeholder**, so nothing external loads until the visitor opts in.

## Custom HTML and JavaScript (decided: build + deploy)
- **Custom HTML component:** a code-editor field (CodeMirror 6). It renders live inside the sandboxed canvas iframe, is not visually editable, and appears as a labelled block in the layers tree.
- **Custom code files:** site-level `custom.css` / `custom.js` (and per-page "head" and "end of body" snippets), edited in a code panel and bundled at export as above.
- **Safety in the editor:** custom scripts run only in the canvas iframe (sandboxed, no Node/Electron access), with a toggle to *"Run custom scripts in editor"* (off by default) so a broken script can't break editing.
- **Undo:** code edits are history entries (*"Edited custom.js"*), grouped per editing session like text (D1).

## Open questions
1. ~~daisyUI vs Basecoat~~ → ✅ **daisyUI decided.** Run the 1-day validation build to confirm accessibility fixes and output size.
2. **Curated theme set:** ship daisyUI's 35, or a smaller curated set of ~10 polished themes plus "custom"?
3. **Font catalogue size:** bundling many Fontsource families inflates the installer. Ship ~30 popular families and download others on demand into a local cache (once, from npm/Fontsource, at design time, not at site runtime)?
4. **Vetted JS library list** for Custom JS imports (Alpine.js, Swiper, GLightbox…): all MIT/permissive, bundled offline.
5. **Image optimisation defaults** at export (max width, formats, quality).

## Sources
- [daisyUI themes](https://daisyui.com/docs/themes/) · npm `daisyui` 5.7.50 (MIT)
- [Basecoat UI](https://basecoatui.com/) · [installation & component list](https://basecoatui.com/installation/) · [GitHub](https://github.com/hunvreus/basecoat) · npm `basecoat-css` 1.0.2 (MIT)
- [daisyUI components (68)](https://daisyui.com/components/) · [GitHub](https://github.com/saadeghi/daisyui)
- npm: `flowbite` 4.0.2 (MIT; Pro is commercial), `preline` 5.0.0 (MIT + Fair Use licence), `@fontsource/*` (OFL-1.1), `lucide-static` (ISC), `@radix-ui/*` (MIT), checked 2026-10-19
- Tailwind v4 browser support: see [01-electron-vs-tauri.md](01-electron-vs-tauri.md)
