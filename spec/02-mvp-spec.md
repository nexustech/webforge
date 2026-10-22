# Webforge MVP Specification

**Version:** 1.0 draft, 2026-10-19
**Architecture:** [01-architecture.md](01-architecture.md) · **Engineering standards:** [03-engineering-standards.md](03-engineering-standards.md)
**Legend:** **[Proposed]** = not yet confirmed by product owner · 🔬 = confirm in spike

## 1. Product goal
A DIY small-business owner with no web experience can, **in one afternoon**:
1. pick a template,
2. change text, images and brand colours,
3. add pages and sections,
4. check the site on desktop and phone,
5. and **publish** it to Netlify or their existing host, **without touching code**.

The result is a fast, accessible, self-contained static website they fully own.

### Primary persona
**Sam, owns a small café/salon/trades business.**
- Comfortable with Canva, Word and maybe Wix.
- Wants a professional site, hates monthly builder fees, and needs to update opening hours and prices themselves.
- Doesn't know what HTML or hosting really are.

### Platforms
- **Windows 10/11 x64** and **macOS 13 Ventura or later on Apple Silicon (arm64)**. Linux is not supported in MVP.
  - **No Intel Mac build at launch.** Apple has confirmed macOS 26 Tahoe is the last major release for Intel Macs, and Electron 44 needs macOS 13+.
  - A **universal** (Apple Silicon + Intel) build stays possible as a fallback: one electron-builder setting, with better-sqlite3 merged into a universal binary. It would roughly double the macOS download, so add it only if beta users need it.
- Installer with auto-update: Windows NSIS per-user (no admin), macOS signed + notarised DMG. `.wforge` file association.

## 2. MVP feature list

### 2.1 Sites & files
| ID | Feature | Acceptance criteria |
|---|---|---|
| F-SITE-1 | **New Site from Template** | Start screen shows templates with thumbnails; choosing one asks for site name and theme; opens the editor in < 3 s |
| F-SITE-2 | **Open / Recent Sites** | Double-clicking a `.wforge` file opens it (single instance). The recent list shows a thumbnail and last edited time |
| F-SITE-3 | **Periodic autosave** (P2) | Saves ~2 s after edits pause, at least every 30 s, on blur/close. Title bar shows "Saved"/"Saving…". Killing the app loses at most the last few seconds; the file is never corrupt |
| F-SITE-4 | **Version History** (06, P3) | *Save version…* (Ctrl/Cmd+Alt+S) with a name. Automatic versions daily, before restore, before site-wide actions and on publish; last 20 kept (configurable). Preview a version read-only; **Restore** is one undo step; **Open version as new site** (P5) |
| F-SITE-5 | **Export as .zip** (project) | Exports JSON + media for backup/interchange; re-importing is lossless |
| F-SITE-6 | **Backups** | Rolling backups of the `.wforge` file in a backups folder (last N) |
| F-SITE-7 | **Local crash reports** | On a crash or unhandled error, Webforge writes a report to the local crash-reports folder with a **timestamped filename**. **Nothing is uploaded automatically.** On the next launch: *"Webforge closed unexpectedly. Your work was saved."* with *Open crash reports folder*. Help menu: *Open crash reports folder*. Reports contain no site content, credentials or personal data. Future: in-app review and optional user-initiated sharing |

