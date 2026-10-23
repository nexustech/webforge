# Look-and-Feel Pass: Closing the Visual Gap to Bootstrap Studio

**Status:** ✅ Decided 2026-10-23 (UI6, see [§4](#4-decision))
**Date:** 2026-10-23
**Goal (product owner, 2026-10-23):** "I would like to copy UI and UX look and feel as much as possible."
**Builds on:** [UI1](04-editor-look-and-feel.md) (layout, palette, density), [UI2–UI5](06-editor-ui-ux-parity.md) (interactions, SP-1…SP-13). This note lists what still looks different from Bootstrap Studio 9.0.1 after those, as a checklist, and corrects two points in UI1 that came from a Bootstrap Studio 8 screenshot.
**Source:** the [screenshot pass](../bootstrap-studio/07-editor-screenshot-pass.md) (screenshot numbers below refer to `research/bootstrap-studio/screenshots/`), against Webforge's stories on `main` at 525f3c1.

**IP rule (unchanged):** we copy layout, colours, density and interaction patterns, which are conventions. We never copy Bootstrap Studio's code, CSS, icons, images, help text or wording. Icons stay Lucide; text stays our glossary; tokens stay our own values.

## 1. Corrections to UI1
UI1 was written from one Bootstrap Studio 8 screenshot. The running 9.0.1 app shows:

| # | UI1 says | 9.0.1 shows | Change |
|---|---|---|---|
| LF-1 | Magenta selection and hover outlines (`--selection-outline`) | **Hover and selection are accent blue**: a 1 px outline on hover, 2 px when selected, the name chip and the quick-actions bar in the same blue (04, 06, 22). **Magenta is the *Outline Grid***: a thin outline around rows and columns, on by default (57) | Hover, selection, the chip, the bar and the breadcrumb hover outline use `--primary`. `--selection-outline` is renamed `--grid-outline` and used by *Show outlines* and by 2.17's column outlines |
| LF-2 | Radial-gradient backdrop, page with a soft shadow | A **flat dark backdrop**; the stage sits **flush at the top** of the canvas area with its own scrollbar on the right, no shadow (07, 20) | Flat `--canvas-backdrop`, stage at the top, no shadow. The floating + stays |

## 2. Checklist
Effort: **S** ≤ 1 day · **M** 2–4 days. Grouped as the new plan item 1.39 builds them.

### 2.1 Canvas chrome
| # | Bootstrap Studio | Webforge today | Change | Effort |
|---|---|---|---|---|
| LF-3 | **Quick-actions bar:** a solid accent bar, 20 px tall, white 14 px icons, 2 px radius on top, sitting on the element's top-left corner outside it; tooltips on hover (04a, 27a) | Puck's dark action bar | Our own bar in `--primary` with white Lucide icons, same place; the **hover chip** (SP-1) in the same style: bold name, lighter label | S |
| LF-4 | **Stage toolbar order:** zoom in, zoom out, rotate, fit, view menu, colour-scheme menu, size readout on the left; the contextual toolbar in the centre; page dropdown and six device icons on the right (04d, 60a) | Page dropdown, devices, width, Fit, View on the left; readout on the right | Left: zoom in, zoom out, Rotate, Fit, View, width field with the readout. Centre: the contextual toolbars (SP-4). Right: page dropdown, Desktop · Tablet · Mobile | S |

### 2.2 Panels
| # | Bootstrap Studio | Webforge today | Change | Effort |
|---|---|---|---|---|
| LF-5 | **Tab strips:** bold sentence-case labels on the darker strip, the active tab on the panel's lighter background with no underline, a **magnifier at the right end** that opens that panel's search (02, 04b) | Uppercase labels with an underline | Sentence case, active tab lifted onto the panel background, magnifier that focuses the Add, Layers or Edit search | S |
| LF-6 | **Component panel:** bold collapsible categories with disclosure triangles; plain 20 px rows with a small page icon; the preview card on hover (02, 28) | Uppercase category headings and outlined "+ Section" buttons | Collapsible bold categories, plain rows with a Lucide icon per kind, no outlines; keep the preview card and favourites | S |
| LF-7 | **Two-column fields:** a muted label on the left (about 40 %), the control filling the right, 24 px rows; toggles as switches, alignment as a segmented control; group headers with a caret (11, 12, 51, 61) | Label above the field, about twice the height per field | Two-column rows in the Edit panel (Content, Style, Advanced) and Site Settings; group headers with a caret and SP-7's hover icons | M |
| LF-8 | **Box diagram** at the top of Appearance: margin and padding per side around the element, X Y W H below (04b) | None | *Optional:* a compact diagram at the top of the Style tab showing the element's size and its spacing tokens per side, clickable to the fields. Decide when 1.36's per-device rows land | S |
| LF-9 | **Overview rows:** 17 px, bold type, muted id or label, padlock on locked items (04c, 42a) | Layers rows close to this already | No change beyond SP-8…SP-10 | — |

### 2.3 Screens
| # | Bootstrap Studio | Webforge today | Change | Effort |
|---|---|---|---|---|
| LF-10 | **Start screen:** logo, name and version on the left with *New Design* and *Open*; on the right *Recent Designs* and *Tutorials* tabs, a search field, and a **card grid**: thumbnail, name, path, a version badge, last-opened date, pin and remove on hover (00) | A recent list with thumbnails (1.8) | The same two-column start screen: a card grid for recent sites (thumbnail, name, folder, last edited, pin, remove), a *Help* tab in place of Tutorials, search | S |
| LF-11 | **New Design dialog:** name and version at the left; *Starters* (Blank, +) and *Templates* with filter chips (All · Premium · Owned · Free), a sort menu and a *Details* link per card (01) | New Site asks name + theme; gallery with filter and sort (2.14, UX-29) | The same layout: name and theme on the left, a *Blank* starter row, the template grid with category chips and sort, *Details* opening a preview. 2.14, +1 day | S |
| LF-12 | **Settings:** one dialog with a grouped left nav (*Application:* Interface, Notifications, Preview, Themes, Backups, Devices, External Editors, Updates; *Design:* Bootstrap, SEO, Favicons, PWA, Meta Tags, Head Content, Export, Publish, Ecommerce), *Save / Cancel* (48, 48a–c) | Site Settings (1.17) and app settings are separate dialogs | One **Settings** dialog with two nav groups: *App* (Interface, Backups, Devices, Updates) and *This site* (General, Web address, Social, Contact, Search engines, Analytics, Forms, Publish). Site changes stay one undo step | S |
| LF-13 | **Title bar:** icon-only New, Open, Save and Settings with tooltips; Preview, Export and Publish as tinted icon split buttons; the native macOS menu bar carries File, Edit, View, Selection, Cloud, Help (07, 38–41) | Icon + text for New, Open, Saved, Preview, Export, Publish; File, Edit, View as text in the title bar | Icon-only buttons with tooltips and accessible names, split-button carets on Preview, Export and Publish. On macOS the menus live in the native menu bar and leave the title bar; on Windows the title bar keeps them | S |

### 2.4 Not copied
| Bootstrap Studio | Reason |
|---|---|
| Light dialogs on the dark UI | Ours follow the editor theme; mixing would look like two apps |
| Six device buttons | Desktop · Tablet · Mobile plus custom widths (UI1, T1) |
| The HTML and Styles drawer, the Appearance tab's CSS fields | Developer features; Site Check and Code stay in the drawer |
| *Online* tab, *Assistant* tab in the left column | Not in the MVP (UI1 §5; the v1.1 assistant has its own design, UX-28) |

## 3. Where it lands
- **New Phase 1 item 1.39 Look-and-feel pass** (stream A, 6 days): LF-1…LF-7, LF-10, LF-12 and LF-13; LF-8 if cheap once 1.36 is in; and the six UI5 items moved from 1.35 after it closed (SP-1, SP-2, SP-3, SP-8, SP-9, SP-10, +1 day). It runs after 1.37 and 1.36 so the two-column fields don't collide with the Edit panel tools.
- **2.14 Template format and New Site flow:** LF-11 (+1 day).
- 1.8 and 1.17 are closed, so their screens (LF-10, LF-12) are reworked by 1.39 rather than reopened.
- **UI1's note** gets the two corrections (LF-1, LF-2) and a pointer here; `--selection-outline` is renamed in the token table.

## 4. Decision
Decided by the product owner on 2026-10-23:

| # | Decision |
|---|---|
| **UI6** | ✅ **Copy Bootstrap Studio's look and feel as far as the IP rule allows:** LF-1…LF-13 as written (LF-8 optional), as plan item 1.39 (+5 days, 6 with the UI5 items moved from 1.35) and 2.14 (+1 day). Dialogs stay dark; the device set stays Desktop · Tablet · Mobile |

## Sources
- [Bootstrap Studio 9.0.1 screenshot pass](../bootstrap-studio/07-editor-screenshot-pass.md) and its screenshots
- [UI1 Editor look and feel](04-editor-look-and-feel.md), [UI2–UI5 Editor UI/UX parity](06-editor-ui-ux-parity.md)
- Webforge `main` at 525f3c1: `packages/engine/src/puck/chrome.tsx` (outline colours), `e2e/visual/__screenshots__/` (title bar, canvas toolbar, Add, Edit and Layers panels, the parity window)
