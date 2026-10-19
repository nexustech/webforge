# Editor UI Framework: React vs Svelte

**Status:** ✅ **Decided 2026-10-19: React.** Undo/redo design follows in [03-undo-redo.md](03-undo-redo.md)
**Decision:** **React + shadcn/ui** (Tailwind v4).
**Scope:** The *editor chrome*: toolbars, panels, layers tree, property inspector, dialogs, command palette. It does **not** cover the user's website. The canvas renders the user's plain HTML + Tailwind in a sandboxed iframe, which works the same under either framework.

## TL;DR

Both are excellent, and either would work. The deciding factors for Webforge are:

1. **Editor-specific libraries.** Visual builders lean on a handful of hard, specialised pieces: drag-and-drop, layer trees, resizable panels, rich-text editing and possibly a ready-made page-builder engine. React has mature, widely used options for every one of them. In Svelte, several are young (0.x), single-maintainer, or missing. The most significant gap: **Puck and Craft.js, the leading open-source visual-editor engines, are React-only.**
2. **Component suite and consistency.** Both have a shadcn-style suite built on Tailwind v4. The React original is the reference implementation, has the most blocks, themes and third-party extensions, and you already know it.
3. **Ease of change, with AI help.** Svelte code is shorter and its reactivity is simpler. But AI coding assistants still produce noticeably better React than Svelte 5 code (runes are newer, so assistants often write outdated Svelte 4 syntax). If you plan to build with AI help, that narrows Svelte's advantage.

Svelte's real wins (less code, simpler state, smaller bundle, faster updates) matter less inside an Electron app, where bundle size is irrelevant and the heavy rendering happens in the canvas iframe.

## Current state (October 2026)

| | React | Svelte |
|---|---|---|
| Latest | **React 19.3** (Sep 2026); **React Compiler 1.0** handles memoisation automatically | **Svelte 5.57** (Oct 2026); runes (`$state`, `$derived`, `$effect`) replaced the old `$:` and stores model |
| Model | Virtual DOM; components re-run on state change | Compiler + fine-grained signals; only affected DOM nodes update |
| Code volume | Baseline | Typically ~30–40% less code for the same UI |
| TypeScript | Excellent ergonomics | Good; props typing is a little more verbose |
| Popularity | Dominant usage; also tops "pain points" in State of JS | Smaller usage; consistently high satisfaction |
| Hiring / community | Largest by far | Small but enthusiastic |

## Requirement 1: Consistent layout and design

Both frameworks have a **shadcn-style** suite: copy-in source components built on accessible headless primitives and styled with **Tailwind v4**. This suits Webforge well, since the team will think in Tailwind all day.

| | React: **shadcn/ui** | Svelte: **shadcn-svelte** |
|---|---|---|
| Built on | Radix UI or Base UI primitives | Bits UI primitives |
| Editor-relevant components | Sidebar, Resizable, Tabs, Context Menu, Menubar, Command (palette), Dialog/Sheet, Popover, Tooltip, Toggle Group, Slider, Select/Combobox, Data Table, Sonner (toasts) | Same core set: Sidebar, Resizable, Context Menu, Command, Data Table, Combobox, Sonner, etc. |
| Missing from both | **Tree view** and **colour picker** need a separate library or a custom build | Same |
| Ecosystem around it | Very large: themes, block libraries, registries, many third-party extensions | Smaller, though the registry/CLI system is supported |
| Status | Reference implementation | Community port that tracks the React original; Svelte 5 + Tailwind v4 supported |

**Verdict:** Equal on the core components; **React** wins on the ecosystem around them.

Consistency comes mostly from the design tokens (CSS variables in the Tailwind theme) and from using the suite everywhere, not from the framework.

## Requirement 2: Suite of components we can easily integrate

These are the specialised pieces an editor needs beyond basic UI components:

| Need | React | Svelte | Framework-agnostic option |
|---|---|---|---|
| **Visual-editor engine** (palette → canvas → inspector) | **Puck** (MIT, ~12K★, inline editing, viewports, field config), **Craft.js** | No equivalent | **GrapesJS** (vanilla JS; works with either) |
| **Drag-and-drop** | **dnd-kit** (`@dnd-kit/react`), the de facto standard | `svelte-dnd-action`; `@dnd-kit/svelte` (new 0.x adapter, needs Svelte 5.29+) | `@dnd-kit/dom`, Atlassian Pragmatic DnD |
| **Layers / DOM tree** | `react-arborist`, `react-complex-tree` (virtualised, drag-to-reorder) | Few mature options; likely custom | — |
| **Resizable panels** | `react-resizable-panels` (used by shadcn) | PaneForge (used by shadcn-svelte) | — |
| **Rich-text inline editing** | Lexical, Tiptap (first-class React bindings) | Tiptap via community wrappers | ProseMirror, Tiptap core, Lexical core |
| **Code editor** (HTML/CSS view) | `@uiw/react-codemirror`, Monaco React | `svelte-codemirror-editor` | CodeMirror 6 |
| **Colour picker** | `react-colorful` and many others | `svelte-awesome-color-picker` | `vanilla-colorful` (web component) |
| **Command palette** | `cmdk` (shadcn Command) | shadcn-svelte Command (Bits UI) | — |
| **Node graphs** (maybe later, e.g. site map) | React Flow | Svelte Flow (same team) | — |
| **State management** | Zustand / Jotai / Redux Toolkit; undo via Immer patches | Built-in runes + classes; very clean for editor state | — |

