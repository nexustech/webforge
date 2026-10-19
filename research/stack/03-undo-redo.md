# Undo / Redo Design

**Status:** Design agreed 2026-10-19 (see [Decisions](#decisions)); remaining open questions below
**Context:** React is decided for the editor ([02-react-vs-svelte.md](02-react-vs-svelte.md)). Undo/redo is a core requirement and must feel **seamless** to non-technical users. This has to be designed into the state layer from day one; it can't be retrofitted.

## What "seamless" means for Webforge

| # | Requirement | Example |
|---|---|---|
| U1 | **Every change to the site is undoable** | Add/move/delete/duplicate a component, change a property or style, edit text, add/rename/delete a page, import/replace/delete an image, change the theme |
| U2 | **One user action = one undo step** | A drag-and-drop is one step, not 60 mouse-move steps. Scrubbing a spacing slider is one step. A whole text-editing session is one step (D1) |
| U3 | **Undo shows you what changed** | Restores the selection, switches to the right page/breakpoint, and scrolls the canvas to the affected element |
| U4 | **Same shortcut everywhere** | Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y, and toolbar buttons behave the same whether focus is on the canvas, layers tree or inspector |
| U5 | **Text editing behaves like a word processor** | While typing in a heading, Ctrl+Z undoes the last few words. After you click away, one Ctrl+Z undoes the whole text edit |
| U6 | **UI changes are not undo steps** | Selecting, hovering, zooming, switching breakpoint, resizing panels and opening preview don't fill the history |
| U7 | **Fast and memory-safe** | Instant even on large sites; bounded history (e.g. last 200 steps) |
| U8 | **Never corrupts the project** | Undo-all must return *exactly* to the starting state. Derived data (compiled Tailwind CSS, thumbnails, preview) is always rebuilt from the model, never stored in history |
| U9 | **Plays well with save** | ~~Dirty marker clears when undoing back to the saved point~~ → **superseded by periodic autosave** ([06 P2](06-project-file-format.md#decisions-2026-10-19)): undo history simply continues across autosaves |

## Approaches compared

| Approach | How it works | Pros | Cons | Used by |
|---|---|---|---|---|
| **A. Snapshots** | Store a copy of the whole document after each action (cheap with immutable data + structural sharing) | Simplest; nearly impossible to get wrong | Hard to tell *what* changed (for dirty tracking, scroll-to-change, autosave diffs); memory grows with big asset metadata | `zundo` (Zustand middleware, default mode), Puck's built-in history |
| **B. Patches** ✅ | Each action runs as an immutable "draft" mutation. The library emits forward + inverse JSON patches. Undo applies the inverse | Small entries; you know exactly which nodes/pages changed; supports coalescing; same patches can drive autosave, dirty tracking and (later) collaboration | Slightly more machinery; patches must only touch the document store | Immer `produceWithPatches` / Mutative; Instatic visual editor; Redux Toolkit pattern |
| **C. Command pattern** | Each command class implements `do()` and `undo()` by hand | Full control; meaningful names in history | Every command needs a hand-written inverse, a common source of subtle bugs | Bootstrap Studio's `ActionManager`, classic desktop apps |
| **D. CRDT** | Document is a Yjs/Automerge CRDT; its UndoManager tracks local changes | Real-time collaboration for free | Heavy; changes how the whole model is built; overkill for a single-user desktop app | Many collaborative editors |

**Recommendation: B (patches), wrapped in named commands.** You get C's readability (`history.run("Move section", draft => …)`) without hand-writing inverses, because Immer generates them. If real-time collaboration ever becomes a goal, the patch stream is a natural bridge to a CRDT later.

## Proposed architecture

```
┌──────────────── Document store (Zustand + Immer) ────────────────┐
│  pages, component trees, styles/tokens, assets metadata, settings │  ← ONLY thing in history
└──────────────────────────────────────────────────────────────────┘
          ▲ history.run(label, recipe, {coalesceKey?})
          │
┌─────────┴──── History manager ─────┐     ┌──── UI store (Zustand) ─────────────┐
│ past[]  / future[]                 │     │ selection, hover, zoom, breakpoint, │
│ entry = { label, forward, inverse, │     │ open panels, current page           │  ← never in history
│   coalesceKey, selectionBefore,    │     └─────────────────────────────────────┘
│   selectionAfter, pageId, ts }     │
│ begin()/commit()/cancel() for      │     Derived (recomputed, never stored):
│ gestures (drag, slider scrub)      │     Tailwind CSS · canvas HTML · thumbnails
└────────────────────────────────────┘
```

**Key rules**
1. **All document edits go through `history.run(...)`.** No component, panel or plugin mutates the document store directly. Enforce this with a lint rule / typed API.
2. **Each history entry stores selection-before and selection-after**, plus the page and breakpoint. Undo/redo restore these and scroll the element into view (U3).
3. **Gestures are transactions.** On drag start or slider press, call `history.begin("Move Hero")`. Intermediate updates apply live but aren't recorded. `commit()` stores one entry; `cancel()` (Esc) reverts everything (U2, like tldraw's marks + bail).
4. **Coalescing.** Consecutive edits with the same `coalesceKey` (e.g. `prop:<nodeId>:padding`) within ~1 s merge into one entry: the oldest inverse and the newest forward per path are kept. Any undo/redo or a different action breaks the chain.
5. **Inline text editing (U5)** has two layers:
   - *While editing:* the text editor (Tiptap/ProseMirror or a controlled `contenteditable`) keeps its **own local history**, so Ctrl+Z undoes words.
   - *On blur / Enter / Esc:* the whole session is committed as **one** document entry ("Edit text"). If local history is empty, Ctrl+Z falls through to the document history.
   - Never rely on the browser's native `contenteditable` undo: intercept `beforeinput` `historyUndo`/`historyRedo` and route them.
6. **One keyboard handler** at the app level dispatches undo/redo. It only defers to native undo inside plain form fields (e.g. a URL textbox), and commits that field's value as a history entry on change/blur.
7. **Assets.** Deleting an image doesn't delete the file. It moves to a project `.trash/` folder and is purged only when no history entry references it (or on close). Importing is undoable the same way.
8. **Bounded history.** Default 200 entries, plus a memory budget. Clear on project close (optional persistence: see D6).
9. **Save integration.** Periodic autosave (06 P2) persists the working copy; it never touches or truncates history.
10. **Shared sections / linked components.** Edits are made to the single master definition, so one undo reverts every page that uses it.

## Suggested libraries
- **Zustand** (document store + UI store as separate stores)
- **Immer** `produceWithPatches` + `applyPatches` (`enablePatches()`), or **Mutative** (Immer-compatible API, faster on large trees)
- A **custom history manager** (~200–300 lines) built on the rules above. `zundo` is a good quick start, but it is snapshot-oriented and lacks transactions, labels and selection restore, so we'd outgrow it
- **Tiptap/ProseMirror** for inline rich-text editing (has its own history plugin for rule 5)

## Test strategy
- **Property-based tests** (fast-check): generate random action sequences → apply → undo all → `deepEqual(initial)`. Also redo all → `deepEqual(final)`.
- Unit tests for coalescing, transactions + cancel, selection restore and dirty tracking.
- E2E (Playwright + Electron): drag, slider scrub, typing, then undo/redo via keyboard from each panel.

## Decisions

| # | Topic | Decision |
|---|---|---|
| D1 | **Typing granularity** | One history step **per text-editing session**: from entering a text element until you leave it (click away, Enter, Esc or select something else). Inside the session, the text editor's own local undo still works word by word. |
| D2 | **Step labels** | Every entry has a human-readable label built from the action + the component's display name, e.g. **"Edited Header text"**, "Moved Hero section", "Changed Button colour", "Deleted Footer". Components need a friendly display name (user label → component type, like Bootstrap Studio's `label`). |
| D3 | **History panel** | ✅ In scope. A panel listing labelled steps, newest at top, current position highlighted. **Click a step to jump** there (undo/redo multiple steps at once). Steps after the current position are greyed out until a new edit discards them. |
| D4 | **Deleting components** | **No confirmation.** Delete is instant and undoable. Show a toast: *"Deleted Footer · Undo"*. |
| D5 | **Deleting pages** | **Requires a confirmation dialog** (an instance of D7) (*"Delete page 'About'? This removes the page and its content."*). It is **still undoable** afterwards, as a safety net. |
| D6 | **History across restarts** | **Not required.** Treated as an *optional* feature: build it only if cheap (assessment below). |
| D7 | **Confirmation rule** | **Confirm any action that affects more than the current page; everything stays undoable.** Examples needing confirmation: deleting a page, switching theme, changing global colours/fonts/Tailwind tokens, removing a font or icon set that is in use, deleting a shared section used on several pages, find-and-replace across the site. No confirmation: anything scoped to the current page (deleting/moving components, text and style edits), which gets an *Undo* toast instead. Confirmations should state the impact, e.g. *"Delete the Footer? It is used on 6 pages."* **Exception: editing a shared section** does not prompt on each change (that would be constant interruptions). Instead, while a shared section is selected or being edited, show a persistent **banner**: *"Editing shared Footer: changes apply to 6 pages"*, with a link to see which pages. Deleting the shared section still confirms. |

### Is persistent history easy? (D6 assessment)

**Mostly yes. Estimate 1–2 days on top of the in-memory history, low risk if scoped carefully.** History entries are already plain JSON (labels + forward/inverse patches + selection info), so they can be written to disk as-is.

| Concern | Handling |
|---|---|
| Where to store | ~~`.webforge/history.json`~~ → a `history` table inside the single-file SQLite project ([06-project-file-format.md](06-project-file-format.md)), written with each commit. This makes D6 much cheaper |
| History must match the document | Store a hash of the document at the saved point. On open, load history **only if the hash matches**; otherwise discard silently (e.g. the files were edited outside Webforge or restored from Git) |
| Format changes between app versions | Store the document format version. If it differs on open, discard the history rather than migrate patches |
| Deleted assets referenced by old steps | Keep `.trash/` until history is discarded; cap trash size and drop the oldest steps if exceeded |
| Size | Respect the same 200-step / memory cap; compress (gzip) the file |

**Recommendation:** build in-memory history first (MVP), keeping entries strictly JSON-serialisable so persistence remains a small add-on. Ship persistence as a later enhancement if users ask for it.

## Remaining open questions
1. **Canvas engine interplay (stack #3).** Puck ships its own snapshot history (`usePuck().history`, `initialHistory`, `setHistories`); GrapesJS has its own UndoManager. To meet D1–D5 we likely need to **own history** and disable the engine's. This is an evaluation criterion for #3 → see the spike's pass criterion 1 in [04-canvas-engine.md](04-canvas-engine.md#spike-plan-34-days-puck).
2. **History panel extras:** group steps by page, filter, show timestamps? Keep it simple for MVP.
3. **Multi-window** (if preview or code editor gets its own window): history lives in the main editor renderer; other windows send commands.
4. **Collaboration** is out of scope for now. Confirm, so we don't over-engineer toward CRDTs.

## Sources
- [Immer: patches](https://tessl.io/registry/tessl/npm-immer/10.0.0/files/docs/patches-system.md) · [egghead: undo/redo with Immer inverse patches](https://egghead.io/lessons/react-use-immer-inversepatches-to-build-undo-functionality)
- [Instatic editor: patch-based undo/redo and coalescing](https://instagit.com/CoreBunch/Instatic/instatic-editor-undo-redo-coalescing/) (real visual editor using Zustand-style store + Mutative)
- [tldraw: history (marks, squash, bail, ignore modes)](https://tldraw.dev/sdk-features/history)
- [zundo: undo/redo middleware for Zustand](https://github.com/charkour/zundo)
- [Puck v0.16: history injection APIs](https://dev.to/chrisvxd/puck-v016-permissions-3p5d)
- [Yjs UndoManager](https://docs.yjs.dev/api/undo-manager)
- Bootstrap Studio's History/ActionManager: see [../bootstrap-studio/02-architecture.md](../bootstrap-studio/02-architecture.md)
