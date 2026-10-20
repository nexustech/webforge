# Competitor Feature Gap Analysis

**Status:** Research + recommendations, 2026-10-20. Awaiting decisions (see [§5](#5-decisions-needed))
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

## 4. Proposed changes

**Add to MVP (mostly small; about 4–6 weeks of extra work in total):**
- **Editing basics:**
  - G1 copy & paste, G2 menu editor, G3 link to section
  - G5 spell check, G6 editable 404, G21 dynamic year
- **Visual features:**
  - G8 entrance/hover animations, G9 carousel, G10 lightbox
  - G11 typography and button styles in the theme
- **Media:** G14 focal point, G15 alt text on media, G27 icon picker.
- **Small-business tools:** G17 newsletter signup, G18 booking buttons.

**v1.1 (with Blog):**
- **Content tools:** G4 find & replace, G7 rename redirects, G20 legal page templates, G22 social preview, G26 stock photos.
- **Design options:** G12 site dark mode, G13 video hero, G19 announcement bar / popup.
- **AI (bring-your-own key):** G25a rewrite text, G25b meta/alt text.

**Later / on demand:** G16 tables/timeline/countdown/charts, G24 password pages, G25c AI site generation, G28 marketplace/plugin API.

**Out of scope:** G23 cart/store, G29 cloud sync, G30 collaboration, G32 mobile app, G25d AI images.

## 5. Decisions needed
1. **MVP additions:** accept the list in §4 (adds roughly 4–6 weeks), or trim it?
2. **AI:** bring-your-own-key in v1.1 (recommended), Webforge-hosted AI later, or no AI?
3. **Booking and newsletter presets:** which providers to preset (suggested: Calendly, Square Appointments, Fresha, Acuity; Mailchimp, Brevo, MailerLite)?
4. **Marketplace / plugin API:** keep as a long-term goal (design for it), or explicitly out of scope?

## Sources
- RapidWeaver Elements: [features](https://realmacsoftware.com/elements/) · [docs](https://docs.realmacsoftware.com/rapidweaver-elements-docs/)
- Blocs: [6.3 release (AI tools, find & replace, global alt tags)](https://alternativeto.net/news/2025/11/blocs-6-3-for-mac-adds-ai-tools-global-find-and-replace-new-interaction-manager-and-more) · [6.4 release (carousels, form security, paste, QR preview)](https://alternativeto.net/news/2026/3/blocs-6-4-for-mac-enhances-carousels-forms-copy-and-paste-link-icons-and-preview-mode) · [6.2 release](https://alternativeto.net/news/2025/6/blocs-6-2-for-mac-adds-stacked-containers-enhanced-preview-mode-and-ftp-manager-updates)
- Mobirise: [Toolradar overview](https://toolradar.com/tools/mobirise)
- Pinegrow: [Tailwind Visual Editor docs](https://docs.pinegrow.com/docs/tailwind/) · [Pinegrow 9.2 release notes](https://pinegrow.com/release_notes/pinegrow-web-editor-9-2/)
- Wix vs Squarespace (Apr 2026): [Website Builder Expert](https://www.websitebuilderexpert.com/website-builders/wix-vs-squarespace/)
- Webflow vs Framer (Jan 2026): [The Alien Design](https://www.thealien.design/insights/webflow-vs-framer)
- AI builder features: [TechRadar (Sept 2024)](https://techradar.com/pro/website-building/ai-website-building-tools-that-every-small-business-should-be-using)
- Bootstrap Studio: [../bootstrap-studio/04-key-features.md](../bootstrap-studio/04-key-features.md)
