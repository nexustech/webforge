# 0004. Puck runs under Webforge's own undo history: go

- Status: Accepted
- Date: 2026-10-19
- Related: [MVP spec §6, Phase 0](../../spec/02-mvp-spec.md#6-milestones), [undo/redo design](../../research/stack/03-undo-redo.md) (U1–U9, D1–D7), [canvas engine research](../../research/stack/04-canvas-engine.md) (spike criterion 1, C6), [architecture §6](../../spec/01-architecture.md#6-key-interfaces)

## Context
Webforge's undo design needs us to own the history: labelled steps, one step per user action, one step per text-editing session, selection restore and an Undo History panel. Puck keeps its own snapshot history, and its `data` is uncontrolled after mount. The spike had to show that Puck can run with **our** history instead. If it could not, the fallback was our own canvas on dnd-kit and Tiptap (6–10 weeks more).

We built a working prototype:
- **`packages/history`:** `HistoryManager` on a Zustand store with Immer patches.
  - `run(label, recipe, { coalesceKey })` and `begin(label)` → `Transaction` (`update`/`commit`/`cancel`).
  - `undo`/`redo`/`jumpTo`/`entries`, bounded to 200 entries.
  - Coalescing, `endSession` for text sessions, and selection restore through a `SelectionAdapter`.
  - `syncDraft` turns a whole new value into minimal patches; `compactPatches` keeps merged entries small.
  - The document store is read-only from outside and frozen by Immer.
- **`packages/engine`:** the `CanvasEngine` interface and `createPuckEngine()` on `@puckeditor/core` 0.23.0. It is the only package that imports Puck (dependency-cruiser enforces this).
- **Desktop renderer:** Section, Heading (inline text) and Text (inline rich text) components. You can drag to add and reorder elements and edit text on the canvas. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y go to our history, Undo/Redo buttons sit in the toolbar, and an Undo History panel lets you jump to any step.

## Decision
**Go: keep Puck (pinned to 0.23.0) behind the `CanvasEngine` adapter.** The critical criterion holds. Our history manager produces every step, and undo, redo and jumps update Puck's canvas correctly. Puck's own undo never acts, and its undo UI is gone. Making this work needed a handful of contained workarounds in `packages/engine`, listed below. Nothing broke in a way that needs the fallback canvas.

## Evidence

### Worked as designed
| Requirement | Result | How |
|---|---|---|
| Our store is the source of truth (controlled data) | ✅ | Puck reports every action through `onAction`. The engine turns each one into an `EngineEdit` and the app records it with `history.run(label, draft => syncDraft(draft.page, edit.page))`. Undo, redo and jumps go back to Puck as `dispatch({ type: "setData", data: () => page, recordHistory: false })`. A deep-equality check stops our own changes echoing back. |
| Puck's history bypassed (spike criterion 1) | ✅ | `overrides.header` replaces Puck's header and its Undo/Redo buttons. `installHistoryKeys` handles Ctrl/Cmd+Z/Y at the window's capture phase in both the host and the canvas iframe, and stops the event there, so Puck's `document` hotkeys never fire. It also routes `beforeinput` `historyUndo`/`historyRedo` (Edit menu, native `contenteditable` undo). E2E tests check that no unexplained step appears, which is what Puck's own `back()` would leave behind. |
| One user action = one step (U2) | ✅ | Puck dispatches a single `insert` or `move` when you drop, with nothing during the drag. So drag-to-add and drag-to-reorder each make exactly one step (E2E). |
| Meaningful labels (D2) | ✅ | Built from the action type, the component's label and the changed field: "Added Heading", "Moved Heading", "Edited Heading text", "Changed Heading size". |
| Text session = one step (D1), word-by-word undo while typing (U5) | ✅ | Inline text edits arrive as one `replace` per keystroke, rich text as one every ≤ 50 ms. Runs share `coalesceKey: text:<id>:<field>`, and a pause of over 1 s in the typing starts a new chunk. Pauses are timed by the keystrokes on the canvas (the engine's `typingPauseMs`), not by when the edits arrive (#307). Ctrl+Z inside the canvas undoes the last chunk. Selecting anything else calls `endSession`, which merges the chunks into one step (E2E, unit and property tests). Puck's Tiptap setup has no local undo extension, so our chunks stand in for rule 5's "editor's own local history": one undo stack instead of two. |
| Selection restore (U3), selection not in history (U6) | ✅ | Selection lives in a separate UI store. Every entry records the selection before and after the change. Undo restores it, and the engine re-selects the element on the canvas. |
| Undo History panel + jump (D3) | ✅ | `jumpTo(entryId \| null)` applies several steps' patches at once and restores the selection once (E2E). |
| Undo-all is exact (U8) | ✅ | fast-check, 300 runs: random sequences of insert, remove, move, typing, page title, drag commit/cancel, `endSession`, undo, redo and jump. Undo all returns to the initial document and redo all to the final one. Also property-tested: bounded history, coalescing never loses typed text, patch compaction never changes the result, `syncDraft` always reaches its target. |

### Needed workarounds (all inside `packages/engine`)
1. **Content Security Policy.** Puck 0.22+ injects its canvas interaction styles (≈25 KB) as a `<style>` element in the iframe. While dragging it injects a per-drag `<style>` that no hash can cover, and Tiptap injects its own base styles. Without these the canvas has no drop zones or overlays. The editor's CSP is now `style-src 'self' 'unsafe-inline'`, and scripts stay `'self'` only. The risk is small: `default-src 'none'`, `img-src` and `font-src` already stop inline CSS from loading or leaking anything off the machine. The dev nonce now goes on scripts only, because a nonce makes browsers ignore `'unsafe-inline'`.
2. **No external requests.** `@puckeditor/core/puck.css` `@import`s the Inter font from rsms.me (CSP blocked it). We import `@puckeditor/core/no-external.css` instead.
3. **Positional selection.** Puck selects by `{ index, zone }`. The engine maps selections to node ids, re-selects by id after each `setData` (or reports `null` if the element is gone), and defers any dispatch made from inside `onAction`, where Puck would drop it.
4. **Selections that skip `onAction`.** Puck's inline text field selects through an internal `setUi` helper. The engine also watches `selectedItem` (`createUsePuck`), so the history records the right selection before the change.
5. **Caret jump.** Puck's `InlineTextField` replaces its text node when the value changes from outside, so undoing while typing sent the caret to the start. The engine records the caret offset and puts it back as soon as the field's content changes (`MutationObserver`), before the next key press.
6. **Swallowed first undo in rich text.** Puck's rich-text editor skips content syncs while a 200 ms "still saving" timer runs. Because that check is computed at render time, the first undo after a text session could be ignored. The engine remounts the rich-text editors of unfocused nodes whose value changed, by keying them with a per-node revision.
7. **Late rich-text saves.** Puck saves rich text with a debounce of up to 200 ms, so the last keystrokes can arrive after the click that ends the session, which split it into two steps on fast machines (CI). The app ends a text session 300 ms after the selection moves away, or at once on undo, redo, a jump or any other edit. Undo or Redo pressed while typing first asks Puck to send what it still holds back, through our Puck patch (`__private.flushRichText`, #146). The patch sends it to `onChange` straight away, not through the debounced React state, which only reaches `onChange` once React has rendered. That includes a change the debounce had already passed on: on a busy computer React rendered it only after the Undo, and the end of the typing was lost (#307). On a busy computer Puck's text also arrives later than it was typed, so the 1 s chunk window is applied to the keystrokes' own times rather than to the arrival times.
8. **Console noise.** Object-form `setData` logs a warning on every call. The function form does the same thing without the warning.

### Limitations and risks
- **Puck internals we depend on:** the `data-puck-component` attribute, `InlineTextField`'s `replaceChildren`, the rich-text sync timer, and hotkeys being registered on `document` (so a capture listener on `window` comes first). Puck is pre-1.0. The version is pinned. Since R8, every Puck selector and private API the engine uses is named in `packages/engine/src/puck/puck-dom.ts`, and `puck-dom.test.tsx` mounts Puck and checks each one, so `pnpm check` fails on an upgrade that breaks them. The E2E suite (`e2e/app/canvas-history.spec.ts`) remains the tripwire for behaviour. We should report items 5 and 6 upstream.
- **Rich-text editor loads lazily.** Puck drew each rich text as a fallback `contenteditable` until its Tiptap chunk had loaded, in the first moments after the canvas showed, then swapped in the real editor; keystrokes typed into the fallback in that moment were lost. Resolved in 1.23: our Puck patch imports the inline editor with the canvas (ADR 0007, patch item 7), so there is no fallback to type into. An engine test checks that the fallback never mounts.
- **Puck still records its own snapshots** (debounced, structurally shared) that nothing reads. There is no public option to turn this off. It costs memory only.
- **Performance (U7):** every undo, redo or jump makes Puck rebuild its indexes for the whole page (`walkAppState`). This is instant on spike-sized pages. Measure it on a 20-section page before beta. If it is too slow, translate patches into Puck's atomic `replace`/`insert`/`remove` actions instead of `setData`.
- **Safety net:** a page change that matches no known user action (for example an internal `set`) is recorded as a generic "Edited page" step. The document store therefore never silently drifts from the canvas.
- **Native undo in plain form fields (rule 6):** for now every Ctrl/Cmd+Z goes to our history, including in Puck's sidebar fields, which already record each change as a step. Revisit this when our own Edit panel replaces Puck's.
- **Bundle:** the renderer's main chunk is ≈1.9 MB, plus ≈0.6 MB for Tiptap/ProseMirror. That is acceptable for a desktop app. Check it against the start-up budget (architecture §10).

### Not covered by this spike
These are other items in the spike plan (04 criteria 3–6, C5), and each is a separate Phase 0/1 task:
- Tailwind token fields
- iframe isolation with the site's own CSS
- static export
- shadcn/ui chrome via `overrides`, including routing Puck's built-in English strings through our i18n with its `dictionary` prop
- shared Header/Footer
- slider-style gestures through `begin`/`commit` (the API exists and is tested, but no Puck field uses it yet)

## Consequences
- Phase 1 builds the editor on Puck through `CanvasEngine`. Only `packages/engine` imports Puck.
- Interface changes, also reflected in architecture §6:
  - `CanvasEngine` gains `onHistoryCommand` (undo/redo keys pressed inside the iframe) and a `page` edit kind.
  - `HistoryManager` gains `endSession`, `breakCoalescing` and `jumpTo(null)`, plus `document`/`state` stores for the UI.
- The editor CSP allows inline styles (not scripts); `e2e/app/smoke.spec.ts` asserts exactly that.
- Follow-ups:
  - `PageDoc` and its zod schema move to `@webforge/model`, and the component library moves to `@webforge/site-components`.
  - Map Puck's `dictionary` to `t()`.
  - Run a large-page performance check.
  - Report the two Puck issues above upstream.
