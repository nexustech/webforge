# Webflow: Competitor Review

**Status:** ✅ Decided 2026-10-24: all proposals adopted ([§7](#7-decisions))
**Date:** 2026-10-24
**Question:** What does Webflow offer in October 2026, how does its editor work, and which of it should Webforge copy, avoid or learn from?

Webflow is the designer-focused hosted builder that sets expectations for interactions, CMS and AI ([gap analysis §1](../product/05-feature-gap-analysis.md#1-competitors-reviewed)). This note looks at it in its own right. Its sibling is the [Pinegrow review](02-pinegrow.md).

## 1. Method
- **Official sources, read indirectly.** Webflow's own sites (`webflow.com`, `help.webflow.com`, `university.webflow.com`) refused automated fetches on the day, so the official pages were read through search-result summaries and a third-party mirror of the `webflow.com/updates` release feed.
- **Third-party sources:** agency and template-shop write-ups of the May 2026 pricing change, the code-export limits, Webflow Conf 2025 and 2026, and review aggregators (G2) for the complaints that recur.
- **Not done:** no Webflow account was created and the Designer was not driven. Panel details come from docs and lessons, some of which show an older UI.
- **Baseline:** the [MVP spec](../../spec/02-mvp-spec.md), the [gap analysis](../product/05-feature-gap-analysis.md) (GA1–GA9), the [Bootstrap Studio 9.0 review](../bootstrap-studio/06-bootstrap-studio-9.md) (BS9-1…10) and the [editor parity note](../product/06-editor-ui-ux-parity.md) (UI2–UI5).

**Confidence:** high for the product direction, the sunsets and the export limits, where several sources agree. Medium for prices, which come from third parties quoting the May 2026 help article. Low for exact panel composition in the current Designer, marked *unverified* below.

**IP rule (unchanged from UI1):** we may copy interaction patterns, layout conventions and keyboard shortcuts. We never copy Webflow's code, CSS, icons, images, help text or wording.

## 2. The product
| Aspect | Webflow, October 2026 |
|---|---|
| **Positioning** | A "visual development platform" for marketing teams, designers and agencies: designer-level control over HTML and CSS plus a hosted CMS. Since 2025 pitched as an AI-first platform (AI site builder, AI Assistant, an MCP server, "Source" and "Campaigns" previews). Not aimed at DIY small-business owners |
| **Platform** | Hosted SaaS. The Designer runs only in a desktop browser at 1268 px or wider, always online. Content lives on Webflow's servers |
| **Pricing** (restructured 13 May 2026) | Per site: Starter free (2 pages, `webflow.io` address), Basic about $15/month yearly or $25 monthly (no CMS), **Premium** about $25/$39 (merges the old CMS and Business plans: 300 pages, 20,000 CMS items, site search, file-upload forms), Team (a new tier below Enterprise), Enterprise. Separate Ecommerce plans ($29–$212). **Plus** a per-seat Workspace plan (Core $19, Growth $49, Freelancer and Agency plans). **Plus** add-ons: Localization per locale, Analyze from $9, Optimize from about $299, extra bandwidth, and AI credits with a hard monthly cap since 29 Jun 2026 |
| **Code export** | Needs a paid Workspace. The ZIP holds readable HTML, one site-wide CSS file, `webflow.js`, jQuery and images. **What stops working outside Webflow:** CMS content (lists come out empty), forms, site search, redirects, sitemap and RSS, password protection, localisation, Ecommerce. Interactions keep working through `webflow.js`. Webflow does not support edits to exported code |
| **Hosting** | AWS plus a CDN (Webflow's page names Cloudflare; older sources say Fastly). No self-hosting apart from the export. **Webflow Cloud** (2025) hosts Next.js and Astro apps under a site path, usage-priced |
| **Sunsets 2025–2026** | Logic (automations) deprecated June 2025; Memberships / User Accounts shut 29 Jan 2026; the legacy Editor retired 4 Aug 2026 in favour of Edit mode and seats. All three moved paying users to third parties or new plans |

## 3. The editor
### 3.1 Layout and modes
- **Left toolbar** of icons, each opening a panel over the canvas: Add, Pages, Navigator (the layer tree), Components, Variables, Style selectors, Assets, CMS, Ecommerce, Apps, Site activity, Settings, Audit, Quick find.
- **Canvas** in the middle with a top bar: breakpoints, mode switch, preview, publish.
- **Right side**: Style (S), Element Settings (D), Style Manager (G) and Interactions (H) tabs. (*Unverified* for the current UI: the lessons that describe this say they show an older Designer.)
- **Three modes** since 2026: **Design** (everything), **Build** (assemble pages from components, for marketers), **Edit** (in-context content editing, the successor of the legacy Editor). Webflow's Edit mode is the same idea as Webforge's Content mode (F-ED-10).
- **Shortcuts:** single letters open panels (A Add, Z Navigator, P Pages, S Style, D Settings, G Style manager, H Interactions); Shift+/ lists them all; Alt/Option-click resets a style. Webforge follows Bootstrap Studio's modifier-based key map instead (F-ED-27); single-letter shortcuts clash with typing into fields, which our users do more than Webflow's.
- **Breakpoint canvas** (Conf 2026, Sep 2026): every breakpoint shown side by side on one canvas, in all three modes.

### 3.2 The style model, and why it is hard for our users
- Every element gets a **class**, auto-named after its type. Styles live on classes; **combo classes** inherit from a base class; tag styles (Body, All H1) are global defaults; states (hover, focus) per class.
- The Style panel is a full CSS inspector: Layout, Spacing, Size, Position, Typography, Backgrounds, Borders, Effects, Custom properties.
- **Breakpoints cascade**: Desktop is the base; 1280, 1440 and 1920 px inherit upward from it; Tablet, Mobile landscape and Mobile portrait inherit downward.
- **Style indicators** colour each value: blue when set on this class at this breakpoint, orange when inherited (from a tag, a base class, an ancestor or a larger breakpoint), pink for an element-only override that no class holds. Clicking one shows the source and offers Reset. An Inheritance menu and an "affected elements" count help clean up classes.
- Oct 2026 collapsed Div Block, Section, Container, Columns, Grid and the Flex blocks into a single **Box** element with layout settings, because users struggled to choose.

The most-cited complaint on G2 is the learning curve: the box model, class hygiene, the cascade and the indicator colours all presuppose front-end knowledge. This confirms Webforge's structured layout and Simple mode (T1, T2): small-business owners should never meet a class.

### 3.3 Features
| Area | Webflow | Notes |
|---|---|---|
| **Components** (formerly Symbols) | Properties (text, image, link, visibility), variants, **slots** for nested content; slot defaults (Oct 2026); components inside CMS rich text; style properties promised for late 2026 | Webforge: shared sections with *Detach* (F-ED-23) and shared Header/Footer. No per-instance properties |
| **Variables** | Design tokens for colours, sizes, fonts and numbers, with **modes** (for example light and dark), shared across sites through Libraries, synced from Figma | Webforge's theme model (F-DS-2, F-DS-4, Theme Studio F-DS-7) plays this role in plain words |
| **Interactions** | The classic IX2 trigger-and-timeline system, plus **GSAP-powered interactions** for every plan since mid-2025 (scroll triggers, split text, staggers, a horizontal timeline, reusable interactions). Webflow bought GSAP in Oct 2024 and made it free in Apr 2025 | Webforge: a few animation presets (F-DS-5). **GSAP's licence now excludes competing no-code builders**, see [Pinegrow §2](02-pinegrow.md#2-the-product) |
| **CMS** | Collections with typed fields, references, collection pages, lists with filters, sorting, pagination and conditional visibility; drafts and per-item publishing; 20,000 items on Premium | The v1.1 collections engine (BS9-3) covers the static subset |
| **Localization** | Paid per locale, machine translation, a locale switcher, "agentic translation" (Sep 2026) | Multilingual is v1.2+ (M5) |
| **Forms, search, redirects** | Hosted form handling with notifications and file upload; built-in site search; a 301 redirect table; auto sitemap and robots | All server-side, none survive export. Webforge: form services (F-CM-1), rename redirects in v1.1 (G7), search v1.2+ |
| **SEO and AI content** | Per-page title, description, Open Graph, canonical; AI-written meta descriptions and alt text; "AEO" audits | Webforge: Page Settings (F-SET-2), own-key AI in v1.1 (GA9) |
| **AI** | AI site builder (Feb 2025, generates a site plus a design system since Feb 2026); an AI Assistant that reads structure, styles and CMS and proposes changes for approval; AI code components editable visually; Claude and Gemini connectors to the **Webflow MCP server**; agents can write interactions (Sep 2026) and read Analyze and Optimize (Oct 2026). Paid with capped AI credits | Webforge: connect AI apps over MCP in the MVP (F-AI-1), own-key assistant in v1.1 (GA9). The approve-before-apply flow matches BS9-10's *Review changes* mode |
| **Optimize, Analyze** | A/B tests and personalisation; first-party analytics | Out of scope: both need a server (B2) |
| **Libraries, Marketplace, Apps** | Shared libraries of components, variables, tag styles and assets across a Workspace; a template marketplace; an Apps panel (Figma to Webflow, Algolia, Google Ads, an MCP bridge) | Marketplace and plugin API stay long-term (GA4) |
| **Output** | Readable HTML with the author's class names plus `w-` utility classes; one site-wide CSS file, not purged; `webflow.js` for navigation, sliders, forms and interactions, **still dependent on jQuery**; native popovers (anchor positioning, top layer) begin to replace JS for some components in 2026 | Webforge: Tailwind-purged CSS, classic `<script defer>` with no library (X1), `<dialog>` for the lightbox |

## 4. Where Webforge already stands
| Webflow | Webforge |
|---|---|
| Edit mode for content editors (a paid seat) | **Content mode** (F-ED-10) in the same app, no seat |
| Style indicators: set, inherited, overridden | **Changed cue and per-device dots** (UX-19, item 1.36): a dot per control that turns blue when a device override exists |
| Variables with modes | **Theme** with brand colours, fonts, roundness, text and button styles; section light/dark variants (F-DS-2…4, 2.4) |
| Components with slots | **Shared sections** and Header/Footer (F-ED-23, F-ED-7) |
| AI Assistant with approval; MCP server for Claude and Gemini | **Connect AI apps over MCP** in the MVP (F-AI-1); own-key assistant with a *Review changes* mode in v1.1 (GA9, BS9-10) |
| Code export that loses CMS, forms, search and redirects | **Everything Webforge makes is the export** (X1): no feature depends on a server, so nothing is lost |
| Per-site plan plus per-seat plan plus add-ons and AI credits | **One $99 licence**, unlimited sites (MVP §8) |
| Desktop browser at 1268 px+, always online | A desktop app that works offline |

## 5. Gaps and recommendations
Effort: **S** ≈ days · **M** ≈ 1–2 weeks · **L** ≈ several weeks.

### 5.1 Proposed for v1.1
| # | Proposal | Why | Effort | Where |
|---|---|---|---|---|
| WF-1 | **All devices side by side**: a canvas option that shows Desktop, Tablet and Mobile next to each other, editable in any of them, with the selection synced | Webflow's breakpoint canvas (Sep 2026) and Pinegrow's multi-view (PG-1) both make responsive problems visible without switching views. Our users rarely know to check mobile | M | Canvas view options (1.33) in v1.1; Puck renders one frame today, so a spike checks the cost of several |
| WF-2 | **Approve-before-apply for AI edits**, with the proposed change highlighted on the canvas before it lands | Webflow's AI Assistant proposes and the user approves; Bootstrap Studio offers the same choice (BS9-10) | S (design) | Sharpens the v1.1 assistant design; adds no scope |

### 5.2 Design lessons, no extra scope
| # | Lesson | Applies to |
|---|---|---|
| WF-3 | **Fewer layout primitives.** Webflow spent a decade with seven block types and collapsed them into one Box in 2026. Webforge's Section → Element model with columns handled in the Section is the right level; resist adding generic containers to the Add panel | Catalogue (S1), Advanced mode |
| WF-4 | **Keep the editing surface stable.** The legacy Editor, Logic and Memberships were each retired within two years, and the complaints show in the reviews. Features that go into Webforge's MVP should be ones we can keep; experiments live behind Advanced mode or in the plugin API later | Plan discipline (spec/04 §3) |
| WF-5 | **Native HTML over JavaScript** for popovers, menus and dialogs. Webflow is moving its components to anchor positioning and the top layer; our components already use `<dialog>` and should prefer `popover` and `details` where browser support allows, with a classic-script fallback | Component framework (2.5), exported-site checks (3.10) |
| WF-6 | **Pricing as a selling point.** A Webflow small-business site with a CMS, one editor seat and analytics costs roughly $50–70 a month in 2026 and loses its CMS on export. Webforge's one-off licence and complete export belong in the marketing copy and the start-screen trial messaging | MVP §8, Phase 5 onboarding |

### 5.3 Not proposed
- **Class-based styling and a CSS inspector:** the source of Webflow's learning curve. The Advanced tab's classes and class browser (F-ED-11, 2.18) are enough; per-element CSS editing stays *Later* (spec/02 §5).
- **Timeline interactions, Optimize, Analyze, Localization, Ecommerce, Memberships:** server-side or designer features outside the audience.
- **Components with per-instance properties and slots:** shared sections cover the small-business need (a section that is the same everywhere); a per-instance variant adds a concept our glossary avoids.
- **AI credits:** Webforge's own-key approach (GA2) keeps AI costs with the provider and content on the user's machine.

## 6. Design note: what "export" means to the two products
Webflow's export is a courtesy copy of a site that lives on Webflow; everything dynamic stays behind. Webforge's export **is** the site (X1), which is why features here are judged by whether they work from a folder on disk. When a Webflow feature looks attractive, the first question is the same as for C8: does it need a server? If so it is out, as Optimize, Analyze, forms handling and search are above.

## 7. Decisions
Product owner, 2026-10-24: all proposals adopted as written.

| # | Decision |
|---|---|
| WF-1 | ✅ **v1.1:** all devices side by side on the canvas, after a spike on rendering several Puck frames (shared with PG-1) |
| WF-2 | ✅ **v1.1 AI assistant design:** approve-before-apply with the change highlighted on the canvas (extends GA9 and BS9-10) |
| WF-3 – WF-6 | ✅ **Design lessons, no scope change:** fewer layout primitives; keep the editing surface stable; native HTML over JavaScript in components; the licence and the complete export as selling points |

## Sources
Official pages were read through search summaries and a release-feed mirror (see §1).
- Pricing (May 2026): [Webflow help article](https://help.webflow.com/hc/en-us/articles/51059955082387) · [Digidop](https://www.digidop.com/blog/webflow-pricing-2026-update) · [BRIX Templates](https://brixtemplates.com/blog/webflow-may-2026-pricing-changes-explained) · [nocode.mba](https://www.nocode.mba/articles/webflow-pricing-2026) · [nocode.tech](https://www.nocode.tech/article/webflow-just-overhauled-its-pricing-what-agencies-and-freelancers-need-to-know)
- Code export: [Webflow help](https://help.webflow.com/hc/en-us/articles/33961386739347) · [BRIX Templates on export limits](https://brixtemplates.com/blog/can-you-export-a-webflow-website-understanding-code-export-limitations)
- Release feed: [webflow.com/updates mirror](https://releases.sh/webflow/webflow-product-updates.md) · [Webflow Conf 2026 Designer changes (We-R)](https://www.we-r.co/en/blog/nouveautes-designer-webflow-conf-2026) · [Webflow Conf 2025 recap](https://webflow.com/blog/webflow-conf-2025-keynote-recap) · [AI site builder evolved](https://webflow.com/updates/ai-site-builder-evolved)
- GSAP: [Webflow acquires GSAP](https://webflow.com/blog/webflow-acquires-gsap) · [GSAP becomes free](https://webflow.com/updates/gsap-becomes-free) · [Interactions powered by GSAP](https://webflow.com/updates/introducing-webflow-interactions-powered-by-gsap)
- Sunsets: [Deprecating Logic and User Accounts](https://webflow.com/updates/deprecating-logic-and-user-accounts) · [Legacy Editor deprecation](https://webflow.com/blog/legacy-editor-deprecation)
- Editor: [Style panel](https://help.webflow.com/hc/en-us/articles/33961362040723) · [Breakpoints](https://help.webflow.com/hc/en-us/articles/33961300305811) · [Style labels](https://help.webflow.com/lesson/style-labels-in-the-designer) · [Keyboard shortcuts](https://university.webflow.com/lesson/keyboard-shortcuts) · [Left toolbar](https://webflow.com/glossary/left-tool-bar)
- Hosting and output: [Webflow hosting](https://webflow.com/feature/hosting) · [Webflow Cloud](https://developers.webflow.com/webflow-cloud/intro) · [jQuery dependency (forum)](https://discourse.webflow.com/t/libraries-i-e-jquery-mootools-etc/231)
- Reviews: [G2](https://g2.com/products/webflow/reviews) · [Flow Ninja: what is Webflow](https://www.flowninja.com/blog/what-is-webflow)