**Verdict:** **React, clearly.** The biggest single factor is that choosing React keeps **Puck / Craft.js open as a canvas engine**. That's the next open question, and it could save months.

## Requirement 3: Easy to add changes

| Factor | React | Svelte |
|---|---|---|
| Readability of a panel component | Good; hooks and effects can get tangled | **Excellent**: less boilerplate, clearer reactivity |
| Editor state (big, deeply nested model; frequent small updates) | Needs discipline: stores + selectors to avoid re-rendering the whole inspector on each keystroke (the Compiler helps) | **Natural fit**: fine-grained reactivity updates only what changed |
| Performance of busy panels (layers tree with thousands of nodes) | Fine with virtualisation + memoisation | Fine, with less effort |
| AI coding assistance | **Strong**: huge training corpus, consistent patterns | Weaker: assistants often mix Svelte 4 and 5 syntax (Svelte publishes `llms.txt` docs that help) |
| Your current knowledge | Some React; already used with shadcn/ui elsewhere | Learning curve (small, but real for runes and edge cases) |
| Learning resources | Abundant | Good official docs/tutorial; fewer advanced editor-type examples |

**Verdict:** Svelte is nicer to write; React is easier to get *help* with and has more examples of exactly this kind of app. It's roughly a draw, tilted to React by your experience.

## Electron fit
Both work well with **Vite** inside Electron, through Electron Forge's Vite template or `electron-vite` (which has React and Svelte templates). There's no meaningful difference. Svelte's smaller bundle doesn't matter for a locally installed desktop app.

## Scorecard

| Criterion (weight) | React | Svelte |
|---|---|---|
| Consistent layout & design (high) | ●●●●● | ●●●●○ |
| Integrable component suite (high) | ●●●●● | ●●●○○ |
| Editor-specific libs / canvas engine option (high) | ●●●●● | ●●○○○ |
| Ease of change: code clarity (medium) | ●●●●○ | ●●●●● |
| Ease of change: AI assistance & examples (medium) | ●●●●● | ●●●○○ |
| Existing knowledge (medium) | ●●●●○ | ●●○○○ |
| Runtime performance in editor (low–medium) | ●●●●○ | ●●●●● |
| Bundle size (low, Electron) | ●●●○○ | ●●●●● |

## Recommended baseline (if React)
- React 19 + TypeScript + Vite, with the **React Compiler** on
- **shadcn/ui** on Tailwind v4, with a Webforge theme defined as CSS-variable tokens (light/dark)
- **Zustand** (or Jotai) for editor state, **Immer** patches for undo/redo, **TanStack Query** if any remote data
- **dnd-kit**, **react-resizable-panels**, **react-arborist**, **CodeMirror 6**
- Keep the **document model framework-agnostic**: plain TypeScript classes/JSON, rendered to HTML for the canvas. Then the UI framework never leaks into saved projects or exported sites. This is the key lesson from Bootstrap Studio's component tree.

## Open questions
1. **Canvas engine (stack question #3) is now coupled to this choice.** If Puck or Craft.js is a serious contender, React is effectively decided. Need to check:
   - Puck renders *React components* as the page. Can it produce plain static HTML + Tailwind cleanly (e.g. `renderToStaticMarkup` at export)?
   - Do its data model and inline editing fit Webforge's "non-technical user, click-to-edit text" goal?
   - If GrapesJS (vanilla) wins instead, the framework choice reopens.
2. **Radix vs Base UI flavour of shadcn/ui.** shadcn now supports both. Which primitives are better maintained going forward?
3. **Tree view and colour picker:** pick libraries or build them (neither suite includes them).
4. ~~**Editor state architecture.**~~ → Proposed in [03-undo-redo.md](03-undo-redo.md): Zustand + Immer patches with a custom history manager.
5. **Isolation of editor styles vs site styles.** Both use Tailwind. Confirm the canvas iframe fully isolates the user's Tailwind build and theme from the editor's.
6. **Accessibility and keyboard shortcuts** across panels (Radix/Base UI focus management + a shortcut manager).
7. **Spike to validate (1–2 days per option):** build the same three-pane shell (layers tree with drag-to-reorder · iframe canvas with click-to-select · property inspector bound to the model) in React + shadcn/ui and, if still curious, Svelte + shadcn-svelte. Compare code size, how it felt and AI-assist quality. If Puck is in contention, spike it instead of a hand-built canvas.

## Sources
- [shadcn-svelte docs](https://shadcn-svelte.com/docs) (built on Bits UI + Tailwind; component list)
- [dnd-kit: Svelte adapter docs](https://mintlify.wiki/clauderic/dnd-kit/frameworks/svelte) · [@dnd-kit/svelte README](https://cdn.jsdelivr.net/npm/@dnd-kit/svelte@0.5.0/README.md)
- [Puck: open-source visual editor for React (EveryDev listing)](https://www.everydev.ai/tools/puck) · [Show HN: Puck](https://hn.svelte.dev/item/44115590)
- [Svelte 5 vs React in 2026: an honest comparison after shipping both](https://alexcloudstar.com/blog/svelte-5-vs-react-2026/) (June 2026)
- [State of JS 2025: front-end frameworks](https://2025.stateofjs.com/so-SO/libraries/front-end-frameworks/)
- [React version history (versionlog)](https://versionlog.com/react/) · [Svelte releases](https://releases.sh/svelte/svelte-releases.md)
- Library facts for react-arborist, react-resizable-panels, PaneForge, Tiptap, Lexical, CodeMirror 6, GrapesJS and React/Svelte Flow are from general knowledge and should be re-checked during the spike.
