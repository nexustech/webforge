# Export Pipeline (Build & Preview)

**Status:** ✅ Design decided 2026-10-19 (X1–X6); implementation details to confirm in the spike
**Recommendation:** an **in-app pipeline** that runs entirely inside Electron (no external static-site generator), built from MIT/Apache libraries:
- Puck renders each page to static HTML.
- Tailwind v4 + daisyUI compile CSS from the classes actually used.
- esbuild bundles JS.
- Fonts and icons are packaged locally, and images are optimised.

The **same pipeline powers live preview** (in memory, served over HTTP + SSE) and **export** (written to a folder or ZIP).

**Fixed inputs from earlier decisions:**
- Static HTML/CSS/JS with no server runtime
- Self-contained output: no CDNs, hosted fonts or hosted scripts (C8)
- Puck + our `CanvasEngine.renderStatic()` adapter (C6)
- daisyUI components with a small `webforge.js` (05)
- Custom HTML/JS built and deployed (C7)
- `.wforge` SQLite project (06)

## Own pipeline vs a static-site generator

| | **In-app pipeline (recommended)** | Astro 7 (MIT) | Eleventy 3 (MIT) |
|---|---|---|---|
| What it would do | Render our model with React → HTML; compile CSS/JS; copy assets | Generate an Astro project from our model, run `astro build` | Generate templates/data, run Eleventy |
| Fits our model | ✅ Directly: pages are already React components + JSON | ⚠️ Needs a translation layer (our JSON → `.astro`/React islands) | ⚠️ Translation to templates; React rendering not native |
| Speed | ✅ Milliseconds per page; works fully in memory for preview | ⚠️ Seconds per build (Vite); writes to disk | ✅ Fast, but disk-based |
| Live preview | ✅ Same code path, in memory (Bootstrap Studio's proven approach) | ❌ Separate dev server; heavy | ⚠️ Separate |
| Packaging in Electron | ✅ A few libraries | ❌ Ships Vite + Rollup + Astro toolchain inside the app; more native deps; larger installer | ⚠️ Moderate |
| Control over output | ✅ Total | ⚠️ Framework conventions | ✅ Good |
| Added value | — | Islands, content collections (not needed) | Templating (not needed) |

**Conclusion:** an SSG would add a second rendering system and a heavy toolchain without giving users anything we need. Bootstrap Studio does the same: its own Export/Preview "contexts" over one model.

**Possible later extra:** *"Export as Astro project (for developers)"*, a hand-off feature for users whose developer wants to take over the code. Not MVP.

## Pipeline stages

```
.wforge (snapshot of working copy)
   │
   ▼ 1. Snapshot     — immutable copy of pages, layout, theme, assets, settings
   ▼ 2. Validate     — tiered checks (see "Export checks"): errors block, warnings reported,
   │                   suggestions shown; includes external-resource check (C8)
   ▼ 3. Render HTML  — per page: CanvasEngine.renderStatic() (Puck <Render> →
   │                   renderToStaticMarkup) inside Header/Footer layout;
   │                   inject <head>: title, meta description, Open Graph, canonical,
   │                   favicon links, font preloads, CSS/JS links, custom head/body snippets;
   │                   Lucide icons inlined as SVG
   ▼ 4. Collect classes — @tailwindcss/oxide Scanner over rendered HTML + custom HTML/JS
   ▼ 5. CSS          — tailwindcss compile(): theme CSS variables + @plugin "daisyui"
   │                   + @font-face (Fontsource woff2) + custom.css → build(candidates)
   │                   → readable output (X4); Lightning CSS for vendor prefixes only
   ▼ 6. JS           — esbuild: webforge.js (only behaviours of components used)
   │                   + custom.js; bundled, not minified (X4); external imports forbidden
   ▼ 7. Assets       — images: resize to responsive widths, WebP + JPEG fallback (PNG if transparent) via <picture>;
   │                   JPEG for og:image, PNG/ICO favicons; emit srcset/sizes/width/height/loading="lazy";
   │                   fonts: only chosen families/weights/subsets; favicon set from one image
   ▼ 8. Site files   — sitemap.xml, robots.txt, site.webmanifest, 404.html
   ▼ 9. Finalise     — format HTML/CSS/JS readably (X4); content-hash filenames (site.3f9a.css) for cache busting;
   │                   rewrite references; relative URLs everywhere (X1)
   ▼ 10. Write       — to a temp folder, then atomic swap into the export folder (or write a .zip);
                       export report (pages, sizes, warnings)
```

### Output layout (per decision X1)
```
my-site/
├── index.html
├── about.html
├── contact.html
├── services/
│   └── web-design.html        ← links back with ../
├── 404.html
├── assets/
│   ├── css/site.3f9a1c.css
│   ├── js/webforge.a1b2c3.js   (classic script, only if needed)
│   ├── js/custom.d4e5f6.js     (only if custom JS exists)
│   ├── fonts/inter-latin-400.woff2 …
│   └── img/hero-640.webp, hero-1280.webp, hero.jpg …
├── favicon.ico, apple-touch-icon.png, site.webmanifest
├── sitemap.xml
└── robots.txt
```

## Decision X1: flat `.html` files, no web server required (2026-10-19)

**Rule:** an exported site must work by **uploading the files to any host** (FTP, cPanel, S3, Netlify, GitHub Pages…) **and** by **double-clicking `index.html` on disk**. No server configuration, rewrites or directory indexes are assumed.

**URL scheme:** `index.html`, `about.html`, `contact.html`; pages in folders become e.g. `services/web-design.html`. All links and asset references are **relative** (`about.html`, `../assets/css/site.css`).

### Pros and cons

| ✅ Pros | ⚠️ Cons |
|---|---|
| **Works everywhere, zero configuration:** any static host, plain FTP upload, a USB stick, email as a ZIP | URLs show `.html` (`example.com/about.html`). Cosmetic; modern search engines don't penalise it |
| **Opens from disk:** double-click `index.html` and every link works, which is ideal for non-technical users checking their site before upload | Some hosts (Netlify, Cloudflare Pages, Vercel, GitHub Pages) auto-strip `.html` ("pretty URLs") and may **redirect** `/about.html` → `/about`. Harmless, but users may see two URL forms. Document it; optionally emit `<link rel="canonical">` pointing to the `.html` form |
| **What you see is what's uploaded:** one file per page; easy to understand and find | **Choosing later is costly:** switching URL style after launch breaks bookmarks and search rankings (would need redirects). Decide now (done) and keep it stable |
| Simple to implement and test: no rewrite rules, no per-host quirks | Relative paths must be computed per page depth (`../` for pages in folders). Handled by the pipeline |
| Same output works for preview-from-disk and production | Sitemap, canonical and Open Graph URLs still need the site's public address (unchanged) |

**Verdict:** the pros clearly win for Webforge's non-technical users. Optional "clean URLs" can be an advanced, host-specific setting later (e.g. when publishing to a host known to support it); it's not MVP.

### `file://` compatibility rules (so "double-click and it works" is true)
Browsers restrict some features when a page is opened from disk. The pipeline must follow these rules:

| Rule | Why |
|---|---|
| **Classic `<script defer>` bundles only, no `type="module"`** | ES modules are blocked by CORS on `file://` in Chrome/Edge |
| **No `fetch()`/XHR of local files** (e.g. JSON data). Inline any data the page needs | `fetch` of `file://` URLs is blocked |
| **Fonts and images in sub-folders of the page** (`assets/…`) | Firefox restricts `file://` loads to the same directory tree. Verify font loading from disk in Chrome, Edge, Firefox and Safari during the spike |
| **No service worker / PWA offline features from disk** | Only work over https; PWA manifest still exported for hosted use |
| **Forms:** contact forms need a backend on any host | Out of scope for export itself; handled by a form service setting later (publishing research) |
| **404 page** (`404.html`) | Used only by hosts that support it; harmless on disk |

### Clarification: live preview vs export
- **Export needs no web server.** The output is plain files.
- **Live preview inside Webforge** keeps its small built-in local server (internal to the app). That's what enables instant CSS hot-reload and previewing on a phone over Wi-Fi. The user never configures or sees it. A *"Preview from disk"* button simply opens the exported `index.html` in the default browser.

## Image formats: options and recommendation (2026-10-19)

**Goal:** broadest browser compatibility, with reasonable file sizes.

### Browser support (caniuse, Oct 2026)

| Format | Global support | Minimum versions | Notes |
|---|---|---|---|
| **JPEG / PNG** | ~100% | All | Universal, but largest files |
| **WebP** | **97.2%** | Chrome 32, Edge 18, Firefox 65, **Safari 16.0** (macOS) / iOS 14 | ~25–35% smaller than JPEG at similar quality; supports transparency (replaces PNG) and animation |
| **AVIF** | **96.4%** | Chrome 85, Edge 121, Firefox 93, **Safari 16.4** / iOS 16 | ~20–30% smaller than WebP, but **slow to encode** (especially in WebAssembly) |
| JPEG XL | 60% | Chrome 155, Firefox 158, Safari 17 (partial) | ❌ Not yet broad enough |

**Key insight:** Webforge sites use **Tailwind v4**, which needs **Chrome 111, Safari 16.4, Firefox 128** or newer to display correctly. **Every browser that can render a Webforge site properly already supports both WebP and AVIF.** A JPEG/PNG fallback would only help browsers (the ~3% gap: very old Safari/iOS, old Android, IE) that would show a broken layout anyway.

**Where WebP is *not* safe: outside the browser**
- **Social share previews** (`og:image`). Facebook, LinkedIn, X, WhatsApp and Slack crawlers have inconsistent WebP support, so use **JPEG** (or PNG).
- **Favicons / app icons:** use **ICO + PNG**.
- **Email clients:** not relevant to exported websites.

### Options

| Option | Page images | Compatibility | File size | Export time | Files per image |
|---|---|---|---|---|---|
| **A. JPEG/PNG only** | Original format, resized | 100% | Largest | Fast | 1 per width |
| **B. WebP only** ⭐ | WebP (lossy for photos, lossless/alpha for graphics) | All browsers that render Tailwind v4 sites | ~30% smaller than A | Fast (WASM OK) | 1 per width |
| **C. WebP + JPEG/PNG fallback** via `<picture>` | WebP, with original as fallback | 100% | Same as B for modern browsers | Slower | 2 per width |
| **D. AVIF + WebP + fallback** | AVIF first, then WebP, then original | 100% | Smallest (~20–30% below B) | **Slowest**; AVIF encode in WASM can take seconds per image | 3 per width |

### Decision X2: **Option C, WebP with JPEG fallback** (2026-10-19)
1. **Page images → WebP + fallback via `<picture>`**, resized to responsive widths (e.g. 640 / 1280 / 1920, never upscaled):
   ```html
   <picture>
     <source type="image/webp" srcset="assets/img/hero-640.webp 640w, assets/img/hero-1280.webp 1280w" sizes="100vw">
     <img src="assets/img/hero-1280.jpg" srcset="assets/img/hero-640.jpg 640w, assets/img/hero-1280.jpg 1280w"
          sizes="100vw" width="1280" height="720" alt="…" loading="lazy">
   </picture>
   ```
   - **Photos / opaque images:** fallback is **JPEG**.
   - **Images with transparency:** fallback is **PNG**, since JPEG can't store transparency (WebP keeps the alpha channel).
   - Always set `width`/`height` (prevents layout shift); `loading="lazy"` below the fold; first visible image eager.
2. **Always JPEG/PNG for non-browser consumers:**
   - **Open Graph / social share image:** JPEG, 1200×630.
   - **Favicons:** `favicon.ico` + PNG sizes + `apple-touch-icon.png`.
3. **Pass-through formats:**
   - **SVG:** logos and illustrations; sanitised, kept as SVG.
   - **GIF:** kept as-is.
4. **AVIF:** not produced by default. A possible later opt-in "Smallest files" setting (slow to encode).
5. **Originals are never modified.** The `.wforge` file keeps the uploaded original; conversion happens only at export, cached by image hash, so re-exports are fast.
6. **Cost:** about twice the image files in the export folder (WebP + JPEG per width). Visitors only download one of them, so page weight is unaffected.

## Decision X3: Site Settings, editable any time, prompted before export if missing (2026-10-19)

A **Site Settings** dialog (menu: *Site → Settings…*, also linked from the export dialog) can be opened at any time. Values are stored in the project's `settings` document in the `.wforge` file.

| Section | Fields | Used for |
|---|---|---|
| **General** | Site name, short description, language (`<html lang>`), favicon/app icon source image | `<title>` suffix, meta description default, favicons, web manifest |
| **Web address** | Public URL (e.g. `https://www.example.com`), validated (https, no trailing path) | `sitemap.xml`, canonical links, absolute Open Graph URLs, `robots.txt` sitemap line |
| **Social & sharing** | Social profile links (Facebook, Instagram, X, LinkedIn, YouTube, TikTok, GitHub, custom); default share image; X/Twitter handle | Social-links component in header/footer (bound to these values, so edit once, update everywhere); `og:image`, `twitter:site` |
| **Contact details** | Business name, email, phone, address | Contact/footer components bound to these values (like Bootstrap Studio's "placeholders") |
| **Search engines** | Allow indexing (on/off), include sitemap (on/off) | `robots.txt`, `<meta name="robots">` |

**Behaviour**
- **Editing:** values can be changed any time. Saving the dialog is one undoable step (*"Changed site settings"*). The dialog's own Save button counts as the confirmation that D7 asks for on site-wide changes, so there's no extra prompt.
- **Per-page overrides:** pages can override title, description and share image in *Page Settings*. Otherwise they inherit the site values.
- **Before export, if required values are missing** (currently: the web address), Webforge shows a prompt:
  > *"Add your site's web address? It's used for search engines (sitemap) and link previews on social media."*
  > **[Add address]** · **[Export without it]**
  - **Add address** opens Site Settings at that field, then continues the export.
  - **Export without it:** the export skips `sitemap.xml` and canonical links, and uses relative Open Graph URLs (social previews may not show an image). This is listed as a warning in the export report.
  - The prompt includes a *"Don't ask again for this site"* option. It reappears if the user later enables the sitemap.
- Missing optional values (social links, contact details) never block export. Components bound to an empty value are hidden in the export, and flagged on the canvas with a hint ("Add your Instagram link in Site Settings").

## Decision X4: readable output, no HTML/CSS minification (2026-10-19)

- **HTML:** pretty-printed with consistent indentation (React's `renderToStaticMarkup` emits one long line, so the pipeline formats it). Formatter: **`js-beautify`** (MIT; also used by Bootstrap Studio). Comments mark Webforge regions, e.g. `<!-- Header (shared) -->`.
- **CSS:** Tailwind output compiled **without minification**, readable and ordered: theme variables → base → components → utilities → `custom.css`. Lightning CSS is still used for vendor prefixes, not for minifying.
- **JS:** `webforge.js` and the user's `custom.js` are also kept **readable** (bundled, not minified), for consistency and debuggability.
- **Optional setting "Minify output" (off by default)** for users who want the smallest files.
- **Trade-off:** readable files are ~10–20% larger *uncompressed*. Most hosts serve gzip/Brotli, which removes most of that difference, so real-world impact on page load is small.
- Content-hashed filenames (`site.3f9a1c.css`) are unaffected and still give cache busting.

## Export checks: what blocks vs warns (decided X5, 2026-10-19)

### Options

| Option | How it works | ✅ Pros | ⚠️ Cons |
|---|---|---|---|
| **A. Never block** | Everything is a warning; export always succeeds | Maximum freedom; drafts always exportable | Users can unknowingly publish broken sites; breaks Webforge's promises (self-contained, works from disk) |
| **B. Strict** | Any problem, including quality issues (alt text, broken links, missing titles), blocks export | Published sites are always "clean" | Frustrating; can't export a work-in-progress to show a client; users feel nagged and lose trust |
| **C. Tiered** ⭐ | **Errors** block (with one-click fixes or an explicit override where safe); **Warnings** export and are listed in a report; **Suggestions** are tips | Blocks only what would *break* the site or Webforge's promises; quality issues never stop you | Needs careful classification; overrides must be clear |
| **D. Tiered + stricter Publish** | Like C, but some warnings (e.g. broken links) become errors when *publishing* to a live host (not when exporting a folder) | Drafts are easy; live sites are cleaner | Two rule sets to explain; decide after the publishing research |

### Decision X5: **Option C for Export**, **stricter rules for Publish** (Option D), plus **continuous checking while editing**

**Guiding rule:** *block only when Webforge can't produce a working site, would lose or overwrite data, or would break its own promises (self-contained output, works without a server). Everything about quality is a warning.*

**Errors (block export)**

| Check | Why it blocks | Resolution |
|---|---|---|
| **Build failure:** custom JS syntax error, invalid custom CSS, a component fails to render | No valid output can be produced | Error shows file + line; jump to it. No override |
| **Duplicate output paths:** two pages that would both become `about.html`, or a page named like a reserved folder (`assets`) | One file would silently overwrite another | Rename (auto-suggested). No override |
| **Invalid file/page names** (characters not allowed on Windows/servers, reserved names like `con`) | Files fail to write or upload | **Auto-fix**: one click to rename |
| **No home page** | Site has no `index.html` | **Auto-fix**: pick which page is Home |
| **Unresolved external resources** (scripts, stylesheets, fonts loaded from other servers) | Breaks the self-contained promise (C8) | **Download and bundle** (one click), remove, or **explicitly allow** that URL (e.g. a deliberate analytics script). Allowed exceptions are listed in Site Settings |
| **Missing or corrupt asset** (image in use but its data is missing from the project) | Output would contain broken images | Replace or remove; override **"Export without these images"** |
| **Export destination problem** (folder not writable, disk full, folder contains non-Webforge files that would be overwritten) | Data loss / failure | Choose another folder; or confirm overwrite (non-Webforge files listed first) |

**Warnings (export continues; shown in the export report)**
- Broken internal links (to a deleted page or missing section anchor)
- **Leftover placeholder content:** template "Lorem ipsum", sample stock text, `example.com` links, default "Your Company" text (very common for non-technical users)
- Missing web address (after the X3 prompt was skipped), so no sitemap and social previews may lack images
- Missing image alt text; images that are links without text
- Missing page title or description
- Text/background colour contrast below WCAG AA
- Forms with no form service configured (they won't send anywhere)
- Very large images (e.g. originals over 5 MB or wider than 4000 px), which slow the first export

**Suggestions (info only)**
- No or several `<h1>` on a page; skipped heading levels
- Pages not linked from the navigation (orphan pages)
- Long page titles/descriptions that search engines will truncate
- Component bound to an empty Site Settings value (hidden in export)

**Publish (to a live host) is stricter.** These export *warnings* become **errors when publishing**:

| Check | Why stricter for a live site | Resolution |
|---|---|---|
| Broken internal links | Visitors hit dead ends; hurts search ranking | Fix link / remove; jump to each |
| Missing web address | Required for sitemap, canonical and social previews on a live site | Add in Site Settings |
| Leftover placeholder content (Lorem ipsum, "Your Company", `example.com`) | Embarrassing on a public site | Edit; **Ignore** per item for false positives |
| Forms with no form service configured | Visitors' messages would be lost | Configure a form service (publishing research) or remove the form |
| Missing page title | Search results and browser tabs show a blank/URL | Add title (auto-suggest from the page's first heading) |

- Ignored items (marked "Ignore" by the user) don't block publishing.
- Everything else stays a warning or suggestion on Publish too. The final list will be confirmed during the publishing research.

### Making it pleasant
- **Issues panel, live while editing:** the same checks run continuously (debounced, in the background) and show a small badge such as *"2 errors · 5 warnings"*. Users fix things as they go, so the export dialog rarely surprises them.
- **Click an issue to jump** to the page/component; **Fix** buttons wherever an automatic fix exists.
- **Ignore per issue** for warnings and suggestions (e.g. a decorative image that intentionally has no alt text), remembered in the project.
- **Export report** after every export: pages written, total size, warnings, and a link to open the site from disk.

## "Export as Astro project": requirements, benefits, costs (decided X6, 2026-10-19)

### What it would produce
A developer-ready source project instead of finished files:
```
my-site-astro/
├── package.json, astro.config.mjs        ← Astro 7 + @tailwindcss/vite + daisyUI (+ @astrojs/react, @astrojs/sitemap)
├── src/
│   ├── layouts/Base.astro                 ← <head>, Header, Footer (shared once, not copied per page)
│   ├── pages/index.astro, about.astro …   ← one file per page, composed from components
│   ├── components/Hero, Card, Navbar …    ← our site components (see approaches below)
│   ├── data/site.json                     ← Site Settings (URL, social links, contact details)
│   └── styles/global.css                  ← Tailwind @theme tokens + daisyUI theme
├── public/assets/…                        ← fonts, original images (Astro optimises at build)
└── README.md                              ← how to run: npm install · npm run dev · npm run build
```
The developer needs Node.js and runs `npm run build` to get a static site (or adds a server adapter).

### Two ways to build it
| Approach | How | Effort | Ongoing cost |
|---|---|---|---|
| **1. Reuse our React components** | Export our React site components + page data. Astro renders them with `@astrojs/react` to static HTML (zero JS by default) | Lower: no second set of templates | Exposes our component source; less idiomatic for Astro developers |
| **2. Generate native `.astro` components** | Maintain an Astro template for every Webforge component | High: every component written twice | Every new or changed component must be updated in both renderers |

### Benefits over plain HTML/CSS/JS
These benefits are **for developers who take over the site**, not for Webforge's non-technical users.

| Benefit | Plain HTML export (X1/X4) | Astro project |
|---|---|---|
| Hand-editable by a developer | ✅ Readable HTML/CSS | ✅ |
| Shared header/footer edited once in code | ❌ Repeated in every `.html` file | ✅ One layout component |
| Reusable components with props, loops, data files | ❌ | ✅ |
| Add a blog (Markdown), RSS, i18n, a headless CMS | ❌ Manual | ✅ Built-in integrations |
| Server features (APIs, forms backend, SSR, auth) | ❌ | ✅ Via adapters (Netlify, Vercel, Cloudflare, Node) |
| Git workflow, TypeScript, hot reload | ⚠️ Possible but manual | ✅ |
| Works by just uploading files | ✅ | ❌ Needs a build step first |
| Usable by non-technical users | ✅ | ❌ |

### Costs and risks
- **One-way door:** changes made in the Astro project can't be brought back into Webforge. Users must understand this is a hand-off, not a sync.
- **Maintenance treadmill:** Astro ships a major version roughly yearly, so the generated project, integrations and README need updating and testing for each Webforge release.
- **IP / licensing (paid product):** approach 1 hands out our site-component source code. We'd need export licence terms ("you may use and modify the exported code for your site") and must accept competitors could read it. Plain HTML export exposes only output markup and CSS.
- **Support burden:** developers will report Astro build issues to Webforge support.
- **Effort:** approach 1 is roughly **3–5 weeks** initially (generator, React integration, image/font mapping, tests) plus ongoing upkeep; approach 2 is roughly double, with permanent duplicate maintenance.

### Cheaper alternative: "Include developer files" (export option)
Most of the hand-off value comes from giving a developer the **design system** behind the site:
- `src/input.css`: the Tailwind v4 source with Webforge's `@theme` tokens (colours, fonts, spacing), daisyUI theme and custom CSS, so a developer can regenerate or extend the CSS with the standard Tailwind CLI.
- `design-tokens.json`: theme values in a neutral format.
- `site.json`: Site Settings.
- `README.md`: how the export is structured and how to rebuild CSS.

Effort: roughly **2–3 days**. Exported HTML keeps working as-is.

### Decision X6
- **Not in MVP.** Webforge's target users won't use it, and plain HTML export already avoids lock-in.
- **MVP or soon after:** add the low-cost **"Include developer files"** option.
- **Revisit "Export as Astro project" after launch** only if agencies/customers ask for it. If built, use **approach 1** (reuse React components), with clear licence terms for exported code.

## Live preview (same pipeline, in memory)
- **Stages 3–6 only**, kept in memory; images served as originals (no optimisation) for speed.
- Served by a small HTTP server in the main process, plus SSE live reload with CSS-only hot swap (the Bootstrap Studio pattern, see [../bootstrap-studio/02-architecture.md](../bootstrap-studio/02-architecture.md)). Viewable on phones on the same Wi-Fi.
- **Incremental:** cache rendered HTML per page by content hash. Keep one Tailwind compiler instance and grow the candidate set (only rebuild CSS when new classes appear or the theme changes). Cache image derivatives by blob hash, in the export worker's memory while the site is open (first planned for the app cache folder; R15 and ADR 0005 moved it, since a copy on disk would outlive the site).
- **Targets:** CSS-only change in the browser in under 100 ms; page re-render in under 200 ms.

## Where the work runs
- The pipeline runs in an **Electron `utilityProcess`** (a Node worker), never in the UI renderer, so typing and dragging never stall during a build.
- The model snapshot is passed in. Progress and results are reported back over IPC.

## Libraries (all permissive; checked on npm 2026-10-19)

| Job | Library | Licence | Notes |
|---|---|---|---|
| CSS | `tailwindcss` 4.3.3 + `@tailwindcss/node` / `@tailwindcss/oxide` | MIT | Programmatic `compile(css, {base}) → build(candidates)`; `Scanner.scan_files([{content, extension}])` works on strings |
| Components CSS | `daisyui` 5.7.x | MIT | Loaded via `@plugin` |
| CSS processing | `lightningcss` (inside Tailwind v4) | **MPL-2.0** | ⚠️ File-level copyleft. Fine if used unmodified (rule C1); include notice. Used for prefixing; minify only if the setting is on |
| JS bundling | `esbuild` 0.28 | MIT | Native binary per platform (prebuilt) |
| HTML formatting | `js-beautify` | MIT | Pretty-prints HTML (and CSS/JS if needed) per X4. `html-minifier-terser` (MIT) only if the optional *Minify output* setting is enabled |
| Images | **`@jsquash/*`** (resize, webp, avif, jpeg, png) | **Apache-2.0** | ✅ WebAssembly, no native module and no LGPL. Slower than sharp, but results are cached per image |
| Images (alternative) | `sharp` 0.35 | Apache-2.0 **+ libvips LGPL-3.0** | ⚠️ Fastest, but bundles LGPL libvips (dynamic linking; needs licence review for a paid product) and a native module per platform |
| Fonts | `@fontsource/*` | OFL-1.1 | woff2 per family/weight/subset |
| Icons | `lucide-static` | ISC | Inline SVG |
| Sitemap | `sitemap` 9 | MIT | Needs the site's public URL (setting) |
| Link check (optional) | `linkinator` 8 | MIT | Post-export check |
| Accessibility check (optional) | `axe-core` | MPL-2.0 | ⚠️ Same MPL rule; run in a hidden window on the export |

**Image recommendation:** start with **jSquash** to avoid both the LGPL question and another native module. Switch to `sharp` only if real projects prove too slow, after a licence review.

## Spike (2–3 days)
1. Render a 5-page Puck project (Header/Footer layout, daisyUI components) to static HTML in a `utilityProcess`.
2. Tailwind v4 + daisyUI compiled programmatically from scanned candidates, from inside the packaged app (check `@plugin` resolution from within `app.asar`).
3. jSquash: 20 photos → WebP at 3 widths. Measure time (cold and cached).
4. Preview server with SSE CSS hot-swap; measure edit-to-browser latency.
5. Export folder opens correctly via `file://` (double-click `index.html`) in Chrome, Edge, Firefox and Safari, including fonts and scripts, **and** after upload to a plain static host. Confirm no external requests (block all network in a test browser).

## Open questions
1. ~~Clean URLs vs file-friendly links~~ → **Decided X1: flat `about.html` files, relative links, no server needed.** Optional host-specific clean URLs post-MVP. One exception, `404.html` (F-ED-20, 3.5): a host serves it at any missing address, so its links and files start at `/`. It works only over http, and misses its styles on a site hosted in a folder (a GitHub project page); every other page is unaffected ([pipeline README](../../packages/pipeline/README.md)).
2. ~~Image formats~~ → **Decided X2: WebP + JPEG fallback** (PNG fallback for transparent images) via `<picture>`; JPEG for social images; AVIF not by default.
3. ~~Site URL setting~~ → **Decided X3: Site Settings dialog** (editable any time; URL, social links, contact details, SEO), with a prompt before export if the web address is missing.
4. ~~HTML minification~~ → **Decided X4: keep HTML, CSS (and JS) readable**; optional "Minify output" setting, off by default.
5. ~~Export blocking rules~~ → **Decided X5:** tiered errors/warnings/suggestions for Export; **Publish stricter** (broken links, missing web address, placeholder content, unconfigured forms, missing titles become errors); live Issues panel. See [Export checks](#export-checks-what-blocks-vs-warns-decided-x5-2026-10-19).
6. ~~"Export as Astro project"~~ → **Decided X6:** not MVP; add the **"Include developer files"** export option (Tailwind source + theme tokens + site.json + README); revisit Astro export after launch only on demand (approach 1, with licence terms for exported code).

## Sources
- Image format support: [caniuse WebP](https://caniuse.com/webp) · [caniuse AVIF](https://caniuse.com/avif) · [caniuse JPEG XL](https://caniuse.com/jpegxl) · [Tailwind v4 compatibility](https://tailwindcss.com/docs/compatibility)
- Tailwind v4 programmatic use: [compile/build quick start](https://tessl.io/registry/tessl/npm-tailwindcss/files/docs/guides/quick-start.md) · [@tailwindcss/oxide Scanner](https://tessl.io/registry/tessl/npm-tailwindcss--oxide)
- sharp licensing: [licenses.dev: sharp](https://licenses.dev/npm/sharp/0.35.4) · [@img/sharp-libvips (LGPL-3.0)](https://classic.yarnpkg.com/en/package/@img/sharp-libvips-win32-x64)
- npm registry (`npm view`), 2026-10-19: tailwindcss 4.3.3, lightningcss 1.33 (MPL-2.0), sharp 0.35.5, @jsquash/* (Apache-2.0), esbuild 0.28.2, html-minifier-terser 7.2.0, astro 7.4.0, @11ty/eleventy 3.1.7, sitemap 9.0.1, linkinator 8.1.0
- Preview architecture precedent: [../bootstrap-studio/02-architecture.md](../bootstrap-studio/02-architecture.md)
