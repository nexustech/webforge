# Editor Look and Feel

**Status:** Decided 2026-10-20 (decision UI1). Implementation guidance for `packages/editor-ui` and `apps/desktop/src/renderer`
**Interaction details** (canvas, selection, panels, shortcuts) are proposed in [06-editor-ui-ux-parity.md](06-editor-ui-ux-parity.md).
**Amended 2026-10-23 (UI6, [07-look-and-feel-pass.md](07-look-and-feel-pass.md)):** the running 9.0.1 app shows **blue** hover and selection (magenta is its grid outline) and a **flat** backdrop with the stage flush at the top, so the magenta selection and the gradient below are superseded (LF-1, LF-2). That note lists the remaining visual gaps (LF-3…LF-13) as plan item 1.39.
**Goal:** Webforge's editor should feel familiar to Bootstrap Studio users: **same overall layout, dark professional colour scheme, dense panels, colour-coded main actions**. It keeps Webforge's own terminology ([01-terminology.md](01-terminology.md)), Simple/Advanced modes (T2) and shadcn/ui components ([stack/02](../stack/02-react-vs-svelte.md)).

**Sources:**
- a screenshot of Bootstrap Studio 8 (2026-10-20)
- the CSS custom properties in Bootstrap Studio 8.0.1's `app/assets/css/styles.css`, inspected locally for reference ([bootstrap-studio/01](../bootstrap-studio/01-tech-stack.md))

> **IP rule:** we copy the *ideas*: panel arrangement, dark palette, density and colour-coding. These are common conventions and colours aren't protectable. We **never copy Bootstrap Studio's stylesheet, icons, logo, images or text**. All CSS is written fresh as our own tokens. Icons come from **Lucide** (ISC). The app has its own name, logo and accent details so it can't be mistaken for Bootstrap Studio.

## 1. Layout

