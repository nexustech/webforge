# Competitor Feature Gap Analysis

**Status:** ✅ Decided 2026-10-20 (GA1–GA4); updated 2026-10-22 after reviewing RapidWeaver Elements 3.0 (GA5–GA9, see [§3.7](#37-rapidweaver-elements-30-update-2026-10-22) and [§5](#5-decisions))
**Question:** Which features do competitor tools offer that Webforge's plans ([MVP spec](../../spec/02-mvp-spec.md), roadmap and research decisions) don't yet account for?

## 1. Competitors reviewed

| Tool | Type | Why it matters |
|---|---|---|
| **Bootstrap Studio 8** | Desktop (Win/Mac/Linux), Bootstrap, paid | Closest model for Webforge ([analysis](../bootstrap-studio/04-key-features.md)) |
| **RapidWeaver Elements** | Desktop (macOS 13+), **Tailwind-based**, subscription | Closest *Tailwind* desktop rival |
| **Blocs 6.4** | Desktop (Mac), Bootstrap 5 | Strong DIY-friendly desktop builder |
| **Mobirise** | Desktop (Win/Mac), free + paid extensions | Popular free offline builder |
| **Pinegrow** | Desktop (Win/Mac/Linux), pro HTML/Tailwind editor | Developer-leaning Tailwind visual editor |
| **Wix, Squarespace** | Hosted SaaS | What DIY small-business users already know |
| **Webflow, Framer** | Hosted SaaS, designer-focused | Set expectations for interactions, CMS and AI |

## 2. What Webforge already covers well
Many competitor features are already in the plan, sometimes stronger than competitors:
- **Building and design:** drag-and-drop sections/elements, click-to-edit text, themes and brand colours, curated fonts, responsive views, QR-code phone preview.
- **Safety:** undo/redo with a history panel, **Version History** (Elements and Mobirise don't describe versioning), periodic autosave, crash safety.
- **Sharing and editing:** shared Header/Footer, Content mode.
- **Publishing:** to folder/FTP/SFTP/Netlify; self-contained output with no CDNs.
- **Site details:** Site Settings (SEO, Open Graph, sitemap, social links), WebP images.
- **Quality checks:** Site Check (incl. accessibility, contrast, placeholder text).
- **Business features:** forms with service presets, Buy buttons, GA4 + consent banner, privacy-friendly embeds, Custom Code.
- **Roadmap:** Blog (v1.1), search and multilingual (v1.2+), developer export files.

## 3. Gaps found

Effort: **S** ≈ days · **M** ≈ 1–2 weeks · **L** ≈ several weeks.

### 3.1 Editing & navigation basics (expected in any builder)
| # | Gap | Who has it | Why it matters for Webforge | Effort | Recommendation |
|---|---|---|---|---|---|
| G1 | **Copy & paste** of sections/elements between pages and between sites. Paste images from the file explorer/clipboard onto the canvas. Paste a YouTube/Vimeo URL to create an embed | Blocs, Bootstrap Studio, Wix, Elements | Basic expectation. The spec only mentions *duplicate* | S–M | **MVP** |
| G2 | **Navigation menu editor**: custom menu items (external links, links to a section, dropdown sub-menus), separate from page order | Wix "Pages & Menu", Squarespace, Bootstrap Studio | The spec ties the menu to page order only. Small businesses need "Book now" links and dropdowns | M | **MVP** |
| G3 | **Link to a section** (anchor links) from the link dialog, for one-page sites | All | Currently only via the Advanced tab's anchor ID | S | **MVP** |
| G4 | **Global find & replace** of text across the site | Blocs 6.3, Bootstrap Studio | Fix a misspelt business name or an old phone number everywhere | S–M | v1.1 |
| G5 | **Spell check** while editing text | Electron/Chromium built-in; Wix | Typos on a business site look bad. Cheap with Electron's spellchecker | S | **MVP** |
| G6 | **Editable 404 page** as a special page in the Pages panel | Bootstrap Studio | Spec exports `404.html` but doesn't say users can design it | S | **MVP** |
| G7 | **Redirects when a page is renamed** (old URL → new URL) | Squarespace/Webflow (301s) | Renaming `about.html` breaks links and search ranking. Static hosts can't do server redirects universally. Generate a redirect stub page (meta refresh + canonical) plus Netlify `_redirects`/Apache `.htaccess` entries | M | v1.1 |

### 3.2 Visual features users expect
| # | Gap | Who has it | Why it matters | Effort | Recommendation |
|---|---|---|---|---|---|
| G8 | **Entrance animations / scroll effects** (fade, slide, zoom on scroll) and **hover effects** on buttons and cards | Bootstrap Studio (AOS/Animate.css), Elements (Scroll FX, hover transforms), Blocs, Webflow/Framer | Very common on modern small-business sites; absent from our spec | S–M | **MVP-lite:** a few CSS presets with a small observer in `webforge.js`; respect *prefers-reduced-motion*. Advanced timeline interactions out of scope |
| G9 | **Carousel / slider** (images, testimonials, logos) | Bootstrap Studio (Swiper), Blocs (10 transitions), Mobirise | Not in the catalogue (S1). Testimonial sliders are very common | M | **MVP:** one accessible Carousel element with pause/keyboard support |
| G10 | **Lightbox** (click a gallery image to enlarge) | Bootstrap Studio, Blocs, Mobirise, Wix | Galleries feel broken without it | S | **MVP:** Gallery option, native `<dialog>` + small JS |
| G11 | **Typography scale and button styles in the Theme** (heading sizes, body size, button shape/style) | Squarespace Site Styles, Elements Theme Studio, Pinegrow Design panel | F-DS-2 covers colours, fonts, roundness and spacing, but not text sizes or button styles | S | **MVP** |
| G12 | **Site dark mode** (auto dark/light by visitor preference, optional toggle) | Elements ("dark mode colours") | Themes already have light/dark variants (daisyUI); exposing a site-level option is cheap | S | v1.1 |
| G13 | **Video background** hero variant | Mobirise, Blocs, Wix | Popular hero style | S | v1.1 (hero variant) |
| G14 | **Image focal point** (keep faces in frame when cropped on mobile) | Squarespace, Wix | Hero/cover images crop differently per device | S | **MVP** (with crop, F-ED-5) |
| G15 | **Alt text stored on the image in Media**, reused wherever it's placed (override per use) | Blocs 6.3 (global alt tags) | Fewer missing-alt warnings; better accessibility by default | S | **MVP** |
| G16 | **Tables, timeline, countdown, charts** | Bootstrap Studio (Chart.js), option C | Niche for the target persona | M | Later, on demand |

### 3.3 Small-business tools (static-friendly)
| # | Gap | Who has it | Static-friendly approach | Effort | Recommendation |
|---|---|---|---|---|---|
| G17 | **Newsletter signup** section | Bootstrap Studio (Newsletter blocks), Wix/Squarespace email marketing | Plain HTML form POST to the provider's embedded-form URL (Mailchimp, Brevo, MailerLite…), like our form presets. No external JS | S | **MVP** (section + presets) |
| G18 | **Bookings / appointments** (salons, trades, consultants) | Squarespace (Acuity), Wix Bookings | **"Book now" button with presets** linking to the user's booking page (Calendly, Square Appointments, Fresha, Acuity, SimplyBook), like Buy buttons. Embedded widgets via Custom Code only (external JS, C8) | S | **MVP** |
| G19 | **Announcement bar** ("Closed 24–26 Dec") and simple **popup** (e.g. newsletter, opening offer) | Squarespace (pop-ups), Wix | Section + element with dismiss stored in `localStorage`; no external JS | S | v1.1 |
| G20 | **Legal page templates** (Privacy Policy, Cookie Policy, Terms) | Wix policy generators | We add forms and GA, so users need these. Provide templates with placeholders and a "not legal advice" note; Site Check warns if forms/GA exist but no privacy page | S | v1.1 |
| G21 | **Dynamic year** in footer copyright | Blocs (year shortcode) | Inserted at export | S | **MVP** |
| G22 | **Social share preview** (how a page link will look on Facebook/LinkedIn/X) in Page Settings | Blocs (social thumbnail defaults), Wix | Helps users pick title/description/share image | S | v1.1 |
| G23 | **Full shopping cart / store** | Mobirise (PayPal cart), Wix, Squarespace | Needs external JS or a server; conflicts with C8 | L | **Out of scope** (Buy buttons cover simple selling, M1) |
| G24 | **Password-protected pages** | Bootstrap Studio (its hosting), Wix | Impossible on generic static hosting. Possible with Netlify/Apache config later | M | Later, host-specific |

### 3.4 AI features (the biggest gap)
Bootstrap Studio 8 added an **AI Assistant** (bring-your-own key). Wix, Squarespace and Framer offer **AI site generation**, Wix offers AI copywriting, Blocs offers AI meta and social descriptions, and Wix and Framer offer AI image editing. **Webforge's plans don't mention AI at all.**

| # | Feature | Value for DIY users | Static/privacy fit | Effort |
|---|---|---|---|---|
| G25a | **Write and rewrite text** ("make this friendlier", "shorten", "fix grammar") in the text toolbar | ⭐⭐⭐ | Bring-your-own key, or a local model | M |
| G25b | **Generate meta descriptions, social descriptions and image alt text** | ⭐⭐⭐ (also fixes Site Check warnings) | Same | S–M |
| G25c | **Generate a starting site from a short description** (business type, name, services) → template + theme + copy | ⭐⭐ | Same | L |
| G25d | AI image generation/editing | ⭐ | Costly, licensing questions | L |

**Constraints:**
- **Webforge has no server** (B2 deferred).
- **Privacy matters:** we never send site content anywhere by default.

**Options:**
1. **Bring your own API key** (OpenAI, Anthropic, Google, local Ollama), as Bootstrap Studio does. No server or cost for us. Content goes only to the provider the user chose, with clear opt-in.
2. **Webforge-hosted AI** as part of the paid licence. Simplest for users, but ongoing cost and a server, which ties to the deferred hosting decision.
3. **No AI.**

**Recommendation:**
- **v1.1:** option 1, starting with G25b (meta/alt text) and G25a (rewrite text), since they're cheap and directly support Site Check.
- **Later:** G25c (site from description).
- **Not planned:** G25d.
- **Design rules:**
  - The AI layer must go through `HistoryManager` (undoable, labelled "AI: Rewrote Hero text"). This avoids Bootstrap Studio's known issue of AI edits breaking linked components.
  - AI must never run without explicit user action.

### 3.5 Content & media
| # | Gap | Who has it | Notes | Effort | Recommendation |
|---|---|---|---|---|---|
| G26 | **Free stock photo search** inside Media | Wix, Squarespace, Blocs | Unsplash's API terms require **hotlinking** images from Unsplash, which conflicts with self-contained sites (C8). Pexels/Pixabay APIs allow downloading. Downloaded photos are stored in the site | M | v1.1 (Pexels/Pixabay; licence check per S5) |
| G27 | **Icon picker** for Lucide icons | All | Implied by the Icon element; make the searchable picker explicit | S | **MVP** (clarify in spec) |

### 3.6 Ecosystem & workflow
| # | Gap | Who has it | Recommendation |
|---|---|---|---|
| G28 | **Third-party components/themes marketplace + component API** | Elements Store + API, Pinegrow libraries, Mobirise extensions | Later: strategic. Design `site-components` so a future plugin API is possible; no marketplace in MVP |
| G29 | **Cloud backup/sync of projects** | Elements Cloud (1 GB) | Out of scope (no server, B2). Users can keep `.wforge` files in OneDrive/Dropbox (06 notes risks) |
| G30 | **Collaboration / comments** | Webflow, Framer | Out of scope (single-user desktop) |
| G31 | **Custom workspaces** (saved panel layouts) | Elements | Covered enough by resizable panels + Reset Panels (UI1) |
| G32 | **Mobile app** for edits | Wix, Squarespace | Out of scope |

### 3.7 RapidWeaver Elements 3.0 update (2026-10-22)
Elements is Mac-only and the closest Tailwind-based desktop rival. Version 3.0 left beta on 15 Sep 2026. Its main additions:
- **AI:** an AI Assistant with your own OpenAI or Anthropic key that builds layouts, writes content, creates components, does SEO and CMS tasks and can publish. Also an **MCP server** for outside AI apps, and per-project "AI memory".
- **AI search:** Markdown copies of pages and an `llms.txt` file, on by default for new projects.
- **Design and content:** new design effects, and tables filled from CSV or Google Sheets.
- **Online CMS editor:** content editing in a browser.

Before 3.0 it already had Global Templates (reusable linked blocks) and a Resources manager for any file type.

| # | Gap | Who has it | Notes | Effort | Recommendation |
|---|---|---|---|---|---|
| G33 | **Connect AI apps (MCP server)**: outside AI apps (Claude, ChatGPT, others) read and edit the open site through Webforge's own commands | Elements 3.0 | Needs no API key or server of ours. It runs only on the user's computer and is off until the user turns it on; each app is paired with a code from Webforge. Every change goes through `HistoryManager`, so it is undoable and labelled. Lays the command layer that the v1.1 built-in assistant reuses | M | **MVP** (GA5) |
| G34 | **Shared sections** ("Global Templates"): a section saved once and placed on several pages; editing one updates all | Elements, Squarespace (saved sections), WordPress (synced patterns) | Builds on the shared Header/Footer (C5). Glossary term: *Shared section* | M | **MVP** (GA6). A library of saved sections across sites stays later |
| G35 | **Files in Media** (PDF, Word, Excel, PowerPoint, text, CSV) for download links | Elements (Resources manager), Wix, Squarespace | The link dialog already offers *File* (F-ED-18), but Media took only images, so a café's PDF menu had nowhere to live | S | **MVP** (GA7) |
| G36 | **AI-readable copies**: `llms.txt` plus a Markdown copy of each page, for AI search tools | Elements 3.0 (on by default for new projects) | Plain static files, no external requests, so it fits C8 | S | **MVP** (GA8) |
| G37 | **Draft pages** ("Don't publish"): a page kept in the site but left out of export and publish | Elements (Do Not Publish), Wix, Squarespace | For seasonal or work-in-progress pages | S | v1.1 (GA9) |
| G38 | **Tables from CSV / Google Sheets** | Elements 3.0 | A CSV imported at build time fits C8; a live Google Sheet doesn't | M | **Not adopted** (GA9) |
| G39 | **Online CMS editing** in a browser (multi-user) | Elements (Online CMS Editor, its own servers) | Needs a server (B2). Elements' own docs note one-way sync: republishing from the app can overwrite online edits | L | Out of scope (as T3/M5 remote editing; recommendation, not raised by the product owner) |
| G40 | **Design effects**: masks, 3D transforms, text wrapping around shapes, radial/conic gradients, coloured shadows | Elements 3.0 | Designer features rather than DIY small-business needs | M | Not planned (recommendation, not raised by the product owner) |

**Business notes for the post-MVP licensing questions (MVP §8):**
- **Pricing:** Elements is a yearly subscription (Plus/Pro) for up to 3 Macs per user. When the subscription ends, the app keeps working but updates stop.
- **Trial:** no publishing or export, and at most 3 pages per project.
- **Our differences:** Webforge's Windows support and one-off $99 licence.

## 4. Proposed changes

**Add to MVP (mostly small; about 4–6 weeks of extra work in total, plus about 19 days from the Elements 3.0 review):**
- **Editing basics:**
  - G1 copy & paste, G2 menu editor, G3 link to section
  - G5 spell check, G6 editable 404, G21 dynamic year
- **Visual features:**
  - G8 entrance/hover animations, G9 carousel, G10 lightbox
  - G11 typography and button styles in the theme
- **Media:** G14 focal point, G15 alt text on media, G27 icon picker.
- **Small-business tools:** G17 newsletter signup, G18 booking buttons.
- **Added after the Elements 3.0 review (2026-10-22):** G33 connect AI apps (MCP server), G34 shared sections, G35 files in Media, G36 `llms.txt` and Markdown copies.

**v1.1 (with Blog):**
- **Content tools:** G4 find & replace, G7 rename redirects, G20 legal page templates, G22 social preview, G26 stock photos.
- **Design options:** G12 site dark mode, G13 video hero, G19 announcement bar / popup.
- **AI (bring-your-own key):** a built-in assistant on the same commands as G33, starting with G25a rewrite text and G25b meta/alt text, then building and editing pages (GA9).
- **Publishing control:** G37 draft pages.

**Later / on demand:** G16 tables/timeline/countdown/charts, G24 password pages, G25c AI site generation, G28 marketplace/plugin API, a saved-section library shared across sites.

**Out of scope:** G23 cart/store, G29 cloud sync, G30 collaboration, G32 mobile app, G25d AI images, G39 online CMS editing. **Not adopted:** G38 CSV tables. **Not planned:** G40 design effects.

## 5. Decisions
| # | Topic | Decision |
|---|---|---|
| GA1 | **MVP additions** | ✅ **All §4 MVP items added to the MVP** (G1, G2, G3, G5, G6, G8, G9, G10, G11, G14, G15, G17, G18, G21, G27), about +4–6 weeks. The MVP spec is updated (F-ED-16…22, F-DS-4…5, F-CM-6…8) |
| GA2 | **AI** | ✅ **Users bring their own AI account in v1.1**: G25b (meta/social descriptions, alt text) and G25a (rewrite text). Opt-in, keys in the OS keychain, every AI edit undoable via `HistoryManager`. G25c later; G25d out of scope |
| GA3 | **Booking & newsletter presets** | ⏸ **Deferred.** The features stay in MVP with a generic "any https URL / form action" option. Which providers to preset is an open question (see below) |
| GA4 | **Marketplace / plugin API** | **Long-term goal, out of scope for MVP.** Keep `site-components` and the component registry designed so a plugin API is possible later |
| GA5 | **Connect AI apps (MCP)** (2026-10-22) | ✅ **MVP (G33).** Webforge runs a local MCP server so AI apps the user already has can read and edit the open site. Off by default; each AI app is paired with a code from Webforge and can be removed; every change is undoable and labelled (e.g. "AI (Claude): Added Hero"). It works only on the user's computer, with no publishing or credential tools. Spec F-AI-1. The built-in assistant follows in v1.1 (GA9) |
| GA6 | **Shared sections** (2026-10-22) | ✅ **MVP (G34)**, product owner priority. A section is saved once and placed on any page (more than once if needed); edits apply everywhere with the shared-section banner; *Detach* turns one copy back into a normal section. Spec F-ED-23. Brings C5's shared sections forward from post-MVP; a library of saved sections across sites stays later |
| GA7 | **Files in Media** (2026-10-22) | ✅ **MVP (G35).** PDF, Word, Excel, PowerPoint, OpenDocument, text and CSV files in Media, linked with the link dialog's *File* option and exported for download. Spec F-ED-24. Audio and video stay deferred |
| GA8 | **`llms.txt` and Markdown copies** (2026-10-22) | ✅ **MVP (G36)**, as a Site Settings option. Spec F-EX-5. Whether it is on by default for new sites is open question 3 |
| GA9 | **v1.1 additions** (2026-10-22) | ✅ **Built-in AI assistant** with the user's own key (amends GA2): it uses the same commands as F-AI-1, starting with G25a/G25b and growing to building and editing pages. **Draft pages** (G37). **CSV tables (G38) not adopted.** Per-site AI style notes (as Elements' "AI memory") are a suggestion for the v1.1 design, not decided |

v1.1 and later items stay as listed in §4.

## Open questions
1. **Booking and newsletter provider presets** (GA3): which providers to preset? Candidates: Calendly, Square Appointments, Fresha, Acuity, SimplyBook (booking); Mailchimp, Brevo, MailerLite (newsletter). Decide before Phase 3; the generic URL option covers everything meanwhile.
2. **MCP transport and tool scope** (GA5): a local Streamable HTTP endpoint with a per-app token, or a small bundled stdio bridge? The packaged app disables Electron's `RunAsNode` fuse, so the Electron binary can't double as a stdio server. Decide with an ADR in the MCP work item. Default tool scope: read the site, edit through history commands, run Site Check and preview; no publishing, no credentials, no file-system access.
3. **`llms.txt` default** (GA8): on by default for new sites (as Elements does) or off until the user turns it on? Proposed: on for new sites, off for existing ones. Decide before Phase 3.

## Sources
- RapidWeaver Elements 3.0: [out of beta (15 Sep 2026)](https://forums.realmacsoftware.com/t/big-news-elements-3-0-is-out-of-beta/57609) · [3.0 beta notes (13 Jul 2026)](https://forums.realmacsoftware.com/t/elements-3-0-beta-now-available/56986) · [The Road Ahead (Mar 2026)](https://forums.realmacsoftware.com/t/rapidweaver-elements-the-road-ahead/55124) · [Online CMS Editor](https://docs.realmacsoftware.com/elements-docs/cms/online-cms-editor)
- RapidWeaver Elements: [features](https://realmacsoftware.com/elements/) · [docs](https://docs.realmacsoftware.com/rapidweaver-elements-docs/)
- Blocs: [6.3 release (AI tools, find & replace, global alt tags)](https://alternativeto.net/news/2025/11/blocs-6-3-for-mac-adds-ai-tools-global-find-and-replace-new-interaction-manager-and-more) · [6.4 release (carousels, form security, paste, QR preview)](https://alternativeto.net/news/2026/3/blocs-6-4-for-mac-enhances-carousels-forms-copy-and-paste-link-icons-and-preview-mode) · [6.2 release](https://alternativeto.net/news/2025/6/blocs-6-2-for-mac-adds-stacked-containers-enhanced-preview-mode-and-ftp-manager-updates)
- Mobirise: [Toolradar overview](https://toolradar.com/tools/mobirise)
- Pinegrow: [Tailwind Visual Editor docs](https://docs.pinegrow.com/docs/tailwind/) · [Pinegrow 9.2 release notes](https://pinegrow.com/release_notes/pinegrow-web-editor-9-2/)
- Wix vs Squarespace (Apr 2026): [Website Builder Expert](https://www.websitebuilderexpert.com/website-builders/wix-vs-squarespace/)
- Webflow vs Framer (Jan 2026): [The Alien Design](https://www.thealien.design/insights/webflow-vs-framer)
- AI builder features: [TechRadar (Sept 2024)](https://techradar.com/pro/website-building/ai-website-building-tools-that-every-small-business-should-be-using)
- Bootstrap Studio: [../bootstrap-studio/04-key-features.md](../bootstrap-studio/04-key-features.md)