### 2.2 Editing
| ID | Feature | Acceptance criteria |
|---|---|---|
| F-ED-1 | **Add panel** (Sections / Elements) | Drag or click to insert. Drop indicators show valid targets. Sections only between sections; elements only inside sections/columns |
| F-ED-2 | **Select, move, duplicate, delete** | Click to select on canvas or in Layers. Drag to reorder. Keyboard: arrows to move selection, Ctrl/Cmd+D duplicate, Delete removes **without confirmation** with an *Undo* toast (D4) |
| F-ED-3 | **Click-to-edit text** | Double-click text to edit inline (bold, italic, link, lists, alignment). One editing session = **one undo step** "Edited ‹name› text" (D1) |
| F-ED-4 | **Edit panel**: Content · Style (· Advanced) | Shows friendly controls for the selected item. Style controls are design tokens (Padding S/M/L, Colour from theme…), each optionally per Desktop/Tablet/Mobile |
| F-ED-5 | **Images** | Upload/drag from disk into Media, replace and crop (aspect presets), alt text field with a hint. **Alt text is stored on the image in Media** and reused wherever it's placed, with a per-use override (G15). Originals kept unmodified. **Deleting an image that pages still use warns first** ("It's used on 2 pages"), then deletes it as one undoable step: those places show a placeholder in the editor and are left out of the export, with a warning, rather than breaking it (product owner decision, 2026-10-21) |
| F-ED-6 | **Repeating lists** (M1) | Testimonials, team, services, FAQ, opening hours, prices: add/reorder/remove items in the Edit panel and on canvas |
| F-ED-7 | **Header & Footer** (C5) | Shared on every page; editing shows the banner *"Editing shared Footer: changes apply to all N pages"*. Page setting *Hide header/footer on this page* |
| F-ED-8 | **Desktop · Tablet · Mobile** views | Switch instantly; canvas width changes; per-device overrides are visibly marked |
| F-ED-9 | **Undo / Redo + Undo History panel** (03, Simple mode) | Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z/Ctrl+Y everywhere. Panel lists labelled steps; click to jump. Undo restores selection, page and view. Drags and slider scrubs are single steps |
| F-ED-10 | **Content mode** (M3) | Toolbar toggle **Design / Content**. Content mode locks layout and styles; text, images, links and list items stay editable |
| F-ED-11 | **Simple / Advanced mode** (T2) | Advanced adds Layers, the Advanced tab (CSS classes, attributes, anchor ID) and Custom Code. Per-user preference |
| F-ED-12 | **Layers** (Advanced) | Tree of sections/elements with drag-to-reorder, hide, rename label |
| F-ED-13 | **Pages panel** | Add, rename, duplicate, reorder (= navigation order), set Home, *Hide from navigation*, folders. **Delete page asks for confirmation** and is undoable (D5/D7) |
| F-ED-14 | **Confirmation rule** (D7) | Any action affecting more than the current page (theme switch, delete page, delete shared section, global font/colour change) confirms with its impact ("affects 6 pages") and is undoable |
| F-ED-15 | **Custom Code** (C7, Advanced) | Custom HTML element; site `custom.css`/`custom.js`; head/body snippets. Scripts off in the editor by default |
| F-ED-16 | **Copy & paste** (G1) | Copy/cut/paste sections and elements within a page, between pages and into another site (Ctrl/Cmd+C/X/V). One site is open at a time (F-SITE-2), so the clipboard keeps the copied items **with their images**: after opening another site, paste adds those images to its Media. Pasting an image file or clipboard image adds it to Media and inserts it. Pasting a YouTube/Vimeo URL creates a video embed. Each paste is one undo step |
| F-ED-17 | **Navigation menu editor** (G2) | Menu built from pages by default; users can add **external links**, **links to a section**, **"Book now"-style buttons** and **dropdown sub-menus**, reorder freely and hide items. Used by the Header's navbar (desktop + mobile menu) |
| F-ED-18 | **Link to a section** (G3) | The link dialog offers *Page*, *Section on a page* (anchor picked from a list; IDs created automatically), *Email*, *Phone*, *External URL*, *File* |
| F-ED-19 | **Spell check** (G5) | Electron spellchecker active while editing text; right-click suggestions; add to dictionary. **Windows:** checks in the site language from Site Settings. **macOS:** uses the system spell checker and its languages (Electron cannot set them there) |
| F-ED-20 | **Editable 404 page** (G6) | A special *Page not found* page in the Pages panel (not in navigation), designed like any page, exported as `404.html`. Hosts serve it at **any** missing URL, including nested ones (`/services/missing`), so unlike other pages (X1) its links and asset URLs are absolute: based on the site's web address (X3), or `/`-rooted when none is set |
| F-ED-21 | **Image focal point** (G14) | Set a focal point on any image; crops for Desktop/Tablet/Mobile keep it in view (`object-position`) |
| F-ED-22 | **Icon picker** (G27) | Searchable Lucide icon picker (ISC) used by Icon, Button and List elements; icons inlined as SVG at export |
| F-ED-23 | **Shared sections** (G34, GA6) | *Save as shared section* on any section (not Header/Footer) gives it a name; the Add panel lists shared sections and places linked copies on any page.<br>Editing a copy shows the banner *"Editing shared section ‹name›: changes apply to all N pages"*, and the change applies everywhere as one undo step.<br>*Detach* turns one copy into a normal section (one undo step).<br>Deleting a shared section confirms with its impact (D7), turns its copies into normal sections so no content is lost, and is undoable.<br>No shared section inside another. Pasting a copy into another site creates a normal section. Exported inline on each page |
| F-ED-24 | **Documents in Media** (G35, GA7) | Media also takes **PDF, Word, Excel, PowerPoint, OpenDocument, plain text and CSV** files, shown with a file-type icon, name and size; checked by extension and content type, and never opened or run in the editor.<br>The link dialog's *File* option picks from them; links open in a new tab by default, with an optional *Download* setting.<br>Exported unchanged to `files/` under a cleaned-up file name; only documents that pages link to are exported.<br>Deleting a linked document warns first, as for images (F-ED-5). Site Check tip for files over 10 MB |

