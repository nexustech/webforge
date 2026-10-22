# Bootstrap Studio 9.0: Competitor Review

**Status:** ✅ Decided 2026-10-22: all proposals adopted ([§6](#6-decisions))
**Date:** 2026-10-22
**Question:** What does Bootstrap Studio 9.0 (released 20 Oct 2026) add since 8.0.1, and which of it should Webforge add to the MVP or v1.1?

## 1. Method
- **Release notes and docs:** the official release notes and the docs pages for the new features (CMS collections, CMS components, CMS content, AI Assistant, images, animations).
- **The installed app:** version 9.0.0, installed on 20 Oct in `C:\Users\jabz_\AppData\Local\Programs\bstudio`.
  - Read `resources/app.asar` with a Python asar reader: `package.json` reads `"version": "9.0.0"`.
  - Pulled about 6,000 UI strings and 69 docs links out of the renderer bundle (`app/static.js`, 17.6 MB) and the `index.html` dialogs.
  - Nothing on the machine was changed; the extracted copies stayed in a temporary folder.
- **Baseline:** the v8.0.1 research in this folder ([04-key-features.md](04-key-features.md)) and Webforge's current plans: [MVP spec](../../spec/02-mvp-spec.md), the [gap analysis](../product/05-feature-gap-analysis.md) (GA1–GA9) and the [CMS decisions](../product/02-cms.md) (M1–M5).

**Confidence:** high for what 9.0 contains, because the release notes, the docs and the shipped strings agree. Medium for how some features behave, such as when CMS Loop limits are applied, which the docs don't state.

## 2. What's new in 9.0
| Area | Feature | Seen in the app | Notes |
|---|---|---|---|
| **CMS** | **Collections** with custom fields | ✅ "Create New Collection", "Custom Fields", "System Fields" | Field types: Text, Long Text, Markdown, Date, Image, Number, URL, Email, Phone, Switch, **Relation** (many-to-many, with reverse relations). System fields: Name, Slug, Show in Sitemap, Created At. Starter collections: Articles, Tags, Authors |
| | **Generated pages** per item | ✅ "Collection Page Template", "Collection URLs" | A template page renders one static page per item (`/blog/paris.html`). A normal page at an item's address overrides it. Optional **RSS feed** per collection |
| | **CMS Loop** | ✅ "CMS Loop Filtering", "CMS Loop Pagination", "Exclude Current Item" | Lists items (or the pages in a folder, or an item's relations). **Build-time filters** ("Featured is true"), **browser filters** from URL parameters (`?tag=news`), **client-side pagination** (12 per page by default), sort by field or by usage, an Empty State, one level of nesting |
| | **CMS Nav** | ✅ | A menu built from a related collection (e.g. tags) that filters a loop, with an "All" link and an active item |
| | **Field binding** and conditions | ✅ "Conditional Visibility", "Add classes to the component depending on CMS field values" | Bind text, images and links to fields, with length limits and date/number formats. Show, hide or add classes based on field values |
| | **Page CMS Options** | ✅ | Ordinary pages get Image, Name, Excerpt, Tags, Authors and Date, so a loop can list pages from a folder |
| | **CSV import/export** | ✅ "Import CSV", "Import CSV (Replace All)", "Export as CSV" | Previews adds, updates and skips, with per-row errors. Collections can be copied between designs |
| **Content** | **Markdown** component | ✅ "Parse Markdown to Components" | Markdown rendered to HTML, styled with Bootstrap classes; can be converted into normal components |
| **Components** | **Marquee, Scroll Tracker, Scroll To Top, Preloader** | ✅ "Scroll Tracker", "Scroll To Top" ("A floating button that returns the user to the top of the page…") | No-code effects |
| | **Sticky navbar scroll transition** | ✅ "Sticky Scroll Transition" | Adds a `scrolled` class after a scroll threshold, so the header can shrink or turn solid |
| | More hover animations | ✅ | Animate.css hover styles; scroll animations use AOS |
| **Editor** | **Undo and Redo merged into one control with a history list** | ✅ "Undo History" | — |
| | Find and Replace now searches code and CMS data | ✅ | — |
| | **Monaco** code editor (VS Code-like), CSS bezier/easing tool, MDN tooltips, JS Defer/Async properties | ✅ Monaco workers in `assets/workers` | Developer features |
| | Dark-mode dialogs; New Design dialog filters templates; fuller recent-file names | ✅ | — |
| **AI Assistant** | More local providers and newer models | ✅ "Manage AI Models": Provider, Model ID, Base URL, API Format (Responses / Chat Completions) | OpenAI, Google, Anthropic, OpenRouter, plus local models through Ollama or llama.cpp (LM Studio through a base URL). **Auto Apply** on by default, or proposals to accept or decline. Image generation with OpenAI/Google keys. Context-usage warning. Keys stay local. **No MCP server** (the "MCP" matches in the bundle are base64 data) |
| **Templates** | Three premium templates (X1 Launch, Specialty Coffee, Wellness) using the CMS | — | Sold separately from the licence |

**Still present from 8.x, and relevant to Webforge:**
- **Hosting and forms:**
  - bss.design hosting with custom domains;
  - **password protection with a passkey**;
  - **temporary sites** that delete themselves after a day, week or month;
  - **Smart Forms** (an email relay with verified recipients).
- **E-commerce:** the Reflow service (products, cart, Stripe/PayPal checkout, coupons).
- **Images:** stock photos from **Unsplash, Pexels and Pixabay**, downloaded into the design; **Optimize Images** (finds and compresses large images).
- **Checks:** a **Check for Issues** scan for duplicate IDs, broken links and images, and unoptimised images.
- **Media components:** Lottie, Instagram Embed/Feed, Chart.js.
- **Other:** View Transitions, Linked Components with "Find Linked Copies", a Library shared with a team, and **per-page asset visibility** (load a CSS/JS file only on some pages).
- **Platforms and pricing:** Windows, macOS and Linux, with a lifetime licence plus paid premium templates.

## 3. Where Webforge already stands
Webforge already matches or exceeds 9.0 here (MVP unless stated):

| Bootstrap Studio 9.0 | Webforge |
|---|---|
| Undo menu with a history list | **Undo History panel** with labelled steps, click to jump and selection restore (F-ED-9). Stronger |
| Backups | **Version History** (named, automatic, restore, open as new site, republish) plus backups. Bootstrap Studio has backups only |
| Check for Issues (duplicate IDs, links, images) | **Site Check**: Must fix / Should fix / Tips, Fix buttons, stricter rules before publishing (F-CHK-1). Broader |
| AI Assistant, own key | Own-key assistant in v1.1 (GA9), **plus connect AI apps over MCP in the MVP** (F-AI-1). Bootstrap Studio has no MCP |
| Linked Components | **Shared sections** + Header/Footer (F-ED-7, F-ED-23) |
| Spell check with dictionaries | Spell check (F-ED-19) |
| Optimize Images | Export makes responsive WebP + JPEG/PNG automatically and keeps originals (F-EX-2); Site Check flags large images |
| Stock photos | Pexels/Pixabay in v1.1 (G26) |
| Find and Replace | v1.1 (G4) |
| Animations (AOS/Animate.css) | Entrance and hover animations with reduced-motion support (F-DS-5) |
| Mac, Windows, Linux | Mac and Windows; Linux not planned |
| Designer-oriented (Bootstrap classes, code) | Built for non-technical owners: Simple mode, Content mode, plain words (T1–T4) |

## 4. Gaps and recommendations
Effort: **S** ≈ a day or two · **M** ≈ 1–2 weeks · **L** ≈ several weeks.

### 4.1 Proposed for the MVP (small, fits existing items)
| # | Feature | Why for Webforge's users | Effort | Fits in |
|---|---|---|---|---|
| BS9-1 | **Header: sticky with a scroll style** (*Stay at the top* and *Change style when scrolling*: shrink, turn solid or add a shadow) | A common look on small-business sites, and transparent-over-hero headers need it to stay readable. Needs only a few lines in `webforge.js` plus CSS; works from disk | S | 2.6 Sections A (Header) |
| BS9-2 | **Back-to-top button** (Site Settings or a page option; appears after scrolling, keyboard accessible) | Helps visitors on long one-page sites, which DIY users often build | S | 2.9 Elements, or a site option |

### 4.2 Proposed for v1.1
| # | Feature | Why | Effort | Notes |
|---|---|---|---|---|
| BS9-3 | **Build the v1.1 Blog on a general collections engine** | Bootstrap Studio's CMS is collections-first: custom fields, relations, generated pages per item, loops with filters and pagination, field binding, conditional visibility, CSV import/export, RSS. If Webforge's Blog (M2) uses the same engine, **Portfolio, Team, Events and Menus become presets** instead of separate builds | L (Blog already planned) | Keeps M2's plain words: users pick "Blog" or "Portfolio", not "collection". Browser-side filters and pagination are classic scripts and work from disk (X1). One general change to the MVP model may help: see §5 |
| BS9-4 | **Markdown when pasting or importing text** | Owners who draft posts elsewhere can paste Markdown and get formatted text | S | Fits the Blog's Markdown import (M2); no separate Markdown component for this audience |
| BS9-5 | **Reading progress bar** for blog posts | Small polish for long posts | S | With the Blog |
| BS9-6 | **Scrolling logo strip** (marquee style for the Logos section) | Popular for "As seen in" and partner logos | S | Needs a pause control and must stop for reduced motion (WCAG 2.2.2) |
| BS9-7 | **Instagram post embed** (click-to-load, like other embeds) | Cafés, salons and photographers live on Instagram | S | Click-to-load keeps C8/B7. A live **feed** needs a server or token: out of scope |
| BS9-8 | **Share a preview link** before publishing (a Netlify draft deploy) | The closest privacy-safe match to Bootstrap Studio's temporary sites: send a link to a partner or client before going live | S–M | Uses the Netlify publisher (4.2); only for sites with a Netlify destination |
| BS9-9 | **Smooth page transitions** (CSS cross-document view transitions) | Cheap polish; browsers without support just navigate normally | S | Check behaviour from `file://` in a spike |
| BS9-10 | **AI assistant details** for GA9 | Bootstrap Studio shows what users expect | — | Sharpens the v1.1 design rather than adding scope: providers including local models (Ollama, llama.cpp, any OpenAI-compatible base URL); a *Review changes* mode as well as auto-apply (ours is always undoable); a context and usage meter; and clear privacy wording (keys local, calls go straight to the provider) |

### 4.3 Not proposed
| Feature | Reason |
|---|---|
| **Preloader** (loading screen) | Makes sites feel slower and hides content from visitors and search engines; static sites load fast already |
| Marquee **text** ticker | Hard to read and an accessibility risk; the logo strip (BS9-6) covers the useful case |
| Hosting, passkey-protected sites, temporary sites, Smart Forms relay | Need a Webforge server (B2 deferred); G24 password pages stay later |
| E-commerce cart (Reflow) | Out of scope (G23); Buy buttons cover simple selling |
| Monaco code editor, bezier tool, MDN tooltips, JS defer/async, export scripts, per-page CSS/JS visibility | Developer features; Custom Code (Advanced) is enough for the MVP. Revisit per-page code with demand |
| Lottie, charts, Instagram feed | Niche, or need external scripts or tokens (G16 later) |
| AI image generation | Out of scope (G25d) |
| Team libraries | Single-user product; a cross-site saved-sections library stays later (C5, GA6) |

## 5. Design note for the MVP (no extra scope)
Bootstrap Studio's CMS shows the shape a collections engine needs. To make BS9-3 cheap later, MVP model work should:
- keep IDs and the schema migration chain general enough to add a `collections` document later (already planned: format version + migrations, 1.4);
- keep **Site Settings bindings** (1.17) on one mechanism that can later bind to collection fields;
- keep **repeating lists** (F-ED-6) as plain data that can later be promoted to a collection.

No MVP work item changes. This is guidance for reviews of 1.4, 1.17 and 2.5.

## 6. Decisions
Decided by the product owner on 2026-10-22: every proposal is adopted.

| # | Decision |
|---|---|
| BS9-1 | ✅ **MVP:** sticky header with a scroll style. Spec F-DS-6; plan item 2.6 (+1 day) |
| BS9-2 | ✅ **MVP:** back-to-top button. Spec F-CM-9; plan item 2.9 (+1 day) |
| BS9-3 | ✅ **v1.1:** the Blog is built on a general collections engine (amends M2). Portfolio, Team, Events and Menus follow as presets on the same engine. MVP model work follows the design note in §5 |
| BS9-4 – BS9-9 | ✅ **v1.1:** Markdown paste/import, reading progress bar, scrolling logo strip, Instagram post embed (click-to-load), share a preview link (Netlify draft deploy), smooth page transitions |
| BS9-10 | ✅ **v1.1 AI assistant design (GA9):** local and OpenAI-compatible providers, a *Review changes* mode alongside auto-apply, a context and usage meter, and the privacy wording |

## Sources
- [Bootstrap Studio releases](https://bootstrapstudio.io/pages/releases): 9.0.0, 20 Oct 2026
- Docs: [CMS collections](https://bootstrapstudio.io/docs/cms-collections.html) · [CMS components](https://bootstrapstudio.io/docs/cms-components.html) · [CMS content](https://bootstrapstudio.io/docs/cms-content.html) · [AI Assistant](https://bootstrapstudio.io/docs/ai-assistant.html) · [Images](https://bootstrapstudio.io/docs/images.html) · [Animations](https://bootstrapstudio.io/docs/animations.html)
- [Forum: roadmap and lifetime licence](https://forum.bootstrapstudio.io/t/clarification-on-bootstrap-studio-roadmap-and-lifetime-license/12641)
- Local: `C:\Users\jabz_\AppData\Local\Programs\bstudio\resources\app.asar` (v9.0.0)