Bootstrap Studio's window and the Webforge equivalent:

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ ☰ New Open ● Saved │ ↶ ↷ │  [ Cadence · Site ⌘K command/search ]  │ ▣▣▣ │ Preview Export Publish │ – □ × │  Title bar (custom, 40px)
├──────────────┬────────────────────────────────────────────────────────────┬───────────────┤
│ ADD          │ [Cadence ×]                                                │ EDIT          │
│ Sections|Elem│ ┌ canvas toolbar: zoom · outlines · 1200×879 @100% · page ▾ · Desktop Tablet Mobile ┐
│ 🔍 Search    │ │                                                        │ Content|Style|│
│ ▸ Headers    │ │           ┌──────────────── page (white) ────────────┐ │ Advanced      │
│ ▸ Heroes     │ │           │                                          │ │               │
│ ▸ Features   │ │           │   selected element outlined (magenta)    │ │ "Select an    │
│ ▸ Pricing…   │ │           │                                          │ │  element to   │
├──────────────┤ │           └──────────────────────────────────────────┘ │  edit it"     │
│ LAYERS (Adv) │ │  dark radial-gradient canvas background          (+)   ├───────────────┤
│ UNDO HISTORY │ │                                                        │ SITE | THEME  │
│ ▾ Body       │ └────────────────────────────────────────────────────────┘ │ ▾ Pages       │
│  ▸ Header    │ ┌ bottom drawer (collapsible): Site Check | Code (Adv) ───┐ │ ▾ Media       │
│  ▸ Section…  │ └─────────────────────────────────────────────────────────┘ │ ▾ Fonts       │
│ ↑ ↓ ⧉ 👁 🗑   │                                                            │ ▸ Code (Adv)  │
└──────────────┴────────────────────────────────────────────────────────────┴───────────────┘
```

| Area | Bootstrap Studio | Webforge | Mode |
|---|---|---|---|
| **Title bar** (custom, frameless, 40 px) | Menu, New, Open, Save, Settings · Undo/Redo · central search box with design name · panel layout toggles · Preview / Export / Publish dropdowns · window controls | Same arrangement:<br>• Menu, **New**, **Open**, **save status** ("Saved" / "Saving…", click = Save version)<br>• Undo/Redo<br>• central **command palette** box showing site name<br>• left/right/bottom panel toggles<br>• **Design \| Content** mode toggle (M3)<br>• **Preview**, **Export**, **Publish** split-buttons<br>• window controls | Both |
| **Left top** | Component library: tabs *Studio / Online*, search, collapsible categories | **Add panel**: tabs **Sections \| Elements**, search, categories (Headers, Heroes, Features, Testimonials, Pricing, Contact…), drag or click to insert | Both (hidden in Content mode) |
| **Left bottom** | *Overview* (DOM tree) / *Assistant*; toolbar ↑ ↓ ← → duplicate · visibility · delete | **Layers** (tree, same toolbar) and **Undo History** tabs | Layers: Advanced. Undo History: both (T2) |
| **Centre top** | Document tabs (one per open design) | Site tab (one site per window in MVP; tab strip kept for future) | Both |
| **Canvas toolbar** | Zoom in/out, outlines, …, live size readout "1200px × 879px @ 100%", page dropdown, 6 device widths | Zoom, show outlines, size readout, **page dropdown**, **Desktop · Tablet · Mobile** (+ custom width) | Both |
| **Canvas** | Dark radial gradient around a white page iframe; selection outlines; floating round **+** button | Same: dark gradient backdrop, page iframe with soft shadow, **magenta selection / hover outlines** with a small label chip, floating blue **+** (opens Add panel at the insertion point). *Corrected 2026-10-23 (UI6, LF-1/LF-2): flat backdrop, stage flush at the top without a shadow, **blue** (`--primary`) hover and selection; magenta is the grid outline of* Show outlines | Both |
| **Bottom drawer** | *HTML* / *Styles* code editors | **Site Check** (Must fix · Should fix · Tips) and **Code** (Custom Code, Advanced) | Site Check: both. Code: Advanced |
| **Right top** | Inspector tabs *Appearance / Options / Animation*; empty state "No components selected" | **Edit panel** tabs **Content \| Style \| Advanced**; empty state *"Select an element to edit it"* | Advanced tab: Advanced mode |
| **Right bottom** | *Design* (Pages, Styles, JavaScript, Fonts, Images) / *Theme* | **Site** (Pages, Media, Code ▸ Advanced) / **Theme** (preset, brand colours, fonts, roundness; fonts moved here from Site on 23 Oct 2026) | Both |

**Panel behaviour:**
- Resizable splitters (react-resizable-panels, via shadcn *Resizable*).
- Each column can collapse.
- Sizes are remembered per user.
- **Reset Panels** command in the View menu.
- ~~Default widths: left 300 px, right 300 px. Top/bottom split in each column 60/40.~~ **Changed 2026-10-21 ([ADR 0008](../../docs/adr/0008-roomier-canvas-layout.md)):**
  - At 1280 px, two 300 px columns left the canvas about 290 px wide.
  - The window now **starts maximised** and remembers how the person leaves it.
  - **Side columns default to 240 px**, between 200 and 360 px, and the canvas keeps at least 40% of the width.
  - Each column shows **one panel at a time, as tabs**: its top-slot panels, then its bottom-slot panels. On the right, for example: Edit · Site.

## 2. Colour scheme: dark (default) and light

Values below are **our tokens**, chosen to match Bootstrap Studio's palette closely. They are expressed as shadcn/ui CSS variables so every shadcn component inherits them. A light theme is available in Settings, as in Bootstrap Studio.

### Dark (default)
| Token (shadcn / Webforge) | Hex | Used for | Bootstrap Studio reference |
|---|---|---|---|
| `--background` | `#2c3134` | App background | default background |
| `--panel` (custom) / `--sidebar` | `#2f3438` | Panel bodies | panel background |
| `--panel-group` (custom) | `#32373a` | Panel groups / column background | panel group background |
| `--tabs` (custom) | `#272d2f` | Tab strips (Add/Layers/Edit/Site headers) | tabs background |
| `--titlebar` (custom) | `#3b4248` | Title bar / menu bar | menu background |
| `--toolbar` (custom) | `#4d575f` | Canvas toolbar | toolbar background |
| `--canvas-backdrop` (custom) | radial-gradient(`#262a2d`, `#212527`) | Area around the page | canvas background |
| `--card` / `--popover` | `#24282b` | Menus, popovers, dialogs, code editor | editor background |
| `--input` | `#41474c` | Text fields, selects | input background |
| `--border` | `#3b4144` | Field borders, dividers | option border |
| `--border-strong` (custom) | `#24282b` | Outer panel borders | panel outer border |
| `--foreground` | `#ffffff` | Primary text | text colour |
| `--muted-foreground` | `#b3babd` | Field labels, secondary text | option label colour |
| `--tab-inactive` (custom) | `#97989a` | Inactive tab labels | inactive tab colour |
| `--primary` / `--ring` | `#0a6fb7` | Primary buttons, focus ring, active state, slider fill | active / focus outline |
| `--accent` | `rgba(10,111,183,0.34)` | Selected row in trees and lists | tree highlight |
| `--hover` (custom) | `rgba(255,255,255,0.05)` | Row hover | list item highlight |
| ~~`--selection-outline`~~ `--grid-outline` (custom) | `#fd66ff` | ~~Canvas selection/hover outline (magenta)~~ *Show outlines* and column outlines (renamed 2026-10-23, UI6 LF-1; selection and hover use `--primary`) | pink |
| `--destructive` | `#c83b3d` | Delete, close-hover | close-button hover |
| `--success` (custom) | `#28c174` | Export button, "Saved", success toasts | green |
| `--warning` (custom) | `#fba929` | Open button, Should-fix issues | yellow |
| `--info` (custom) | `#3bc0f7` | Preview button, links in panels | lighter blue |
| `--publish` (custom) | `#e23c81` | Publish button (pink cloud) | pink accent in title bar |
| `--scrollbar-thumb` (custom) | `#677073` (hover `#767f82`), 7 px wide | Thin scrollbars | scrollbar thumb |

**Colour-coded title-bar actions** (icons tinted; labels white):

| Action | Colour |
|---|---|
| New | white |
| Open | `--warning` amber |
| Save status | cyan `#31c5f0` |
| Preview | `--info` light blue |
| Export | `--success` green |
| Publish | `--publish` pink |
| Disabled | `#6e7880` |

