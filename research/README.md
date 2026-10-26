# Webforge Research

Research supporting [`ideas.md`](../ideas.md).

**Consolidated outcome:** see [`../spec/`](../spec/): [Architecture](../spec/01-architecture.md) · [MVP specification](../spec/02-mvp-spec.md) · [Engineering standards](../spec/03-engineering-standards.md) · [Implementation plan](../spec/04-implementation-plan.md)

## Prior art
- [Bootstrap Studio](bootstrap-studio/README.md): internals, tech stack, file format, features, lessons for Webforge, the [9.0 competitor review](bootstrap-studio/06-bootstrap-studio-9.md) (decisions BS9-1…10) and the [9.0.1 editor screenshot pass](bootstrap-studio/07-editor-screenshot-pass.md) (SP-1…13 adopted as UI5, with screenshots)
- [Competitor reviews](competitors/): [Webflow](competitors/01-webflow.md) (WF-1…6: side-by-side devices and approve-before-apply AI in v1.1, four design lessons) and [Pinegrow 10.1](competitors/02-pinegrow.md) (PG-1…9: palette from an image and example sites in the MVP, three v1.1 items, the GSAP licence rule). Both **decided 2026-10-24**: PG-2 and PG-3 join the MVP (+2 days), the rest is v1.1 or a rule. Other competitors are covered in the [gap analysis](product/05-feature-gap-analysis.md) and the [editor parity note](product/06-editor-ui-ux-parity.md)

## Stack decisions
| # | Question | Status | Outcome |
|---|---|---|---|
| 1 | [Desktop shell: Electron vs Tauri](stack/01-electron-vs-tauri.md) | Researched | **Electron** (pending a 2–3 day spike) |
| 2 | [Editor UI framework: React vs Svelte](stack/02-react-vs-svelte.md) | ✅ Decided | **React + shadcn/ui** |
| 2a | [Undo / redo design](stack/03-undo-redo.md) | ✅ Agreed | Zustand + Immer patches, custom history manager, history panel |
| 3 | [Canvas / editor engine](stack/04-canvas-engine.md) | Researched | **Puck** (MIT) pending 3–4 day spike; fallback = own canvas on dnd-kit + Tiptap |
| 3a | [Site components, theming & self-contained output](stack/05-site-components.md) | ✅ Decided | **daisyUI** (MIT) static components, distinct themes per site; all assets bundled, no CDNs |
| 4 | [Project file format & versions](stack/06-project-file-format.md) | Researched | Single-file **SQLite `.wforge`**, periodic autosave, named + last-20 automatic versions; ZIP fallback; 1–2 day spike |
| 5 | [Export pipeline (build & preview)](stack/07-export-pipeline.md) | ✅ Decided (X1–X6) | **In-app pipeline** (Puck render + Tailwind v4/daisyUI + esbuild + jSquash images) in a utilityProcess; same pipeline for live preview; no SSG |
| 6 | [Publishing](stack/08-publishing.md) | ✅ Decided (B1–B5) | **Folder/ZIP + FTP/FTPS/SFTP + Netlify**; form service presets (Formspree, Web3Forms, FormSubmit, Netlify Forms, custom); GA4 + consent banner; hosting deferred |

## Product design
| # | Topic | Status | Outcome |
|---|---|---|---|
| P1 | [Terminology / glossary](product/01-terminology.md) | ✅ Agreed (T1–T4) | DIY small-business users; Simple/Advanced mode; structured layout; Site → Page → Section → Element; Header/Footer; Theme vs Template; Add panel, Layers, Edit panel; Version History vs Undo History; Site Check |
| P2 | [CMS features](product/02-cms.md) | ✅ Agreed (M1–M5) | MVP: click-to-edit, Content mode toggle, repeating lists, site-wide values, Buy button · v1.1: Blog · then Portfolio, Team, Events · search/multilingual v1.2+ |
| P3 | [Starting content](product/03-starting-content.md) | ✅ Decided (S1–S5) | 18 sections (~45 variants) + 16 elements, now 19 + 17 after GA1 (Newsletter signup, Carousel); 8 templates; 10–12 curated themes; ~50 bundled fonts + on-demand catalogue |
| P4 | [Editor look and feel](product/04-editor-look-and-feel.md) | ✅ Decided (UI1, amended by UI6) | Bootstrap Studio-like layout, dark default + light theme, compact density, colour-coded actions; own tokens on shadcn/ui |
| P5 | [Competitor feature gap analysis](product/05-feature-gap-analysis.md) | ✅ Decided (GA1–GA9) | 40 gaps; 15 small MVP additions (copy/paste, menu editor, animations, carousel, lightbox, newsletter/booking…); after the Elements 3.0 review, connect AI apps (MCP), shared sections, files in Media and `llms.txt` also in the MVP; built-in AI assistant with the user's own account in v1.1; plugin API long-term |
| P7 | [Look-and-feel pass](product/07-look-and-feel-pass.md) | ✅ Decided (UI6) | Copy Bootstrap Studio 9.0.1's look as far as the IP rule allows: blue selection, flat canvas, accent quick-actions bar, toolbar order, tab strips, two-column fields, card-grid start screen, one Settings dialog, icon-only title bar (LF-1…13; item 1.39 + 2.14) |
| P8 | [Styling one section or element](product/08-component-styling.md) | ✅ Decided (ST-1…7) | How Webflow, Pinegrow, Elements and Bootstrap Studio style one component; Webforge has the thinnest per-element styling of the five. A common Appearance group of token controls on every section and element with a hover row (MVP, item 2.22), underline/highlight/colour inside text (MVP chore #495), tokens-only rule kept in Simple mode; apply-to-all-of-a-kind, section backgrounds and transition presets in v1.1 |
| P6 | [Editor UI/UX parity](product/06-editor-ui-ux-parity.md) | ✅ Decided (UI2–UI5) | Bootstrap Studio interaction parity (canvas, selection, panels) and Elements ideas (Inspector cues, per-device dots, Theme Studio) in the MVP; Bootstrap Studio's shortcuts as the standard; v1.1 notes, workspaces, display modes, AI panel |
| P8 | [Start screen comparison](product/08-start-screen-comparison.md) | ✅ Decided (SC-1–SC-4) | Compared with Bootstrap Studio, Pinegrow, Mobirise, Elements and Webflow: larger type than the editor, the logo/name/version block, a first start that says what to do next, templates kept in New Site (2.14b) |

## Content
| # | Topic | Status | Outcome |
|---|---|---|---|
| C1 | [Template photos: stream C](content/template-photos-c.md) | 🟡 Shortlist for review | Personal / CV's eight photos: a CC0 choice and an alternate each (StockSnap, via Openverse), nothing downloaded; generated placeholders until approved (Q6, refined 26 Oct 2026). Blank has no photos |
| C2 | [Template photos: 2.15b](content/template-photos-b.md) | 🟡 Shortlist for review | Consultant, Photographer/Portfolio and Shop: 22 photos with a CC0 choice and an alternate each (StockSnap, via Openverse), nothing downloaded; generated placeholders until approved, the photographer's marked as placeholders |
| C3 | [Template photos: 2.15a](content/template-photos-a.md) | 🟡 Shortlist for review | Café/Restaurant, Salon/Beauty and Trades: 27 photos with a CC0 choice and an alternate each (StockSnap, via Openverse), nothing downloaded; generated placeholders until approved |

