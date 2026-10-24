# Pinegrow Web Editor: Competitor Review

**Status:** ✅ Decided 2026-10-24: all proposals adopted ([§7](#7-decisions))
**Date:** 2026-10-24
**Question:** What does Pinegrow 10.1 offer, how does its editor work, and which of it should Webforge copy, avoid or learn from?

Pinegrow is the developer-leaning desktop editor for real HTML, Bootstrap and Tailwind files, on Windows, macOS and Linux ([gap analysis §1](../product/05-feature-gap-analysis.md#1-competitors-reviewed)). It matters to Webforge as the other **desktop, Tailwind, files-on-disk** tool, and because its 2026 releases added the content-editing, publishing, checking and AI features Webforge plans. Its sibling is the [Webflow review](01-webflow.md).

## 1. Method
- **Official sources:** the Pinegrow home page, FAQ, subscription page, the release-notes index and the notes for 8.5, 8.6, 9, 9.2, 10 and 10.1; the docs for the overview, page views, keyboard shortcuts, the Tailwind Design panel, Tailwind updates, Interactions (including its licence and API) and the VS Code extension.
- **Community sources:** Pinegrow forum threads on the `data-pg-*` attributes and on GSAP after the Webflow acquisition.
- **Reviews:** Capterra and SelectHub, for ease-of-use complaints.
- **Not done:** the app was not installed or driven; no screenshots. Some docs pages (components, master pages) returned 404, so those details are from release notes only.
- **Baseline:** as in the [Webflow review](01-webflow.md#1-method).

**Confidence:** high for the model, platforms, versions and the 2025–2026 feature list, which come from official pages. Medium for pricing: the home page's pricing block was internally inconsistent on the day and a sale was running. Low for the exact set of attributes Pinegrow leaves in saved HTML.

**IP rule (unchanged from UI1):** we may copy interaction patterns, layout conventions and keyboard shortcuts. We never copy Pinegrow's code, CSS, icons, images, help text or wording.

## 2. The product
| Aspect | Pinegrow, October 2026 |
|---|---|
| **Positioning** | "Open any website or start fresh": a visual editor that reads and writes standard HTML and CSS, with no proprietary project format and no lock-in. Aimed at web professionals, Tailwind and Bootstrap developers, WordPress theme and block builders, and agencies that hand sites to clients in a content-only mode. Not pitched at DIY business owners |
| **Platform** | Desktop for Windows x64, macOS (Apple Silicon and Intel) and Linux (Ubuntu LTS). **Runtime: NW.js**, not Electron (official FAQ). Also **Pinegrow Online**, a browser version with projects in Pinegrow's cloud, two-way sync with the desktop app since v10, and publishing to GitHub, Netlify and Cloudflare Pages |
| **Versions** | 8.4 (Mar 2025, Tailwind 4) · 8.5 (May 2025) · 8.6 (Oct 2025) · **9** (Jan 2026) · 9.1 (Mar) · 9.2 (Apr) · 9.3 (Jun) · **10** (1 Oct 2026) · **10.1** (13 Oct 2026, current) |
| **Pricing** (regular prices; a 50 % sale ran on the day) | Web Editor PRO about $99/year, or one-time with a year of updates (renewals half price); PRO + WordPress about $149/year; company plans per user. Add-ons: **Interactions about $200/year, subscription only** because of its GSAP agreement; WordPress Builder $50/year; Shop Builder $50/year, subscription only. The Tailwind Visual Editor is free and bundled. 14-day full trial, one licence on three machines, Paddle as merchant of record. Keeping a subscription 12 months earns a perpetual licence for a six-month-old version |
| **Files** | Opens a folder as a project and adds `pinegrow.json`, `_pgbackup/` and `_pginfo/`. Design changes live in the HTML and CSS themselves. Some features add `data-pg-*` attributes (about 2 KB on average); most are stripped for the live site, `data-pg-name` stays. 10.1 can preserve the original formatting so small edits make small diffs |
| **Frameworks** | Bootstrap 5 (visual controls, theme customisation, a Blocks library), **Tailwind 4** (Class Inspector, Class Tree, Style Manager, Design panel, a built-in local JIT compiler writing `tailwind_theme/tailwind.css`, no CDN), Foundation, plain HTML and CSS with variables, live Sass and Less |
| **Interactions** | A GSAP-based add-on: a composer and timeline editor, scroll scenes, smooth scroll, apply-to-many. Definitions are JSON in a `data-pg-ia` attribute, run by a bundled `pgia.js`. Its licence allows use in sites and templates but **not inside website builders**. After Webflow bought GSAP and made it free (2025), Pinegrow said it still pays for its agreement, and GSAP's new terms exclude competing no-code tools |
| **WordPress** | Classic and block theme builder, custom Gutenberg blocks (Blocks v3 in 9.3), WooCommerce Shop Builder, standard PHP output |

**Licence caution for Webforge.** GSAP's post-acquisition terms exclude use in no-code website builders that compete with Webflow, and Pinegrow's own Interactions licence forbids the same. Webforge must not bundle GSAP or any library built on it. Our animations stay CSS presets with a small observer (F-DS-5, X1), which is also what works from disk.

## 3. The editor
### 3.1 Layout and workspaces
- Since v9 there are two workspaces. **Smart mode**: project-wide tools (Project files, Library, Tree) on the left, the selection's panels (Properties, Style, the framework panel, Class Inspector) on the right, page views in the middle. **Flexible mode**: the classic fully dockable layout where every panel but the Page View drags, collapses or detaches to another monitor.
- Dark UI by default, a denser design since v9, blue labels on fields that hold a value. (Whether a light UI theme exists is *unverified*.)
- **Multi-view**: one page opened in several editable views side by side (device presets, custom sizes, rotation), breakpoints read from the stylesheets, with the active view deciding which media-query rules the Style panel shows. 8.6 added forced light and dark views side by side.
- **Selection**: hover outlines, click to select, a small floating element menu; Tree panel; a Library with search and paste-your-own-code; Properties (attributes and framework controls); Style (selector input, active rules, a CSS Grid editor, framework rules hidden by default).
- **Code**: a built-in code editor that can sit to the right of the page (9.01); a VS Code extension with two-way sync of unsaved edits and selection highlighting; Live Preview in a real browser with a QR code for phones (v9).
- **Shortcuts of note:** Ctrl/Cmd+D duplicate, Delete, Ctrl/Cmd+click and Shift+click multi-select, P quick properties, R active CSS rules, Ctrl/Cmd+1 and +2 view sizes, Tab and Shift+Tab between text elements, Alt+Tab hides all panels.
- **Learning curve:** reviewers call it steep and say it assumes HTML and CSS knowledge (Capterra 4.4 overall, 4.1 for ease of use; SelectHub calls the interface unintuitive for newcomers).

### 3.2 The Tailwind Design panel
One screen that generates a theme: eight colours with ten shades each, editable, with **palette from an image**, swap, and a **"Surprise me"** button; Sans, Serif and Mono families from Google, Adobe or local fonts; a page background colour or image per breakpoint; compiler options (screens, spacing, theme values) in a dialog. It writes the Tailwind theme file through the local compiler. This is the closest existing thing to Webforge's Theme panel and Theme Studio (F-DS-2, F-DS-7).

### 3.3 Features added in 2025–2026
| Release | Feature | Webforge equivalent |
|---|---|---|
| 8.5, 8.6 | AI **Smart HTML Edit** with custom models; Smart Insert and Quick Insert; **accessibility presets**; a table builder; **Netlify delta uploads**; a VARS tab for CSS variables and Sass tokens; Tailwind 3 → 4 conversion | Incremental publish (4.1, 4.2); G16 tables later |
| 9 | Smart and Flexible workspaces; smarter components (master pages with editable areas, smart components, an Editing mode with *Done* to update instances, a Components panel suggesting next steps); Live Preview with QR | Shared sections (F-ED-23); phone preview (F-PV-1) |
| 9.1 | **Image resize and crop**; **project revisions and snapshots**; "Create with AI"; an AI Assistant workspace on the right; OpenRouter; AI personalisation | Image crop (F-ED-5); Version History (F-SITE-4); own-key assistant v1.1 (GA9) |
| 9.2 | **Inline text editing**; Project panel file moves; Tailwind compiler update; AI prompts in the context menu | Click-to-edit (F-ED-3) |
| 9.3 | AI image editing; reusable AI prompts; WordPress Blocks v3 | G25d out of scope |
| **10** | **Content Workspace**: content-only editing of text, images, links, metadata and repeating items through a searchable outline; **desktop ↔ Online sync**; **visual before/after change review** with restore; **publishing** to GitHub, Netlify, Cloudflare Pages and SFTP with a preflight check and delta uploads; AI change review and revert; a **local MCP server**; WebMCP in Online; AI CSS editing; local Whisper voice input; **spell check**; **Page Health** with axe-based WCAG 2.2 AA checks; SVG controls; **API keys moved to the OS credential store** | Content mode (F-ED-10); Version History preview (F-SITE-4); publishers (F-PB-1); connect AI apps (F-AI-1); spell check (F-ED-19); Site Check (F-CHK-1); keychain ([publishing](../stack/08-publishing.md)) |
| 10.1 | **Site map view, `sitemap.xml` and `robots.txt`**; a **title and description audit**; a virtualised Project panel; **three playground example sites**; formatting preservation; a **first-launch guide**; support-email drafting; a Gemini-only "simple AI setup" | Site files (3.5); Site Check SEO rules (3.6); onboarding (5.4) |

The AI assistant ("Mr. Pine Cone") takes the user's own API key or Pinegrow AI credits, and 10 reviews and reverts AI changes visually, the pattern Bootstrap Studio and Webflow also converged on (BS9-10, WF-2).

### 3.4 Output
Plain HTML, CSS and JS written in place; for a static site there is no separate export step. Pinegrow adds `data-pg-*` attributes (mostly stripped for the live site), `data-pg-ia` JSON plus `pgia.js` when Interactions are used, a locally compiled `tailwind_theme/tailwind.css` (no CDN), and optionally `sitemap.xml`. Images get a picker, resize and crop (9.1) and AI alt text; automatic WebP with a fallback was not found (*unverified*).

## 4. Where Webforge already stands
Pinegrow 10 added in one release much of what Webforge has planned since the start, which is a useful check that the plan aims at the right things.

| Pinegrow 10 / 10.1 | Webforge |
|---|---|
| Content Workspace (content-only editing via an outline) | **Content mode** (F-ED-10) on the same canvas, plus Simple/Advanced mode (F-ED-11) |
| Visual before/after change review with restore; revisions and snapshots | **Undo History** with labelled steps (F-ED-9) and **Version History** with read-only preview and one-step restore (F-SITE-4) |
| Publishing with preflight and delta uploads | **Publishers** with manifests, upload order and verification (F-PB-1, F-PB-2, 4.1); Site Check before publishing (F-CHK-1) |
| Page Health (axe, WCAG 2.2 AA), title and description audit, spell check | **Site Check** (F-CHK-1), **spell check** (F-ED-19) |
| Local MCP server | **Connect AI apps** over a local MCP server, paired per app, every change undoable (F-AI-1) |
| API keys in the OS credential store | Secrets in the OS keychain only (publishing note, B-decisions) |
| Tailwind compiled locally, no CDN | Tailwind v4 and daisyUI compiled in the pipeline, no external requests (X1, C8) |
| Design panel for the Tailwind theme | **Theme panel** and **Theme Studio** (F-DS-2, F-DS-4, F-DS-7) |
| Sitemap, robots, site map view | Site files (3.5); the Pages panel (F-ED-13) |
| Files on disk, diff-friendly | A single `.wforge` file, with the readable export (X4) and developer files (X6) as the diffable output |

## 5. Gaps and recommendations
Effort: **S** ≈ days · **M** ≈ 1–2 weeks · **L** ≈ several weeks.

### 5.1 Proposed for the MVP (small, fits existing items)
| # | Proposal | Why | Effort | Where |
|---|---|---|---|---|
| PG-2 | **Palette from an image** in the Theme panel: pick a photo or logo from Media and Webforge proposes brand colours from it (with the contrast check already planned for F-DS-2) | Owners have a logo, not a colour theory. Pinegrow's Design panel and Canva both offer it; a small k-means or median-cut pass on a downscaled bitmap runs locally | S | Theme panel (2.3) or Theme Studio (F-DS-7) |
| PG-3 | **Example sites on the start screen**: one or two complete sample sites (a café, a plumber) that open as a new site, so the first five minutes show a finished result to edit rather than a blank template | Pinegrow 10.1's playground sites and first-launch guide; Bootstrap Studio's templates play the same role. We have 8 templates (S2); this makes one of them pre-filled with sample content and surfaced as *Try an example* | S | Start screen (1.8, 2.14) |

### 5.2 Proposed for v1.1
| # | Proposal | Why | Effort | Where |
|---|---|---|---|---|
| PG-1 | **All devices side by side** on the canvas, with synced selection (the same proposal as WF-1) | Pinegrow's multi-view is its best-known editor feature and Webflow followed in 2026 | M | Canvas view options (1.33) in v1.1, after a spike |
| PG-4 | **Visual before/after when previewing a version** in Version History: show the current page and the version side by side, with changed sections marked | Pinegrow 10's change review; makes restore decisions safe for non-technical users | M | Version History (4.6) |
| PG-5 | **Light and dark side by side** once site dark mode exists (G12) | Pinegrow 8.6; cheap once PG-1 exists | S | With G12 and PG-1 |

### 5.3 Design lessons, no extra scope
| # | Lesson | Applies to |
|---|---|---|
| PG-6 | **Never bundle GSAP** or libraries built on it: its terms exclude competing no-code builders, and Pinegrow's Interactions licence forbids the same. GSAP's own licence is not on the allow-list, so `pnpm licence-check` already rejects it; record the reason in the licence rule so nobody files an exception for it | spec/03 (C1), `tools/src/check-licences.ts` |
| PG-7 | **A tool with two workspaces is a tool with two manuals.** Pinegrow's Smart and Flexible modes exist because its dockable layout overwhelmed newcomers. Webforge keeps one layout (UI1) with Simple and Advanced as the only switch |
| PG-8 | **Publishing needs a preflight.** Pinegrow 10 checks before uploading and uploads only changes; Webforge's Site Check *Must fix* gate and manifest-based incremental publish (4.1) are the same design and should stay coupled in the Publish flow UI (4.5) |
| PG-9 | **A content-only mode arrives in every builder eventually** (Pinegrow 10, Webflow Edit mode, Elements' CMS mode). Webforge's Content mode is in the MVP; keep it first-class rather than a locked-down variant of Design mode |

### 5.4 Not proposed
- **Editing real HTML files in place:** Pinegrow's core, and its learning curve. Webforge's model is a document plus a pipeline (X1); the readable export and developer files (X4, X6) give developers the files without making our users look after them.
- **A CSS inspector, Class Inspector, Sass:** the Advanced tab and class browser (2.18) are the limit for the MVP; per-element CSS stays *Later* (spec/02 §5).
- **GSAP timeline interactions:** licence, audience and from-disk constraints all say no.
- **A browser version with cloud sync:** needs a server (B2, G29).
- **WordPress export, WooCommerce:** a different product.
- **AI credits sold by us:** own-key (GA2) keeps costs and content with the user. A one-provider "simple AI setup" like Pinegrow 10.1's Gemini flow is worth remembering for the v1.1 assistant's first-run screen.

## 6. Design note: NW.js versus Electron
Pinegrow has shipped on NW.js for a decade, which shows a Chromium shell with full file access can carry a mature editor. It changes nothing for Webforge: Electron was chosen for its security model (`contextIsolation`, `sandbox`, a typed preload) and packaging tooling, and Pinegrow's needs (writing arbitrary files in a project folder) are the opposite of ours (one project file, nothing written outside it).

## 7. Decisions
Product owner, 2026-10-24: all proposals adopted as written.

| # | Decision |
|---|---|
| PG-2 | ✅ **MVP:** palette from an image in Theme Studio. Spec F-DS-7; plan item 2.3 (2.3b, +1 day) |
| PG-3 | ✅ **MVP:** example sites on the start screen (*Try an example*). Spec F-SITE-1; plan item 2.14 (+1 day) |
| PG-1, PG-4, PG-5 | ✅ **v1.1:** all devices side by side (with WF-1), before/after in Version History, light and dark side by side |
| PG-6 | ✅ **Engineering rule:** GSAP and libraries built on it are never an exception to the licence rule (C1); the reason is recorded in spec/03 |
| PG-7 – PG-9 | ✅ **Design lessons, no scope change:** one layout; preflight coupled to publishing; Content mode first-class |

## Sources
- Pinegrow: [home](https://pinegrow.com/) · [FAQ](https://pinegrow.com/faq/) · [subscriptions](https://pinegrow.com/subscribe) · [team plans](https://pinegrow.com/team-plans.html)
- Release notes: [index](https://pinegrow.com/release_notes/) · [8.5](https://pinegrow.com/release_notes/pinegrow-web-editor-8-5/) · [8.6](https://pinegrow.com/release_notes/pinegrow-web-editor-8-6/) · [9](https://pinegrow.com/release_notes/pinegrow-web-editor-9/) · [9.2](https://pinegrow.com/release_notes/pinegrow-web-editor-9-2/) · [10](https://pinegrow.com/release_notes/pinegrow-web-editor-10/) · [10.1](https://pinegrow.com/release_notes/pinegrow-web-editor-10-1/)
- Docs: [overview](https://pinegrow.com/docs/getting-started/discovering-pinegrow-web-editor-the-overview/) · [page views](https://pinegrow.com/docs/master-pinegrow/page-views/) · [keyboard shortcuts](https://pinegrow.com/docs/master-pinegrow/keyboard-shortcuts/) · [Tailwind Design panel](https://pinegrow.com/docs/tailwind/tailwind-css-design-panel/) · [Tailwind updates](https://pinegrow.com/docs/tailwind/updates/) · [VS Code extension](https://pinegrow.com/docs/master-pinegrow/using-external-code-editors/visual-studio-code/)
- Interactions: [docs](https://pinegrow.com/docs/interactions/) · [licence](https://pinegrow.com/docs/interactions/license/) · [API](https://pinegrow.com/docs/interactions/api/) · [forum: GSAP acquired by Webflow](https://forum.pinegrow.com/t/gsap-has-been-acquired-by-webflow/9906) · [Webflow: GSAP becomes free](https://webflow.com/updates/gsap-becomes-free)
- Files: [forum: `data-pg-id` in the output](https://forum.pinegrow.com/t/data-pg-id-why-is-it-in-the-end-html-file/2981) · [forum: extra files in a project](https://forum.pinegrow.com/t/does-pinegrow-pro-add-extra-files-when-opening-a-html-folder-as-project/8238)
- Reviews: [Capterra](https://www.capterra.com/p/201850/Pinegrow/reviews) · [SelectHub](https://www.selecthub.com/p/web-design-software/pinegrow/)
