# Webforge Research

Research supporting [`ideas.md`](../ideas.md).

**Consolidated outcome:** see [`../spec/`](../spec/): [Architecture](../spec/01-architecture.md) · [MVP specification](../spec/02-mvp-spec.md) · [Engineering standards](../spec/03-engineering-standards.md) · [Implementation plan](../spec/04-implementation-plan.md)

## Prior art
- [Bootstrap Studio](bootstrap-studio/README.md): internals, tech stack, file format, features, lessons for Webforge, the [9.0 competitor review](bootstrap-studio/06-bootstrap-studio-9.md) (decisions BS9-1…10) and the [9.0.1 editor screenshot pass](bootstrap-studio/07-editor-screenshot-pass.md) (SP-1…13 adopted as UI5, with screenshots)

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
| P4 | [Editor look and feel](product/04-editor-look-and-feel.md) | ✅ Decided (UI1) | Bootstrap Studio-like layout, dark default + light theme, compact density, colour-coded actions; own tokens on shadcn/ui |
| P5 | [Competitor feature gap analysis](product/05-feature-gap-analysis.md) | ✅ Decided (GA1–GA9) | 40 gaps; 15 small MVP additions (copy/paste, menu editor, animations, carousel, lightbox, newsletter/booking…); after the Elements 3.0 review, connect AI apps (MCP), shared sections, files in Media and `llms.txt` also in the MVP; built-in AI assistant with the user's own account in v1.1; plugin API long-term |
| P6 | [Editor UI/UX parity](product/06-editor-ui-ux-parity.md) | ✅ Decided (UI2–UI5) | Bootstrap Studio interaction parity (canvas, selection, panels) and Elements ideas (Inspector cues, per-device dots, Theme Studio) in the MVP; Bootstrap Studio's shortcuts as the standard; v1.1 notes, workspaces, display modes, AI panel |

