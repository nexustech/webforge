# Bootstrap Studio 9.0.1: Editor Screenshot Pass

**Status:** ✅ Decided 2026-10-23 (UI5: SP-1…SP-13 adopted, see [§5](#5-decisions))
**Date:** 2026-10-23
**Question:** The editor UI/UX parity note ([product/06](../product/06-editor-ui-ux-parity.md)) was written from docs and UI strings, and left one item open: a screenshot pass of the running app, to check the visual details the docs don't describe (hover outlines, drop indicators, toolbar icons) against what Webforge built for items 1.30–1.34, 1.37 and 1.38, and to feed the open items 1.35, 1.36 and 2.17.

## 1. Method and limits
- **App:** Bootstrap Studio 9.0.1 on macOS, driven through the Claude desktop app's computer use (screenshots, clicks, keys). Version 9.0.0 was open at the start; the pending update installed when the app restarted.
- **Design:** a new design from the free *Freelancer* template (navbar, hero header, a portfolio grid of columns, text columns, a contact form, a footer with icons). It was never saved, so nothing on the machine changed. The product owner's own design was not opened.
- **Screenshots:** 85 files in [`screenshots/`](screenshots/), numbered in the order they were taken, 1372 × 888 (the window maximised on a 1440 × 900 point display). Filenames say what each one shows; the index in [§6](#6-screenshot-index) groups them. They are **internal reference only**: the IP rule stands, we copy interaction patterns and never Bootstrap Studio's icons, images, CSS or wording.
- **Webforge:** the editor on `main` at 2d65e4d (23 Oct 2026), compared through the Storybook screenshots in `e2e/visual/__screenshots__/` and the canvas chrome in `packages/engine/src/puck/`.
- **Limits:**
  - One template, one page, no CMS data, no linked components, so the Overview's *linked* indicator and the CMS loop UI were not seen.
  - Background (accessibility) control could not reach the inspector tabs, menus or hover states; the pass needed full-screen control.
  - A few things were not captured: the *Online* tab of the component panel (its click didn't register), the font family dropdown, and *Add Comment* (the menu item under the pointer was *Add Custom Options*).
  - Bootstrap Studio's dialogs are light even in the dark UI (*Dialog Theme: Light* is the default); Webforge's are dark. Noted, not proposed.

## 2. What the running app shows

### 2.1 Canvas and selection
| What | Bootstrap Studio 9.0.1 | Screenshots |
|---|---|---|
| Hover | A **1 px blue outline** and a **name chip** at the top-left corner of the hovered element, always on: `Header`, `Navbar Collapse #navbarResponsive`, `Image profile.png`. The chip shows the type in bold and the id or file name in a lighter weight | 03, 06, 58a |
| Selection | A 2 px blue outline and a **quick-actions bar** above the top-left corner, outside the element, blue with white icons and tooltips (*Move*). Icons: move, select parent (↑), edit (pencil, text and images only), resize margin/padding, duplicate, hide, delete. Elements that can't be moved (HTML, Body) show only their name | 04, 04a, 22, 27a |
| Multi-select | Ctrl/Cmd + click: every element gets its own outline, one bar with move, duplicate, hide and delete (no parent, no edit); both rows highlighted in the Overview | 55 |
| Show Box Model (hover) | Margin tinted **yellow-khaki**, padding **green**, like browser devtools, and the chip gains the element's size: `Image profile.png  256 × 256` | 18 |
| Resize margin/padding | A **mode**, entered from the bar's fourth icon: short yellow (margin) and green (padding) handle bars in the middle of each side, plus two dropdowns at the element's top-left, *Utility Class ▾* and *All ▾* (whether the drag writes a Bootstrap utility class or the style, and for which breakpoint). Esc leaves the mode | 27 |
| Outline Grid | On by default: a thin magenta outline around rows and columns (the grid), not around every element | 57, 60 |
| View menu | Four toggles: Outline Grid (on), Show Box Model (off), Show Comments (on), Extra Whitespace (off) | 13 |
| Colour-scheme menu | *Preview Mode: Default / Light / Dark* (Bootstrap's `data-bs-theme`) | 14 |
| Size readout | `992px × 979px @ 100% ▾`; clicking it lists named phones with sizes (OnePlus 12, Galaxy S23…) and *Add Device* lives in Settings › Devices | 15, 48c |
| Device buttons | Six breakpoint icons (360, 576, 768, 992, 1200, 1400) at the right of the stage toolbar, next to the page dropdown (`index.html ▾`: the pages, *New Page*, *New Template Page*). At 1400 px the stage is wider than the canvas and scrolls sideways; no auto-fit | 16, 17, 54 |
| Zoom | Zoom in, zoom out, rotate (flip width and height), fit to canvas; zoom out steps to 75 %, fit fills the canvas (1516 px) | 04d, 19, 20 |
| Contextual toolbars | The **centre of the stage toolbar changes with the selection**: Navbar (*Open*, *Add to Navbar: Nav, Span, Link, Button, Dropdown*), Heading (*H1–H6*), Link (*Toggle Target*), Column (*Column Position ← →*, *Column Size < > > <*, *Add Column Before / After / End*), List (*Style: Inline (UL) ▾*, *Add to List: Before / After / End*, *Item*, *Delete*) | 05, 22, 58, 60, 60a, 70 |
| Inline text editing | Double-click: the text block gets a dark outline and the stage toolbar becomes a text toolbar (bold, italic, underline, strike, link, colour, highlight, sub, sup, special character, clear) with **Apply** and **Discard**; nothing lands until Apply | 24 |
| Right-click on the stage | *Heading* (title), Select Parent, Edit, Label.. ⌘L, Copy & Paste ▸, Change to ▸, Add to Library, Add Comment, Add Custom Options, Convert to HTML, Duplicate ⌘D, Hide ⌘/, Delete | 21 |
| Breadcrumbs | None on the stage. The Appearance tab has a row of ancestor chips (HTML · Body · Header · Container · Image) that picks the **style target**, and the *Style Attribute ▾* dropdown offers *Create CSS Block..* | 04b, 65 |
| Drag feedback | From the Overview onto the stage: a **1 px blue line** at the drop point with the dragged element's chip (`Hr`); in the tree, a thin line between rows. Dropping a tree row onto the component panel opens *Create New Component* (add to library) | 25, 26 |
| Keyboard | Esc deselects. ⌘D duplicates, ⌘/ hides, ⌘L labels, F2 renames pages. *Help › Keyboard Shortcuts* opens the web page in the browser, not a sheet | 33, 35, 37 |

### 2.2 Panels
| What | Bootstrap Studio 9.0.1 | Screenshots |
|---|---|---|
| Component panel | *Studio / Online* tabs, search, collapsible categories (UI › Articles, Call To Action, Contacts…; Media; Navbars…). Hovering an item shows a **preview card**: thumbnail, name, one-line description. Right-click: *Insert Into Section*, *Add To Favorites*. A **Suggested** group appears at the bottom with what fits the selection (*Nav, Span, Link, Button* for a Navbar Collapse; *Row* for a Container; *Navbar Brand, Toggle, Collapse* for a Navbar) | 02, 05, 28, 29 |
| Overview | Bold type, muted id or label; padlock on HTML and Body; a hidden element gets an **eye-slash icon** after its name and the toolbar's eye icon toggles. Toolbar: up, down, outdent (←), indent (→), duplicate, hide, delete. The magnifier opens a filter that **highlights matches in yellow** and keeps their ancestors. Hovering a row outlines the element on the stage with its chip | 04c, 42, 42a, 68, 03 |
| Overview right-click | As the stage menu, minus Edit, plus *Expand / Collapse ▸*; *Change to ▸* lists Div, Footer, Section, Aside, Article | 23 |
| Inspector tabs | *Appearance / Options / Animation / CMS* and a magnifier. Appearance: style-target chips, box-model diagram with X Y W H, then groups (Layout, Font, Background, Border, Box Shadow, Text Shadow, Positioning, Transform…). Every group header has three hover icons: **copy, paste, reset**. A field with a ▸ expands into sub-fields (Font Size → Line Height) | 04b, 11, 12, 63 |
| Options tab | Per component: Image Options (Source URL, Alt, Lazy Loading, Aspect Ratio, Object Fit, Style, toggles), Column Options, Text Options, then Styling, Display & Sizing, Flexbox, Margin & Padding, Tooltip | 08, 51, 61 |
| Per-breakpoint values | Expanding a ▸ on an option shows **one row per breakpoint** (SM, MD, LG, XL, XXL). Rows with a value are coloured accent blue; the breakpoint in effect at the stage width carries a **dot** (`LG •`) | 62, 62a |
| Options search | Typing in the inspector's search highlights matching group titles and labels in yellow and opens their groups | 67 |
| Animation tab | Effects (Trigger: Never), View Transitions (Transition Name) | 09 |
| CMS tab | Conditional Visibility (*Add Condition*), Conditional Classes (*Add Class*) | 10 |
| Design panel | A tree: Pages, Styles, JavaScript, Fonts (with padlocks), Images (folders), CMS. Page right-click: Copy & Paste ▸, Copy to ▸, Copy Path, Cut, Duplicate ⌘D, Rename F2, Move to Folder ▸, **Hide in Export**, Export, Properties. Fonts right-click: Manage Fonts, Import Webfont | 45, 52, 53 |
| Theme tab | Light/Dark toggle, Theme Colors (Primary…Dark as hex + swatch), text and background colours, Text (family, size, weight, line height), Borders, Focus Ring: Bootstrap's variables as a form | 44, 44a, 44b |
| Assistant | A panel with *Setup*, *Ask assistant..*, *+* and send, *Select Model ▾*, *Usage ▾* | 31 |
| Collapsed columns | The title bar's toggles collapse a column to a **strip of panel icons** (six on the right, three on the left); clicking one re-opens the column on that panel | 46, 47 |
| Bottom drawer | HTML (a tree of the markup with a find field) and Styles (matching rules with their source, *Create*, *Force State*, *Show*) | 02, 56 |

### 2.3 Title bar, menus and dialogs
| What | Bootstrap Studio 9.0.1 | Screenshots |
|---|---|---|
| Title bar | New, Open, Save, Settings icons · undo, redo, **history caret** · search box with the design name · three panel toggles · Preview, Export, Publish as icon-only split buttons, tinted | 07, 38–41 |
| Undo list | The caret lists every step (*Duplicate Component* ✓, *Open Design*) | 41 |
| Command palette | ⌘P: a search field, then commands with a category prefix (*Page: Properties*, *File: New Design* ⌘N) and three expression commands with *help* badges (`make [file]`, `lorem [number]`, `add [expression]`) | 30 |
| Menus | File, Edit (Undo History ▸, Find and Replace ⌘F), View (Full Screen, Zoom, UI Scaling ▸, Stage ▸, Command Palette ⌘P, Reset Panels, Detach Editors), Selection (Label.. ⌘L, Find in Design Panel, Add to Library, Add Comment, Add Custom Options, Convert to HTML, Duplicate ⌘D, Hide ⌘/, Delete), Cloud, Help | 32–37 |
| Settings | A left nav: Application (Interface, Notifications, Preview, Themes, Backups, Devices, External Editors, Updates) and Design (Bootstrap, SEO, Favicons, PWA, Meta Tags, Head Content, Export, Publish, Ecommerce); Save / Cancel. Interface: Dark/Light cards, dialog theme, scrollbar width, title-bar style | 48, 48a–c |
| Check for Issues | One row per rule with a green, yellow or red dot, a one-line verdict, an expander for details and inline actions (*Add Favicons*, *Fix*); *Check* and *Close* | 49 |
| Colour picker | Tabs *Select / Design / Favorites / Library*; a saturation square, hue and alpha sliders, eyedropper, format dropdown (RGB), text value, a heart to favourite; *Select / Cancel*. Under every colour field, a row of **quick swatches** (theme colours and *…*) | 50, 11 |
| Image browser | *Choose an Image*: Local / Unsplash / Pexels / Pixabay tabs, *Find image*, folder dropdown, a grid with folder cards and `256x256, 10 KB` captions, *Import Image*, OK / Cancel | 43 |
| Icon browser | *Choose an Icon*: set dropdown (Font Awesome 4…), search, a grid of icon + class name | 69 |
| Label | *Change Component Label*: one field, "Labels are shown next to the component in the Overview panel" | 66 |
| New Design | Name, Bootstrap version, Starters (Blank, +), Templates with All / Premium / Owned / Free chips, sort, *Details* links | 01 |

## 3. Webforge today, checked against the screenshots
Items 1.30–1.34, 1.37 and 1.38 are merged. What they built, against what the running app does:

| UX item | Webforge on `main` | Verdict |
|---|---|---|
| UX-1 quick actions | Chip with move up/down, duplicate, delete, plus Edit, Hide and Select parent (1.30) | ✅ Matches. Bootstrap Studio's bar is icons only with tooltips; ours too |
| UX-2 keyboard navigation | Mod + arrows, Enter/Backspace for text, F2 rename (1.30) | ✅ Matches |
| UX-3 multi-select | Canvas and Layers, acting as one step (1.31) | ✅ Matches, including one bar for the group |
| UX-4 Mod + drag copies | Drag with Ctrl/Cmd copies, Shift makes a linked copy (1.30 part 3) | ✅ |
| UX-5 spacing handles | Handles on the selected element, snapping to tokens, live readout, Shift / Ctrl+Shift, Alt-click resets (1.32) | ✅ Ours is simpler (no mode, no utility-class choice). Keep. See SP-3 for colours |
| UX-7 view options | *Show outlines*, *Show spacing on hover*, *Show element names*, *Extra space at the bottom* (1.33 part 2) | ✅ Same four ideas. See SP-1 and SP-2 |
| UX-8 stage sizing | Devices, Rotate, edge-drag sizing, Fit (1.33 part 1) | ✅ |
| UX-9 breadcrumbs | A breadcrumb bar under the canvas toolbar; hovering a crumb outlines the element (1.30 part 2) | ✅ Bootstrap Studio has no stage breadcrumbs; its ancestor chips pick the style target instead. Ours is the better fit for selection |
| UX-10 Add panel | Favourites, recents, previews on hover (1.34) | ✅ See SP-12 for the *Suggested* group |
| UX-11 command palette | Grouped: Commands, Go to page, Add (1.34) | ✅ |
| UX-14 copy style | Copy and paste an element's style (1.37 part 3) | ✅ See SP-7 for per-group icons |
| UX-15 pickers | One picker dialog; the image field opens it (1.37 part 1) | ✅ Same shape as *Choose an Image*; stock tabs come with G26 |
| UX-16 undo list | *Undo back to…* beside Undo (1.37 part 2) | ✅ |
| UX-25 colour | Theme colours first, with shades (1.37 part 4) | ✅ |
| UI3 shortcuts | Shortcut standard and sheet (1.38) | ✅ Bootstrap Studio sends people to a web page; a sheet is better |
| Hover | 1 px magenta outline; names only with *Show element names* | ⚠️ Bootstrap Studio always shows the name chip on hover. See SP-1 |
| Layers | Hidden rows struck through with an eye-slash; linked copies with a link icon; a filter field; up, down, duplicate, show/hide, rename, delete, expand/collapse (1.24, 1.29) | ✅ Richer indicators than Bootstrap Studio's. Drop feedback and the menu come with 1.35 |

## 4. Proposals
Small additions that fit the open items. Effort: **S** ≤ 1 day.

| # | Proposal | Seen in | Item | Effort |
|---|---|---|---|---|
| SP-1 | **Name chip on hover, always on.** The hovered element shows its name (and its own label, if any) in a small chip at its top-left corner, as the selected element's bar does. *Show element names* keeps showing every name at once | 03, 06, 58a | 1.39 (moved from 1.35) | S |
| SP-2 | **Size in the hover label** when *Show spacing on hover* is on: `Image · 256 × 256` | 18 | 1.39 (moved from 1.35) | S |
| SP-3 | **Margin and padding colours.** The spacing-on-hover overlay and the spacing handles use the devtools convention: margin a warm tint, padding a green tint, so people learn one meaning | 18, 27 | 1.39 (moved from 1.35) | S |
| SP-4 | **Contextual toolbars in the canvas toolbar's centre,** not floating on the canvas: the Columns toolbar (2.17) and, with the elements, *Heading level* (H1–H3 as *Title / Heading / Subheading*) and *Add item* for lists and menus. The centre is empty today | 05, 22, 60, 70 | 2.17 (Columns), 2.9 (Heading, List) | S each |
| SP-5 | **Per-device rows.** Expanding a field with a per-device value shows one row per device (Desktop, Tablet, Mobile); a row with its own value has an accent label; the device in effect carries the dot. This sharpens UX-19: the dot beside the label stays the quick cue | 62, 62a | 1.39 (moved from 1.36) | S |
| SP-6 | **Search highlights.** The Edit panel's search opens the groups that match and highlights the matching labels | 67, 68 | 1.39 (moved from 1.36) | S |
| SP-7 | **Group header icons on hover:** copy, paste and reset for the group, so *Copy style* also works per group | 11, 12 | 1.39 (moved from 1.36) | S |
| SP-8 | **Drop indicator:** a 1 px accent line between Layers rows while dragging, mirrored on the canvas with the dragged element's chip at the drop point | 25 | 1.39 (moved from 1.35) | S |
| SP-9 | **Select parent** in the right-click menu, on the canvas and in Layers (it's on the chip and Mod + ↑ already) | 21, 23 | 1.39 (moved from 1.35) | S |
| SP-10 | **Hovering a Layers row outlines the element** on the canvas with its chip, as breadcrumbs do | 03 | 1.39 (moved from 1.35) | S |
| SP-11 | **Collapsed column = icon strip** (confirmed as planned in 1.36 / UX-22): one icon per panel; clicking it re-opens the column on that panel | 46, 47 | 1.36 | S |
| SP-12 | **Suggested group in the Add panel:** elements that fit inside the selected section or element, under *Suggested*, above the categories | 05, 27 | 2.9 | S–M |
| SP-13 | **Traffic-light dots in Site Check:** a green, amber or red dot per rule beside Must fix / Should fix / Tips, with the one-line verdict and inline *Fix* | 49 | 3.6 | S |

### Not proposed
| Bootstrap Studio | Reason |
|---|---|
| *Apply / Discard* text editing | Ours is live and undoable, which is simpler for the audience |
| *Utility Class / All* dropdowns on the spacing handles, the *Style Attribute / Create CSS Block* target chooser, *Change to* (tag), *Convert to HTML*, *Add Custom Options*, the HTML and Styles drawer | Developer features |
| Dropping a Layers row onto the component panel to make a library component | Shared sections (F-ED-23) are saved from the menu instead |
| *Preview Mode: Light / Dark* on the stage | Webforge has light and dark section variants (2.4), not a site-wide mode |
| Light dialogs in the dark UI | Our dialogs follow the editor theme |
| Comments (*Add Comment*, *Show Comments*) | Stays v1.1 (UX-17, UI4) |

## 5. Decisions
Decided by the product owner on 2026-10-23:

| # | Decision |
|---|---|
| **UI5** | ✅ **SP-1…SP-13 are adopted as written.** They join the plan items they fit: 1.39 takes SP-1, SP-2, SP-3, SP-8, SP-9 and SP-10 (+1 day; they were recorded on 1.35 first, which had already closed, and moved the same day); 1.39 also takes SP-5, SP-6 and SP-7 (+1 day; moved from 1.36 on 23 Oct, whose PR predated them); 1.36 keeps SP-11, which its PR builds; 2.17 takes SP-4's Columns toolbar placement; 2.9 takes SP-4's Heading and List toolbars and SP-12 (+1 day); 3.6 takes SP-13. About +3 days in all. Spec F-ED-25 and F-ED-26 are extended |

## 6. Screenshot index
All in [`screenshots/`](screenshots/).

| Files | What they show |
|---|---|
| 00–01 | Start screen (Recent Designs, Tutorials); New Design dialog |
| 02–07 | Default layout (editor drawer open, right column collapsed); hover label; Header selected with the quick-actions bar; zooms of the bar, Appearance panel, Overview toolbar and stage toolbar; Navbar selected with its contextual toolbar; the maximised window |
| 08–12 | Options tab; Animation tab; CMS tab; Appearance groups (font, background, border; shadows, positioning, transform) |
| 13–20 | Stage view menu; colour-scheme menu; size presets; phone and 1400 px widths; box model on hover; zoomed out; fit to canvas |
| 21–24 | Stage context menu; Heading selected with H1–H6 toolbar; Overview context menu; inline text editing |
| 25–31 | Drag-and-drop indicator (tree and stage); Create New Component dialog; tooltip; resize margin/padding mode; component hover preview; component context menu; command palette; Assistant panel |
| 32–41 | File, Edit, View, Selection, Cloud and Help menus; Preview, Export and Publish split-button menus; undo list |
| 42–49 | Hidden-element indicator; image browser; Theme tab (three scroll positions); Design panel with fonts; both columns collapsed to icon strips; Settings (Bootstrap, Interface, Themes, Devices); Check for Issues |
| 50–56 | Colour picker; Options tab for an image; Fonts and page context menus; page dropdown; multi-select; bottom HTML and Styles drawer |
| 57–63 | Column outlines; Link selected; column hover label; Custom Options popover; Column toolbar and options; per-breakpoint rows; Font Size expanded |
| 64–70 | Footer; style-target dropdown; Label dialog; options search; Overview filter; icon browser; List toolbar |

## Sources
- Bootstrap Studio 9.0.1, installed on this Mac, driven on 2026-10-23
- [product/06 Editor UI/UX parity](../product/06-editor-ui-ux-parity.md) (UX-1…UX-29, UI2–UI4) and [product/04 Editor look and feel](../product/04-editor-look-and-feel.md) (UI1)
- Webforge `main` at 2d65e4d: `packages/engine/src/puck/chrome.tsx`, `spacing-handles.tsx`, `view-options.ts`; `apps/desktop/src/renderer/layers/LayersPanel.tsx`; Storybook screenshots under `e2e/visual/__screenshots__/`