### 2.3 Design
| ID | Feature | Acceptance criteria |
|---|---|---|
| F-DS-1 | **Theme picker** (05, S3) | **10–12 curated themes** (light + dark), visibly distinct (no "house look"). Changing theme confirms (D7), restyles everything instantly, and is undoable |
| F-DS-2 | **Brand colours, fonts, roundness** | Primary/secondary/accent colours; **~50 bundled font families with 12–15 tested pairings** (Fontsource, offline) plus **Browse all fonts** (on-demand Fontsource catalogue, cached locally; S4); corner style; spacing scale. Contrast warnings below WCAG AA |
| F-DS-3 | **Section themes** | A section can use the light/dark variant of the theme (daisyUI nested themes) |
| F-DS-4 | **Text and button styles** (G11) | Theme defines a type scale (H1–H6, body, small) and button styles (shape, size, filled/outline/ghost), editable in the Theme panel and applied site-wide (D7 confirm) |
| F-DS-5 | **Animations** (G8) | Per section/element *Entrance animation* (None, Fade, Slide up/left/right, Zoom) with delay; *Hover effect* for buttons/cards (Lift, Grow, Shadow). CSS + a tiny observer in `webforge.js`; disabled automatically for visitors with *prefers-reduced-motion*; works from disk. **Content is visible by default:** elements are only hidden for their entrance once `webforge.js` has marked the page, so nothing stays invisible without JavaScript, in print or for search engines |

### 2.4 Site settings & checks
| ID | Feature | Acceptance criteria |
|---|---|---|
| F-SET-1 | **Site Settings** (X3) | General, Web address, Social & sharing, Contact details & opening hours, Search engines, Analytics (GA4 ID, B4), Form defaults. Bound values update all elements; saving is one undo step |
| F-SET-2 | **Page Settings** | Title, description, share image, slug, hide header/footer, hide from navigation |
| F-CHK-1 | **Site Check** panel (X5) | Live, background checks grouped **Must fix · Should fix · Tips**; click to jump; Fix buttons; Ignore per item. Export blocks only on *Must fix*; Publish also blocks on broken links, missing web address, placeholder text, unconfigured forms, missing titles |

