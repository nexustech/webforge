# Editor UI/UX: Bootstrap Studio Parity and Elements Ideas

**Status:** ✅ Decided 2026-10-22 (UI2–UI4, see [§6](#6-decisions))
**Date:** 2026-10-22
**Goal (product owner, 2026-10-22):** "UI and UX are very important… replicate as much of Bootstrap Studio as possible with similar UI elements, also look at Elements and see which UI and UX we can implement."
**Builds on:** [UI1](04-editor-look-and-feel.md), which already copies Bootstrap Studio's layout, dark palette, density and colour-coded actions. This note goes one level deeper, into **interactions**: what happens on click, drag, right-click and keypress.

## 1. Method and limits
- **Bootstrap Studio 9.0:**
  - about 40 official docs pages, including the full keyboard-shortcut page;
  - UI strings from the installed 9.0.0 app (see [bootstrap-studio/06](../bootstrap-studio/06-bootstrap-studio-9.md)).
- **RapidWeaver Elements 3.x:**
  - about 90 official docs pages (editor, Inspector, Node Browser, Theme Studio, Resources, AI);
  - forum release notes.
  - Elements is Mac-only, so it wasn't installed for inspection.
- **Webforge today:** the editor as merged on `main`:
  - title bar and command box;
  - Add, Edit (Content/Style/Advanced), Layers, Undo History, Pages, Media and Menu panels;
  - canvas toolbar with page, device, width and zoom/Fit;
  - selection chip with move, duplicate and delete;
  - shared-region banner, Site Settings and link dialog.
- **Limits:**
  - No screenshots of either app were taken: computer use was off on the linked laptop.
  - Visual details not described in the docs (exact hover outlines, drop indicators, toolbar icons) should be checked against screenshots before implementation.
  - Docs were read through summaries, so some control names may be paraphrased.
- **IP rule (unchanged from UI1):**
  - We copy **interaction patterns, layout and conventions**, including keyboard shortcuts, which are functional.
  - We never copy Bootstrap Studio's or Elements' code, CSS, icons, images, help text or wording. All UI text uses our glossary.

## 2. What Webforge already matches
- **Layout:** panel layout, palette, density and colour-coded title-bar actions (UI1).
- **Undo:** an Undo History panel, which goes further than Bootstrap Studio 9's undo list.
- **Canvas toolbar:** page, device view, width, zoom and Fit, with a size readout.
- **Selection:** outline, a label chip and quick actions (move up/down, duplicate, delete).
- **Panels:** Layers with hide and rename; per-device values marked in the Edit panel; a command box.
- **Reuse:** shared Header/Footer with a banner; shared sections planned (F-ED-23, like Linked Components and Global Templates).
- **Checks:** Site Check, broader than Bootstrap Studio's *Check for Issues*.

## 3. Bootstrap Studio parity: proposals
Effort: **S** ≤ 1 day · **M** 2–4 days. Estimates are ideal days, as in the plan.

### 3.1 Canvas and selection
| # | Bootstrap Studio | Proposal for Webforge | Effort |
|---|---|---|---|
| UX-1 | Quick-actions bar: Move, **Select Parent**, **Edit**, Resize Margin/Padding, Duplicate, **Hide**, Delete | Add **Select parent**, **Edit** (opens text editing or the image/icon picker) and **Hide** to the selection chip; keep move, duplicate and delete | S |
| UX-2 | **Keyboard navigation:**<br>• Ctrl/Cmd + ↑/↓ for parent/child<br>• Ctrl/Cmd + ←/→ for siblings<br>• Enter edits text; Backspace empties it and starts editing<br>• F2 renames; Ctrl/Cmd + / hides; Ctrl/Cmd + L adds a label<br>• Ctrl/Cmd + D duplicates; Delete deletes | Adopt the **same key map** on Windows and macOS (§5) | S–M |
| UX-3 | **Multi-select** with Ctrl/Shift + click on the stage or in Overview; move, delete or style together | Multi-select on the canvas and in Layers. MVP: move, duplicate, delete and hide as one undo step. Styling several at once comes later | M |
| UX-4 | **Ctrl/Cmd + drag** copies; Ctrl/Cmd + Shift + drag makes a linked copy | Ctrl/Cmd + drag duplicates. Ctrl/Cmd + Shift + drag of a shared section places another linked copy (F-ED-23) | S |
| UX-5 | **Margin/padding handles on the stage**: drag each side; Shift for symmetric; Ctrl/Cmd + Shift for all sides; middle-click resets | Spacing handles on the selected section or element. They **snap to our spacing tokens** (None · S · M · L · XL), not raw pixels, and write to the **current device**. Keep the same modifier keys; Alt-click resets (middle-click is hard on laptops) | M |
| UX-6 | **Column toolbar** on a selected column: reorder, resize, add columns, per breakpoint. **Resize handles** on images, icons and columns | A **Columns toolbar** on the Columns element: add or remove a column, pick a layout (½·½, ⅓·⅔, ⅓·⅓·⅓…), and set per-device stacking. Image width handles snap to size tokens | M |
| UX-7 | **Stage menu overlays**: Outline Grid, **Show Box Model** (margins/padding on hover), Show Comments, **Extra Whitespace** (space at the page bottom to drop into) | A **View** menu on the canvas toolbar with *Show outlines* (exists), *Show spacing on hover*, *Show element names* (as Elements' titles) and *Extra space at the bottom* | S |
| UX-8 | **Stage sizing**:<br>• drag the stage edge to resize;<br>• **Flip** width and height;<br>• **Fit to Canvas**;<br>• click the size readout for device presets;<br>• **Add New Device** (name, width, height) | Drag the canvas edges to set a custom width, with a live readout that snaps to the Desktop/Tablet/Mobile widths. Add a rotate button, clicking the readout to open presets, and *Add device…* for custom presets (per user) | M |
| UX-9 | Breadcrumbs listener in the bundle (a breadcrumb bar) | A **breadcrumb bar** under the canvas toolbar (Page › Section › Columns › Image); click a crumb to select it, hover to outline it | S |

### 3.2 Panels
| # | Bootstrap Studio | Proposal for Webforge | Effort |
|---|---|---|---|
| UX-10 | Component panel: **search**, **Add to Favorites** (a group at the top), User library, previews on hover | Add panel:<br>• **Favourites** group (right-click *Add to Favourites*);<br>• **Recently used**;<br>• a **larger thumbnail preview on hover** for sections | S |
| UX-11 | **Command palette** (Ctrl/Cmd + P): every command, switch pages, `make page`, `add navbar` | Grow the command box into a full palette:<br>• every menu command;<br>• *Go to page…*;<br>• **Add ‹section/element›** by name (as Elements' *Quick Add*);<br>• toggles for modes, themes and panels.<br>No Emmet syntax (developer feature) | M |
| UX-12 | Overview: drag on the tree, **drop validity shown while dragging**; indicators: lock, linked, animated ★, custom options; right-click *Expand all* | Layers:<br>• **drop-valid/invalid feedback** while dragging;<br>• indicators for shared (linked), hidden, animated and locked;<br>• right-click *Expand/Collapse all*;<br>• **filter field** (as Elements' search at the bottom) | M |
| UX-13 | Options panel: grouped options; **Ctrl/Cmd + Enter** expands and **Ctrl/Cmd + Esc** resets an option or group; "Search options"; collapse the panel to icons | Edit panel:<br>• **Reset** per field and per group (right-click and Ctrl/Cmd + Esc);<br>• **Expand all / Collapse all**;<br>• a **search field** for options;<br>• collapsing a side column leaves a strip of panel icons | M |
| UX-14 | **Copy Options / Copy Classes / Copy Attributes** | **Copy style / Paste style** between sections or elements of the same type (one undo step) | S |
| UX-15 | Image browser (design images, stock tabs), Icon browser (set dropdown, search, double-click to choose), Google Fonts browser (search, categories, editable sample text) | One consistent **picker dialog** pattern for Image (site media; stock photos in v1.1, G26), Icon (search, categories) and Font (search, categories, **editable sample text**, live preview) | S each, inside existing items |
| UX-16 | Undo/Redo merged into **one control with a history list** (9.0) | A dropdown arrow on the title-bar Undo button lists recent steps (jump), next to the Undo History panel | S |
| UX-17 | Comments on components (shown on the stage, never exported) | **Notes on elements** ("swap this photo before launch"), shown as small markers; never exported; listed in Site Check as Tips | M (v1.1) |

### 3.3 Not proposed from Bootstrap Studio
| Bootstrap Studio | Reason |
|---|---|
| Editor panel (HTML view, Styles/CSS block editor, Style Target Editor, Attributes table), Appearance tab of raw CSS properties | Developer features. Webforge uses design-token controls; Advanced mode has classes, attributes and Custom Code |
| Custom Options editor, Emmet `add row>col*3`, export scripts, external editors, JS include order | Developer features |
| Online component library, team sharing, `.bscomp` export | Out of scope (GA4 long-term; single-user product) |
| Several designs open as tabs (Ctrl/Cmd + 1–9) | One site per window in the MVP (UI1) |
| Detachable editor windows, freely rearranged panels | Considered under Elements' workspaces below (UX-22) |

## 4. Elements: proposals
| # | Elements | Proposal for Webforge | Effort | When |
|---|---|---|---|---|
| UX-18 | **Inspector cues:**<br>• a group title turns the accent colour when anything in it is changed;<br>• right-click *Reset to Default* / *Reset Group to Defaults*;<br>• *Single Group Mode* (accordion) | Changed-group cue and reset in the Edit panel (with UX-13); optional "one group open at a time" | S | MVP |
| UX-19 | **Per-breakpoint "dots":**<br>• at larger screens each control shows a grey dot;<br>• clicking it turns it blue and creates an override that carries upward | Replace our "‹device› only" text marker with a **dot control**:<br>• grey: inherits;<br>• accent: set for this device;<br>• click the dot to clear.<br>Clearer and more compact | S | MVP |
| UX-20 | **Drag on a number** to change it; **Shift** for fine steps; Theme/Manual switch for spacing | Scrubbing on number fields (sliders, sizes); Shift for fine steps. Keep token values first; manual values only in Advanced | S | MVP |
| UX-21 | **Theme Studio** window:<br>• theme cards grid;<br>• colour palettes as 50–950 swatch rows with roles (**Brand, Accent, Surface, Text**);<br>• font roles; type, spacing and radius scales;<br>• a **visual shadow editor**;<br>• typography presets per tag (H1–H6, paragraph, link states);<br>• light and dark values | Shape the Theme panel (2.3) like a studio. Quick controls stay in the right column (preset, brand colours, fonts, roundness); **Open Theme Studio** opens a larger window with:<br>• the theme cards grid with live mini previews;<br>• palette rows with generated shades and roles;<br>• text styles per tag;<br>• spacing/radius/shadow scales;<br>• light/dark values side by side | M (+2 days on 2.3) | MVP |
| UX-22 | **Custom Workspaces:** move panels, resize, collapse, multiple monitors, switch workspaces with ⌘⌥. / ⌘⌥, | MVP: collapse a column to an **icon strip** (with UX-13) and remember it. v1.1: drag a panel tab to the other column; saved layouts | S / M | MVP / v1.1 |
| UX-23 | **Display modes per component:** *Visible*, *Hide in Editor*, *Do Not Publish*, *Hide and Do Not Publish* | Layers' hide becomes a small menu: *Show* · *Hide while editing* · *Don't publish* (kept in the site, left out of export) | S | v1.1 (with draft pages, G37) |
| UX-24 | **Node Browser context menu:** Rename, Duplicate, **Duplicate without Content**, Convert to Global / Unlink, **Select Similar**, **View Help…** | Layers and canvas right-click menu:<br>• Rename, Duplicate;<br>• *Save as shared section* / *Detach*;<br>• **Select similar**;<br>• **Help for this element** (opens our help page) | S | MVP |
| UX-25 | **Colour picker** as palette + shade + **opacity** ("Brand 500, 80%") | Colour field:<br>• theme colours first, with shades;<br>• opacity;<br>• a custom colour only in Advanced or the Theme Studio, to keep sites on-brand;<br>• contrast warning inline | M | MVP |
| UX-26 | **Edit-only previews:** Grid *Preview Columns*, mobile-menu *Preview* toggle | In the editor, show column outlines on Columns, and a *Show mobile menu* toggle on the Header while the Mobile view is active | S | MVP (with 2.6/2.9) |
| UX-27 | **Hover states** in the Inspector (Static/Hover, *Hover over: Self/Parent*) and transitions | Keep F-DS-5's hover presets (Lift, Grow, Shadow). A full hover-state editor is designer territory: not proposed | — | Not proposed |
| UX-28 | **AI Assistant panel UI:**<br>• context chips (*+ selected component / current page / files*, `@` context, `/` skills);<br>• model and effort menus;<br>• token readout;<br>• **review card with Accept / Undo**;<br>• plan and live task list;<br>• **AI Memory** in the sidebar;<br>• *Install in Claude Desktop…* for MCP | v1.1 assistant (GA9, BS9-10): context chips for the selected element and current page, a review card with Accept / Undo, a usage readout and a task list.<br>**MVP (F-AI-1):** a one-click *Set up in Claude Desktop* helper in the pairing flow | — / S | v1.1 / MVP |
| UX-29 | **Starter projects** gallery; trial limits; **Phrasebook**; short videos on docs pages | New Site gallery with **filter and sort** (2.14). A glossary page and short videos in help (5.4) | S | MVP |

**Not proposed from Elements:**
- **Too technical or out of scope:** custom component code editor (Template/Styles/JS/Hooks/Properties), Tailwind class fields beyond Advanced, Hooks, PHP pages, the Store and add-ons.
- **Not wanted:** the hidden game, the "Made in Elements" badge.

## 5. Keyboard shortcut map (proposed)
Bootstrap Studio's keys, plus a few from Elements, so users of either feel at home. Mod = Ctrl (Windows) / Cmd (macOS).

| Action | Keys | Source | Webforge today |
|---|---|---|---|
| New / Open site | Mod + N / Mod + O | BS | ✅ |
| Save now (autosave) / Save version | Mod + S / Mod + Alt + S | BS / F-SITE-4 | Mod + S planned |
| Command palette | **Mod + P** (keep Mod + K as an alias outside text) | BS | Mod + K |
| Preview / Export / Publish | **Mod + I** / Mod + E / **Mod + U** | BS | Mod + E only |
| Undo / Redo | Mod + Z / Mod + Shift + Z (Ctrl + Y on Windows) | All | ✅ |
| Copy / Cut / Paste / Paste as shared copy | Mod + C / X / V / **Mod + Shift + V** | BS | Copy/cut/paste ✅ |
| Duplicate / Delete / Rename | Mod + D / Delete / F2 | BS | ✅ |
| Hide element | **Mod + /** | BS | — |
| Select parent / child | **Mod + ↑ / Mod + ↓** | BS | ↑/↓ select previous/next |
| Select previous / next sibling | **Mod + ← / Mod + →** | BS | — |
| Move element up / down | Mod + Alt + ↑ / ↓ | Elements | — |
| Edit text / empty and edit | **Enter** / **Backspace** | BS | Double-click |
| In text: link, new line, split, non-breaking space | Mod + K, Shift + Enter, **Alt + Enter**, **Shift + Space** | BS | Link ✅ |
| Zoom in / out / reset / fit | Mod + = / Mod + − / Mod + 0 / Mod + 9 | BS (+ fit) | Toolbar only |
| Device view Desktop / Tablet / Mobile | **Mod + 1 / 2 / 3** | Elements | — |
| Expand option group / reset option | Mod + Enter / Mod + Esc | BS | — |
| Next / previous panel | Mod + Tab / Mod + Shift + Tab | BS | — |
| Show outlines / show element names | Mod + Shift + ' / Mod + Alt + ' | Elements | — |

A **Keyboard shortcuts** sheet (Help menu and `?`) lists them all (with 5.4).

## 6. Decisions
Decided by the product owner on 2026-10-22:

| # | Decision |
|---|---|
| **UI2** | ✅ **Groups A–D are adopted in the MVP:** canvas and selection, panels, Theme Studio, shortcuts and help (UX-1–16, 18–21, 24–26, 29). Spec F-ED-25, F-ED-26, F-ED-27 and F-DS-7. Plan items 1.30–1.38 and 2.17; 2.3 +2 days; 2.14 +1 day |
| **UI3** | ✅ **Bootstrap Studio's keyboard shortcuts are the standard** (§5), including **Mod + P** for the command palette, with Mod + K kept as an alias outside text editing |
| **UI4** | ✅ **v1.1:** notes on elements (UX-17), movable panels and saved layouts (UX-22), hide-while-editing / don't-publish modes (UX-23), and the AI assistant panel design (UX-28) |

Still open: a screenshot pass of Bootstrap Studio once computer use is switched on, to check visual details (hover outlines, drop indicators, toolbar icons) before items 1.30–1.33 start. UX-27 (hover-state editor) stays not proposed.

## Sources
- **Bootstrap Studio docs:**
  - [Docs index](https://bootstrapstudio.io/docs/) · [Stage](https://bootstrapstudio.io/docs/stage.html) · [Selecting and moving](https://bootstrapstudio.io/docs/selecting-and-moving.html) · [Editing components](https://bootstrapstudio.io/docs/editing-components.html)
  - [Component panel](https://bootstrapstudio.io/docs/component-panel.html) · [Options panel](https://bootstrapstudio.io/docs/options-panel.html) · [Overview panel](https://bootstrapstudio.io/docs/overview-panel.html) · [Design panel](https://bootstrapstudio.io/docs/design-panel.html) · [Editor panel](https://bootstrapstudio.io/docs/editor-panel.html)
  - [Command palette](https://bootstrapstudio.io/docs/command-palette.html) · [Previewing](https://bootstrapstudio.io/docs/previewing.html) · [Responsive pages](https://bootstrapstudio.io/docs/designing-responsive-pages.html) · [Linked components](https://bootstrapstudio.io/docs/linked-components.html) · [Icons](https://bootstrapstudio.io/docs/icons.html) · [Keyboard shortcuts](https://bootstrapstudio.io/pages/keyboard-shortcuts)
- **Bootstrap Studio app:** UI strings from the installed 9.0.0 app ([bootstrap-studio/06](../bootstrap-studio/06-bootstrap-studio-9.md))
- **Elements docs:**
  - [Elements docs](https://docs.realmacsoftware.com/elements-docs/) (editor, workspaces, Node Browser, component inspector, keyboard shortcuts, common controls, Theme Studio, resources, previewing, publishing, AI assistant, MCP server, CMS)
  - [Elements product page](https://realmacsoftware.com/elements/)
  - Forum release notes for [3.0 beta](https://forums.realmacsoftware.com/t/elements-3-0-beta-now-available/56986) and [3.0.10 beta](https://forums.realmacsoftware.com/t/elements-3-0-10-beta-now-available/57503)
