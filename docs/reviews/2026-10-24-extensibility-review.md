# Extensibility review: building blocks for new features

**Date:** 24 Oct 2026 · **Commit:** `main` at 7ee55d8 · **Builds on:** the [architecture review of 23 Oct](2026-10-23-architecture-review.md) (R1–R17, of which R2–R9 and R12 are merged) and the component review that became plan item 2.19 ([#320](https://github.com/nexustech/webforge/issues/320))

**Question (product owner):** should the editor use shared building blocks, composition or an internal plugin architecture, so new components, panels, menu items and features are quick to add and follow good practice?

**Short answer.** It already does, more than it says. Seven registries let an area contribute panels, commands, shortcuts, field renderers, IPC channels, strings and site components without editing the shell, and the hard rules (one history, zod at every boundary, dependency injection over mocks, one renderer) are kept in the code. What makes a new feature slow today is not a missing plugin system but four gaps around the registries: the composition root is a 600-line imperative effect, nothing stops renderer areas importing each other (and they do, in a cycle), fields are described three different ways so every dialog is hand-built, and the test fakes, story harnesses and scaffolds that would make a new area a half-day job live in one area's test helper or don't exist. A runtime plugin loader would cut against the sandbox, the licence policy and the no-external-requests rule, and buys nothing a build-time registry doesn't. Findings E1–E12; two plan items proposed in §5.

## 1. What is already a plugin architecture

| Registry | Where | An area adds… | Enforced by |
|---|---|---|---|
| Site components | `packages/site-components` (`defineComponent`, `createLibrary`) | one module per family; nothing outside the package switches on a component type | load-time checks, R7's typing, golden HTML |
| Behaviours | `site-components/src/behaviours/*.js` | one file; `pnpm behaviours` regenerates the index | type-checked JS, a unit test per script, an index test |
| Panels | `renderer/shell/panels.ts` (`PanelRegistry`) | `register({ id, slot, title, icon, component })` from `register-<area>-panel.tsx` | unique ids; slots and tabs are the shell's |
| Commands and shortcuts | `shell/commands.ts`, `shortcut-standard.ts`, `command-ids.ts` | `register({ id, label, menu, run })`; keys come only from the standard, by id | the app menu, command box, tooltips and the shortcut sheet all read the registry; a sheet test |
| Field renderers | `editor-ui/.../field-registry.ts` | `registerFieldRenderer(kind, Component)` (link, colour, image do this) | latest registration wins; the panel redraws |
| IPC channels | `shared/ipc-contract.ts`, one file per domain | a file and one line in two objects | zod both ways, sender checks, contract tests |
| UI strings | `packages/i18n/src/en/<area>.ts` | keys in the area's file | one-area-per-key test; the `ui-strings` scan |

The pattern is consistent: a typed registration function, a `use*` hook, and a shell that renders whatever is registered. Context menus and the Layers toolbar look commands up by id (`ELEMENT_MENU_COMMANDS`, `TOOLBAR_COMMANDS`), so a command added once appears everywhere it should.

## 2. What adding a feature touches today

| Scenario | Files | Of which central | Notes |
|---|---|---|---|
| A section component | module, strings, story, screenshots | strings (shared file) | 2.19 adds the frame and typography primitives, per-family strings and `pnpm new-component` |
| A panel | `register-x-panel.tsx`, the panel component, strings, an effect in `App.tsx` or `Editor.tsx`, story, test | `App.tsx`/`Editor.tsx` | The registry is fine; the wiring is hand-placed (E1) |
| A command with a key | the area's `register-x-commands.ts`, `shortcut-standard.ts`, `command-ids.ts` if the shell shows it, strings, a line in `Editor.tsx` with `setLayoutLocked` fan-out | three | The standard being central is by design (F-ED-27); the fan-out is not (E1) |
| A field kind | `site-components/schema.ts` and `define.ts`, `engine/puck/config.tsx`, an editor-ui renderer plus `FieldSpec`, the app's registration, `model` stored types, strings | four packages | Closed by design; the cost is undocumented (E4) |
| A dialog with a form | a new file; copies `Field`/`Check` from `PageSettingsDialog` or writes its own (`LinkDialog` did) | none, and that's the problem | No form building block (E3, E5) |
| An IPC domain | a contract file, two lines, a preload file, a main handler, tests | two lines | Good as it is |
| A Site Check rule, a publisher | Phase 3 and 4 interfaces are lists of modules | — | Keep them registries when built |

## 3. Findings

| # | Finding | Evidence | Why it matters |
|---|---|---|---|
| E1 | **The composition root is imperative.** `Editor.tsx` (597 lines) mounts the engine and calls ten `connect*`/`register*` functions in one effect, keeps six registration handles in refs, and fans `setLayoutLocked` out to four command sets by hand; `App.tsx` registers four more panels and command sets in separate effects | `Editor.tsx:318–420`, `App.tsx:133–151` | Every new area edits the same two files, in an order that matters; R9 part 2 removed the mode bridges but the shape stands |
| E2 | **Renderer areas import each other freely, with a cycle.** `clipboard` imports five areas; `site` → `menu` and `links`, `menu` → `links` and `site`, `links` → `shared-sections`, `shared-sections` → `site`. `dependency-cruiser` has package rules only; nothing applies to `renderer/<area>` | import map of `apps/desktop/src/renderer/*` | An "area" is not a unit that can be added, tested or removed on its own, which is what makes a registry worth having |
| E3 | **Three vocabularies for a field.** `FieldDef` (site-components, discriminated), `FieldSpec` (editor-ui, loose; R11 open), and hand-written dialog forms: `SiteSettingsDialog.tsx` is 713 lines of markup over a `SettingsForm` type, `PageSettingsDialog` exports its own `Field`, `Check` and `ImageChoice` which Site Settings imports, `LinkDialog` has another `Field` | `site-settings/`, `site/PageSettingsDialog.tsx:60–253`, `links/LinkDialog.tsx:66` | The next dialogs are the big ones: Theme Studio (2.3b), one Settings dialog (LF-12), Publish destinations (4.4), Version History (4.6). Each would be hand-built again, and the model's limits re-typed as literals each time |
| E4 | **A new field kind is a four-package change with no recipe.** The schema union, `valueReader`, the Puck mapping, the renderer, the app's registration, the stored types and the strings | §2 | 2.9b adds `icon`; nothing tells its author the seven places, and no test says a kind is missing a renderer or a story |
| E5 | **No dialog building block.** Opening a dialog from a menu is done three ways (noted in the 23 Oct review); Save/Cancel, the undo label and validation are re-done per dialog | `use-menu-dialog.ts`, `CanvasElementMenu.tsx`, `LayersPanel.tsx` | Same cost as E3, on the chrome side |
| E6 | **Test and story harnesses aren't shared.** The fake engine lives in `editor/fake-engine.test-helper.ts` and is imported by 13 test files across areas; session fixtures are made ad hoc; `@webforge/test-utils` holds site fixtures only; two areas (`shared-sections`, `start`) have no stories and the rest have one file each | `test-utils/src`, story counts | A new area's author assembles a harness from other areas' tests; stories, the visual and axe gate, are the easiest thing to skip |
| E7 | **No scaffolds beyond 2.19's component one.** A panel, a command set, a field kind or an IPC domain is started by copying a neighbour | — | Copying is how E2's web and E3's duplicates grew |
| E8 | **The extension points are undocumented.** `docs/components.md` is the only recipe; the registries in §1 are described in their source comments and nowhere else; CLAUDE.md doesn't name them | `docs/` | Sessions discover the registries by reading `Editor.tsx`, which is E1 |
| E9 | **The engine is the one place change is expensive.** 5.4k lines after R8 (7.4k before), most of it Puck workarounds; the fallback canvas of ADR 0004 is a rewrite | `packages/engine/src` | Not an extension problem, but every canvas feature (SP-1…3, LF-1…3, 2.17) lands here. R8's contract module and Puck-free tests are the right direction; keep them growing |
| E10 | **Site Settings sections are a fixed list,** and LF-12 is about to merge app settings into the same dialog | `SiteSettingsDialog.tsx:39` | Analytics (3.8), forms (3.7) and publish (4.4) each add a section; a registry lets them add it from their own area |
| E11 | **`t()` params and plurals are unchecked** (23 Oct review) | `packages/i18n` | Every feature adds strings; a missing `{item}` is found at runtime |
| E12 | **Model limits typed as literals in dialogs** (23 Oct review, R10) | `maxLength={200}` etc. | Goes away with E3 if forms take their limits from the zod schemas |

Good practice already in place, to keep and spread: dependency injection instead of module mocks (zero `vi.mock` in the renderer), every mutation through `HistoryManager` with a glossary label, zod on both sides of IPC, one renderer for canvas, export and stories, per-area strings, and the shortcut standard as a single source. The 23 Oct review's Phase 2 items are landing fast (R7, R8, R9 and R12 merged within a day), which is what makes E1–E8 cheap now and expensive later.

## 4. What to build

Ordered by payoff per day. Everything is a build-time building block inside the monorepo; nothing is loaded at runtime.

| # | Building block | Replaces | Effort |
|---|---|---|---|
| B1 | **Area modules and a declarative composition root.** Each area exports `area = { id, register(ctx): () => void }` where `ctx` carries the registries, the session, the engine handle and the preferences store; `connectEditor(areas, ctx)` registers them in order and returns one dispose. Mode changes reach areas through the preferences store they already subscribe to, not through `setLayoutLocked` fan-out | E1 | 1.5 days |
| B2 | **An area boundary rule.** `dependency-cruiser`: `renderer/<area>/` may import `shell/`, `editor/`, `../../shared/` and another area only through that area's `index.ts`; no cycles between areas. Break the `site` ↔ `menu` ↔ `links` cycle by moving the page-list and link-target helpers they share into `editor/` (or the model, where they're pure) | E2 | 1 day |
| B3 | **One form engine.** `FormSpec` in editor-ui: a list of fields using `FieldDef`'s kinds (R11 makes `FieldSpec` that union) plus groups and layout; a `Form` component drawn by the field registry; values validated by the zod schema the model already has, so limits and messages come from one place. Site Settings, Page Settings, Device and Name move onto it; Theme Studio, the LF-12 Settings dialog and Publish destinations are written on it | E3, E12 | 4 days |
| B4 | **`FormDialog`** on B3: title, form, Save and Cancel, the undo label, and `useMenuDialog` as the one way a menu opens it | E5 | 0.5 day |
| B5 | **A field-kind recipe and guard.** `renderer/fields/<kind>/` holds the renderer registration, the reader and a story; `docs/extending.md` lists the seven places; a test asserts every `FieldDef` kind has a renderer, a Puck mapping and a story | E4 | 0.5 day |
| B6 | **A renderer test kit and story harness.** `@webforge/test-utils/renderer`: the fake engine, a fake preload API, `sessionWith(site)`, `registriesForTest()`; `panelStory(registerPanel, fixture)` and `dialogStory(...)` in the app's Storybook; a test that every `register*Panel` has a story | E6 | 1.5 days |
| B7 | **Scaffolds** extending 2.19's command: `pnpm scaffold area\|panel\|commands\|field-kind\|ipc-domain <Name>` writing the module, strings, story and test from templates and registering it | E7 | 1 day |
| B8 | **`docs/extending.md`**: the registries of §1, each with its recipe, linked from CLAUDE.md's reading list | E8 | 0.5 day |
| B9 | **Settings sections as a registry**, done inside 1.39's LF-12 | E10 | 0 (in 1.39) |
| B10 | **Typed `t()` params and a `plural()` helper** | E11 | 1 day |

## 5. Where it lands
Two plan items, so the work is visible and sized against the Phase 2 date:

- **2.20 Editor building blocks: area modules, boundaries, test kit, scaffolds, extension-points guide** (B1, B2, B5, B6, B7, B8, B10): **7 days**, on stream B after 2.4 and before 2.8 (product owner, 24 Oct), so the panels and dialogs Phase 2 adds are built on it. It depends on 2.19 (the scaffold) and R11, which moves up stream A's queue to just after R10.
- **2.21 One form engine for the Edit panel and dialogs** (B3, B4): **5 days** (4.5, plus adopting R10's form primitives and exported limits rather than duplicating them), on stream A after 2.9 and before the first large dialog it would save: LF-12 in 1.39, then Theme Studio (2.3b). It depends on R10, R11 and 1.36 (merged).
- B9 goes into 1.39's scope; B10 goes into 2.20.

That is **12 days** in the plan (7 and 5) on top of a Phase 2 that has two or three days of slack ([plan review](2026-10-23-plan-review.md)). The honest trade: either the milestone moves a week, or §11's cuts (four templates, six themes) pay for it. What the days buy is that the remaining 28 components, four large dialogs and three settings sections are written against building blocks rather than copied, which is the only way the Phase 3 and 4 work (Site Check, publishers, Version History, the Settings dialog) stays at Phase 1's pace.

**Not proposed:** a runtime plugin loader or a public plugin API (gap analysis: long-term); replacing Puck now (ADR 0004 stands; R8 keeps the exit open); a generic "widget" layer over shadcn (editor-ui already is that layer).