### Light
| Token | Hex |
|---|---|
| `--background` | `#edf0f4` |
| `--panel` | `#f5f5f5` |
| `--tabs` | `#e5e9ef` |
| `--titlebar` | `#d4d8de` |
| `--card` | `#ffffff` |
| `--input` | `#ffffff` |
| `--border` | `#dadada` |
| `--foreground` | `#26292b` |
| `--muted-foreground` | `#676d75` |
| `--primary` | `#4898f2` |
| `--canvas-backdrop` | `#f0f0f0` |
| `--selection-outline` | `#f028f3` |
| `--warning` | `#ce7d00` |
| `--info` | `#0c86b4` |

These must be checked for WCAG AA contrast. Adjust light values where needed. The editor chrome has its own accessibility requirement (standards §4).

## 3. Typography, density, iconography
- **Font:** system UI stack (`system-ui, "Segoe UI", -apple-system, Roboto, sans-serif`), **13 px base**; 12 px labels, tree rows and toolbars; 11 px badges and size readouts; 14–15 px dialog titles. Code: system monospace, 12 px.
- **Density (compact):** shadcn defaults are roomy (14 px text, 36 px controls), so `packages/editor-ui` defines a **compact variant**:
  - controls **28 px** high (`h-7`), inputs 26–28 px
  - tree rows **24 px**, tab strips **32 px**, title bar **40 px**, canvas toolbar **36 px**
  - panel padding 8 px; gaps 4–8 px
  - radius **3–4 px** (small, like Bootstrap Studio), not shadcn's 8–10 px
- **Icons:** Lucide at 16 px (14 px in dense trees), stroke 1.75; tinted per the action colours above.
- **Tree items:** disclosure triangles, bold element type followed by its muted label (Bootstrap Studio shows "Navbar *Navbar Centered Links*"); a small badge for shared Header/Footer (C5) and a lock icon for locked items.
- **Canvas chrome:** 1 px ~~magenta~~ accent-blue outline on hover, 2 px on selection (UI6 LF-1), with a small label chip ("Section · Hero") and quick actions (move up/down, duplicate, delete) on the selected element, in a solid accent bar with white icons (LF-3).
- **Empty states:** centred muted text in panels ("Select an element to edit it", "Drag a section here").
- **Motion:** minimal, 100–150 ms fades and slides; respect *prefers-reduced-motion*.

## 4. How it maps to shadcn/ui and Tailwind
- `packages/editor-ui/src/theme.css` defines the tokens above with `@theme` + `:root[data-theme="dark"]` / `[data-theme="light"]`, plus the shadcn variable names (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar-*`).
- shadcn components used for the shell:
  - **Resizable** (columns/drawers)
  - **Tabs** (panel tab strips)
  - **Command** (title-bar palette)
  - **Menubar / DropdownMenu** (app menu, split buttons)
  - **Tooltip**, **Toggle Group** (device widths, Design/Content)
  - **ScrollArea** (thin scrollbars)
  - **Dialog / AlertDialog** (D7 confirmations)
  - **Sonner** (Undo toasts)
  - **ContextMenu** (canvas and tree)
  - Tree view: react-arborist or a custom tree on the same tokens.
- **Storybook:** every shell component has stories in **dark and light**, with a "Bootstrap Studio parity" story for the full window layout (screenshot-tested).
- **Site styles never mix with editor styles.** The canvas iframe is isolated (`syncHostStyles: false`, see [stack/04](../stack/04-canvas-engine.md)), so the dark editor theme can't leak into users' pages.

## 5. Differences from Bootstrap Studio (intentional)
| Bootstrap Studio | Webforge | Why |
|---|---|---|
| Save button | "Saved" status + Save version | Periodic autosave (P2) |
| Six device widths | Desktop · Tablet · Mobile (+ custom) | Simpler for DIY users (T1) |
| Overview always visible | Layers in Advanced mode; Undo History visible in Simple mode | T2 |
| Appearance / Options / Animation | Content · Style · Advanced | Glossary (T1/T4) |
| HTML / Styles drawer | Site Check (+ Code in Advanced) | Non-technical users (T1); X5 checks |
| Design / Theme panel incl. Styles & JavaScript files | Site (Pages, Media, Fonts; Code in Advanced) / Theme | Simple mode hides code |
| Online component library | Not in MVP | Scope |
| AI Assistant tab | Not in MVP | Scope |

## Decision
**UI1:** Webforge's editor adopts a Bootstrap Studio-like **layout, dark default colour scheme with a light alternative, compact density and colour-coded title-bar actions**, implemented with our own tokens on shadcn/ui and Lucide icons, adapted to Webforge's terminology and Simple/Advanced modes.

**Extended 2026-10-22 by UI2–UI4** ([06-editor-ui-ux-parity.md](06-editor-ui-ux-parity.md)): Bootstrap Studio's interaction patterns, Elements' Inspector and Theme Studio ideas in the MVP, and Bootstrap Studio's keyboard shortcuts as the standard. This adds custom device sizes and a Theme Studio window to the layout above.