### 2.5 Preview, export, publish
| ID | Feature | Acceptance criteria |
|---|---|---|
| F-PV-1 | **Preview** | Opens the site in the default browser via the built-in preview server with live reload (CSS hot-swap < 100 ms). **Preview on phone**: QR code for a device on the same Wi-Fi |
| F-EX-1 | **Export** (07) | Writes a folder or ZIP per the exported-site contract ([01 §8](01-architecture.md#8-exported-site-contract)). Opens from disk in Chrome, Edge, Firefox and Safari with fonts/scripts working; no external requests except allowed ones. Export report shown |
| F-EX-2 | **Image output** (X2) | WebP + JPEG fallback (PNG if transparent) at responsive widths, `width`/`height`, lazy loading; JPEG share image; favicon set |
| F-EX-3 | **Readable output** (X4) | Indented HTML, readable CSS/JS; optional *Minify output* |
| F-EX-4 | **Include developer files** (X6) | Optional: Tailwind source + theme tokens + `site.json` + README |
| F-EX-5 | **AI-readable copies** (G36, GA8) | Site Settings → Search engines: *Help AI tools read your site*, on by default for new sites.<br>Export adds `llms.txt` (site name, description and a list of pages) and a Markdown copy of each page beside it (`about.md`): headings, text, lists, links and image alt text.<br>The 404 page and hidden elements are left out. Links are absolute when the web address is set, otherwise relative. No scripts and no external requests |
| F-PB-1 | **Publish destinations** (08) | Add Netlify (OAuth sign-in, create/pick site), FTP/FTPS/SFTP (presets, Test connection tries FTPS first; plain FTP allowed with warning, B5). Several destinations per site. Secrets in the OS keychain |
| F-PB-2 | **Publish** | Build (strict checks) → upload changed files only → assets before pages → verify → "Your site is live" with link. Cancel keeps the old site as intact as possible. Creates an automatic version "Published ‹date›" |
| F-PB-3 | **Republish a version** | From Version History, publish an older version (rollback on any host) |

### 2.6 Content features
| ID | Feature | Acceptance criteria |
|---|---|---|
| F-CM-1 | **Contact form** (B3/B6) | "Send submissions to": Netlify Forms (if a Netlify destination exists), Formspree, Web3Forms, FormSubmit, Custom endpoint. Plain HTML POST, honeypot + timing spam check, Thank-you page redirect |
| F-CM-2 | **Buy button** (M1) | Label, price text, image, payment link (Stripe Payment Link / PayPal / any https URL). Plain link |
| F-CM-3 | **Analytics + consent** (B4/B7) | GA4 ID in Site Settings; built-in consent banner (on by default with GA); Consent Mode v2 default denied; GA off in preview and when opened from disk |
| F-CM-4 | **Embeds** | YouTube, Vimeo, Google Maps/OpenStreetMap as dedicated elements with privacy mode and click-to-load placeholders (C8, B7) |
| F-CM-5 | **Social links** | Social icons element bound to Site Settings → Social (Lucide/brand SVG icons inlined) |
| F-CM-6 | **Newsletter signup** (G17) | Newsletter section: email (+ optional name) form that POSTs to the provider's embedded-form URL, plus our honeypot. Generic "form action URL" option in MVP; provider presets per GA3 (open question) |
| F-CM-7 | **Booking button** (G18) | "Book now" button/element linking to the user's booking page; generic https URL in MVP; provider presets per GA3 (open question). Plain link, no external JS |
| F-CM-8 | **Dynamic year** (G21) | `{year}` token for text (e.g. footer copyright) filled in at export, with no script. The year is fixed until the site is next exported or published, so Site Check shows a tip when a published site's year is out of date |

### 2.7 AI
| ID | Feature | Acceptance criteria |
|---|---|---|
| F-AI-1 | **Connect AI apps** (MCP, G33, GA5) | Preferences → *AI apps*: off by default. When on, Webforge runs an MCP server **reachable only from this computer**, while a site is open.<br>Each AI app (for example Claude or ChatGPT desktop) is approved in Webforge the first time it connects (*"Claude wants to read and edit ‹site›"*) and can be removed at any time. The approval explains that site content is shared with that app.<br>Tools: read pages, sections, Site Settings and theme; add, edit, move and remove sections and elements from the catalogue; edit text and fields; add pages; change theme tokens; run Site Check; open Preview.<br>Every change goes through `HistoryManager` as one undo step labelled with the app's name ("AI (Claude): Added Hero"), and site-wide changes follow D7. Content mode limits AI apps to content edits.<br>No tools for publishing, credentials, files outside the site, or Custom Code. Webforge needs no API key and sends nothing anywhere itself |

## 3. MVP component catalogue (decided S1–S5, [starting content](../research/product/03-starting-content.md))

**Sections (19):**
1. Header (navbar with mobile menu)
2. Footer
3. Hero (4 layouts)
4. Text
5. Text + Image
6. Features / Services grid
7. Gallery (with **lightbox**: click to enlarge, keyboard + swipe navigation, G10)
8. Testimonials (list)
9. Team (list)
10. Pricing / Price list
11. FAQ (accordion)
12. Opening hours & contact details
13. Contact form
14. Call to action
15. Logos / "As seen in"
16. Stats / Numbers
17. Map
18. Video
19. **Newsletter signup** (F-CM-6)

**Elements (17):**
1. Heading
2. Text
3. Image
4. Button
5. Buy button
6. Columns
7. Spacer
8. Divider
9. Icon
10. List
11. Social links
12. Embed video
13. Embed map
14. Form fields (text, email, phone, message, checkbox, select)
15. Tabs
16. **Carousel** (images, testimonials, logos; autoplay pause, keyboard and swipe, accessible controls; G9)
17. Custom Code (Advanced)

**Templates (8, S2):**
1. Café / Restaurant
2. Salon / Beauty
3. Trades / Home services
4. Consultant / Professional
5. Photographer / Portfolio
6. Shop (Buy buttons)
7. Personal / CV
8. Blank

**Template images (S5):** public-domain (CC0) and free stock photos, with source and licence recorded per image in a manifest; licence review deferred.

All components must:
- render to static HTML with daisyUI/Tailwind classes;
- meet WCAG 2.1 AA (keyboard, focus, ARIA for Tabs/Accordion/Menu via `webforge.js`);
- work from disk (X1);
- expose only design-token style fields;
- have a friendly display name for undo labels (D2).

## 4. Non-functional requirements
| Area | Requirement |
|---|---|
| Performance | Targets in [01 §10](01-architecture.md#10-performance-targets) |
| Reliability | No data loss on crash/power cut (SQLite transactions); undo-all returns exactly to the starting state (property-tested) |
| Accessibility | Editor fully keyboard-operable for core flows; exported sites WCAG 2.1 AA by default (axe checks in CI) |
| Privacy | No telemetry; crash reports stay on the user's computer (F-SITE-7); exported sites make no external requests by default |
| Security | Electron hardening per [01 §3](01-architecture.md#3-process-model); secrets in OS keychain; signed builds |
| Licensing | Permissive dependencies only (C1); in-app "Open-source licences" screen; licence check in CI |
| Localisation | English UI for MVP; all strings externalised in `packages/i18n` using glossary terms ([terminology](../research/product/01-terminology.md)) |
| Offline | Everything except publishing, updates and "Download and bundle" works offline |

## 5. Explicitly out of MVP
| Item | When |
|---|---|
| Blog collection (posts, tags, RSS, latest posts, Markdown/CSV import) | **v1.1** (M2) |
| Portfolio/Gallery, Team, Events collections | v1.2+ (M2) |
| Site search, multilingual | v1.2+ (M4) |
| A library of saved sections shared across sites (shared sections within a site are MVP, F-ED-23) | v1.x (C5, GA6) |
| Cloudflare, GitHub Pages, S3 publishing; custom-domain automation | Later (08) |
| Webforge Hosting / form relay | Deferred business decision (B2) |
| AVIF, clean URLs, Export as Astro project | Later / on demand (X2, X1, X6) |
| Importing existing websites | Out of scope (C3) |
| Free positioning, real-time collaboration, remote client editing, members, carts | Out of scope (T3, M5) |
| Find & replace, page-rename redirects, legal page templates, social share preview, stock photo search (Pexels/Pixabay), site dark mode, video-background hero, announcement bar / popup | **v1.1** (gap analysis G4, G7, G12, G13, G19, G20, G22, G26) |
| **Built-in AI assistant with the user's own account** (rewrite text; meta/social descriptions; alt text; then building and editing pages through the same commands as F-AI-1, with per-site style notes) | **v1.1** (GA2, GA9) |
| **Draft pages** (kept in the site, left out of export and publish) | **v1.1** (G37, GA9) |
| Online CMS editing in a browser | Out of scope (G39) |
| AI site generation from a description | Later (G25c) |
| Tables, timeline, countdown, charts; password-protected pages | Later / on demand (G16, G24) |
| Component/theme marketplace and plugin API | Long-term goal (GA4) |
| AI image generation, cloud sync, collaboration, mobile app | Out of scope (G25d, G29, G30, G32) |
| Linux | Not planned |

## 6. Milestones
The detailed work breakdown (one GitHub issue per item), schedule, risks and open questions are in the [implementation plan](04-implementation-plan.md).

| Phase | Milestone | Content | Exit criteria |
|---|---|---|---|
| **Phase 0** | **Prototype spikes** (~2 weeks, combined) | Electron secure shell + electron-builder installers (signed NSIS/DMG) + auto-update; Puck with **our** history (critical); daisyUI components; `.wforge` SQLite via **better-sqlite3** (packaging + rebuild on Windows/macOS, crash safety, OneDrive folder); export pipeline + `file://` checks; Netlify + SFTP publish | Every 🔬 item resolved; go/no-go on Puck (else fallback canvas) |
| **Phase 1** | **Editor core** | Model, history, storage + autosave, engine adapter, Add/Edit/Pages panels, Header/Footer, Undo History, views, Simple/Advanced and Design/Content modes, Site Settings and Page Settings, editable 404 page, media library with alt text and focal point, **copy & paste, menu editor, link dialog, spell check, shared sections, documents in Media** | Build a 3-page site from blank; undo-all property tests green |
| **Phase 2** | **Design & components** | Themes (incl. **text/button styles**), brand colours/fonts, component catalogue (incl. **carousel, lightbox, animations, newsletter, booking**, Buy button, embeds), templates, **icon picker** | All templates pass axe + visual regression |
| **Phase 3** | **Output** | Preview server, Export, Site Check, forms, GA + consent, custom code bundling, **404 output, dynamic year, `llms.txt` and Markdown copies** | Exported templates open from disk in 4 browsers with zero external requests |
| **Phase 4** | **Publish & versions** | Destinations, Netlify/FTP/SFTP publish, Version History, republish, **connect AI apps (MCP)** | Publish + rollback on all targets in E2E tests |
| **Phase 5** | **Beta hardening** | Performance budgets, installer/updates, licences screen, onboarding, help | Beta with 10–20 small-business users |

## 7. Open items to confirm
1. ~~Starting content~~ → ✅ **Decided (S1–S5):** standard catalogue, 8 templates, 10–12 themes, ~50 fonts + on-demand; CC0/free stock images (licence review deferred).
2. ~~macOS targets~~ → ✅ **Decided:** Apple Silicon (arm64) only, macOS 13+; universal build as a fallback if beta demand appears.
3. ~~Packaging toolchain~~ → ✅ **Decided: electron-builder** + electron-updater (mature since 2015, actively released, MIT, used by Bootstrap Studio). Phase 0 only verifies signing, installers and auto-update with it.
4. ~~SQLite driver~~ → ✅ **Decided: `better-sqlite3`** (MIT, mature, synchronous API, prebuilt binaries; rebuilt for Electron via `@electron/rebuild` in CI).
5. Default to Content mode for already-published sites (suggested in product/02).
6. ~~Telemetry/crash reporting~~ → **Decided:** crash reports collected **locally only**, never uploaded (F-SITE-7).
7. ~~Licensing model~~ → ✅ **Decided:** see §8 (implemented after MVP).
8. **Booking and newsletter provider presets** (GA3, deferred): which providers to preset (e.g. Calendly, Square Appointments, Fresha, Acuity, SimplyBook; Mailchimp, Brevo, MailerLite)? Decide before Phase 3. A generic URL works meanwhile.
9. ~~Competitor gap analysis~~ → ✅ **Decided (GA1–GA4):** see [gap analysis](../research/product/05-feature-gap-analysis.md). MVP grows by ~4–6 weeks.
10. ~~RapidWeaver Elements 3.0 review~~ → ✅ **Decided (GA5–GA9, 2026-10-22):** connect AI apps (MCP), shared sections, documents in Media and `llms.txt` join the MVP (about +17 days). The built-in AI assistant and draft pages are v1.1.
11. **MCP transport** (F-AI-1): a local HTTP endpoint with a per-app token, or a small bundled bridge program? Decided by an ADR in the MCP work item ([gap analysis, open question 2](../research/product/05-feature-gap-analysis.md#open-questions)).

## 8. Business & licensing model (decided 2026-10-19)
| Item | Decision |
|---|---|
| Price | **Single paid licence: US $99, unlimited use** (no subscription, no tiers, unlimited sites) |
| Trial | **7-day free trial** |
| Licence mechanism | **After MVP.** A simple **generated licence key**, **validated server-side** against the buyer's **registered email address** |
| MVP | No licence enforcement in the MVP/beta builds. Beta testers use the full app |

**Design notes for the post-MVP licensing work**
- **Works offline:** validate on activation, then re-check occasionally with a generous offline grace period (e.g. 30 days), so a desktop app used offline never locks users out unexpectedly.
- **Privacy:** the server only needs the email, key and an anonymous device ID. No site content is ever sent.
- **Payment provider:** a "merchant of record" service (e.g. Paddle, Lemon Squeezy, or Stripe with tax handling) handles sales tax/VAT, receipts and refunds. Choose when licensing is built.
- **Code structure:** keep licence checks in one small `licensing` module behind an interface, so the MVP ships without it and it can be added cleanly later.

**Open questions (for post-MVP):**
1. Does "unlimited use" include **all future updates**, or updates for a period (e.g. 12 months, then optional renewal)?
2. Any limit on the number of **computers** per licence?
3. What happens when the trial ends: read-only (can open and view, can't export/publish), or fully locked?

