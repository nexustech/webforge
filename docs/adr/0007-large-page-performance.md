# 0007. Editing a large page: performance check

- Status: Accepted
- Date: 2026-10-20
- Related: [spec/04 item 0.4](../../spec/04-implementation-plan.md) (#14), [architecture §10](../../spec/01-architecture.md#10-performance-targets), [undo research U7](../../research/stack/03-undo-redo.md), [ADR 0004](0004-puck-with-webforge-history.md)

## Context
ADR 0004 kept Puck behind our own history, but flagged two risks to check before the editor is built on it:
- every undo, redo or jump makes Puck rebuild its indexes for the whole page (`setData` → `walkAppState`);
- the spike only ever edited small pages.

Item 0.4 measures editing a page with 200+ elements against architecture §10 ("keystroke / drag to canvas update < 16 ms, no dropped frames") and U7 ("instant" undo, taken here as < 100 ms).

## How it was measured
- **Page:** `largePage()` from `@webforge/test-utils`: 25 sections × (heading, two texts, FAQ with four questions) = **225 nodes**.
- **Harness:** `pnpm e2e:perf` builds the app with `electron-vite build --mode perf`, which adds a small loader (`apps/desktop/src/renderer/perf/perf-hooks.ts`). Normal builds don't contain it: Vite drops the branch at build time, and the smoke test checks that. Playwright then drives the real app (`e2e/perf/large-page.perf.ts`).
- **Metrics:**
  - Event Timing for keydowns: full duration up to the next painted frame, and handler processing time;
  - long tasks (> 50 ms) on the main thread;
  - canvas DOM change + next frame after clicking Undo/Redo or a step in the Undo History panel;
  - memory from `performance.memory` and `app.getAppMetrics()`.
- **Machine:** Windows 11, Intel Core i7-8750H (2018, 6 cores / 12 threads), 16 GB. That's mid-range today, roughly the "mid-range laptop" of §10. Four runs; the ranges are across runs.

## Results

| What | Result (225 nodes) | Starter page (4 nodes) | Budget | Verdict |
|---|---|---|---|---|
| Load the page into the canvas | 1.3–1.4 s | – | (cold start < 3 s for a 5-page site) | ✅ |
| Keystroke → next painted frame | p50 **48–64 ms**, p95 **88–104 ms** | p50 24–32 ms, p95 40–48 ms | < 16 ms | ❌ |
| Our event handlers per keystroke | ≤ 1 ms | ≤ 1 ms | < 16 ms | ✅ |
| Long tasks while typing 37 characters | 5–9, each 50–67 ms | none | none | ❌ |
| Drag a heading (drop) | one long task of **134–142 ms** at the drop (+ one ~55 ms) | – | no dropped frames | ❌ |
| Undo (50-step history) | p50 50–53 ms, p95 75–84 ms | – | < 100 ms | ✅, close |
| Redo | p50 51 ms, p95 54–65 ms | – | < 100 ms | ✅ |
| Jump to start / end in Undo History | 77–84 ms | – | < 100 ms | ✅, close |
| Memory | JS heap 54–69 MB; renderer 306 MB | – | (no budget) | ✅ |

The keystroke-to-paint figure includes Chromium's own input and paint pipeline. Even the tiny starter page takes 24–32 ms, so "< 16 ms" can't be measured that way. The budget applies to **our work per keystroke**. Our handlers are cheap (≤ 1 ms), but the work they trigger isn't:
- **Our history:** `history.run` + `syncDraft` cost **5–7 ms per keystroke** on this page (measured in isolation), because `syncDraft` compares the whole page on every keystroke.
- **The rest, about 20 ms per keystroke plus the long tasks,** is Puck re-rendering and re-indexing after each change, plus our engine's deep-equality check of the whole page.

## Decision
**Puck stays (ADR 0004's "go" holds), with a performance work item before beta.** Every number here is at most a few times over budget, and each has a known cause with a contained fix:
- typing feels noticeably laggy only on large pages (48–64 ms is three to four frames; users notice at roughly 100 ms);
- undo is already instant by U7's measure.

None of this calls for the fallback canvas.

Mitigations, in order of expected gain:
1. **Targeted text patches (ours).** A text edit already names its node and field (`EngineEdit.nodeId`/`field`). Record `node.props[field] = value` instead of `syncDraft(draft.page, edit.page)`. That removes the 5–7 ms whole-page comparison per keystroke.
2. **No whole-page equality check per change (ours).** The engine compares the whole page to skip echoes. Compare a document version or the store's reference instead.
3. **Atomic Puck actions for undo, redo and jumps (ADR 0004's plan).** Translate history patches into Puck's `replace`/`insert`/`remove` actions instead of `setData`, so Puck stops rebuilding its indexes for the whole page.
4. **Memoise component renders.** Wrap each component's render so unchanged nodes skip re-rendering when one node changes.
5. **Investigate the drop hitch (about 140 ms).** Profile the drop: Puck's `move` action plus our whole-page sync and `setData`. Expected to shrink with items 1–3.

Target after the mitigations: no long tasks while typing or dropping on this page, and keystroke-to-paint within 8 ms of the starter page's (Chromium's own pipeline sets the floor). `pnpm e2e:perf` is the measuring tool; its soft budget checks show what still misses.

## Consequences
- **Plan change (approved):** Phase 1 item 1.27 "Editing performance: targeted patches, atomic Puck actions, memoised renders" (#89), run before 1.9. Its results are in the addendum below.
- `pnpm e2e:perf` stays on demand, not in CI: timings on shared runners are too noisy to gate PRs. Run it before and after performance work and when upgrading Puck.
- **Upstream reports:** the two Puck issues from ADR 0004, and two more from item 1.27, are drafted below for filing from the project account.

## Addendum: after the mitigations (1.27, 2026-10-20)
What item 1.27 changed:
- **#96: mitigations 1 and 2.**
  - A one-field edit carries an `EnginePatch`, and the editor writes just that field instead of running `syncDraft` over the page.
  - The engine recognises the app's echo by reference and tracks what Puck shows by revision. The whole-page `isDeepEqual` is gone.
- **#97: mitigation 3.** Undo and redo reach Puck as `replace`/`insert`/`remove`/`move`/`replaceRoot` actions (`pageActions`). A change with more than one added, removed or moved element, such as a long jump, still uses `setData`.
- **Mitigation 4 was already in place.** Puck 0.23 memoises every node (`DropZoneChildMemo`, `MemoizeComponent`, shallow comparison of each node's flat props). The profiles show only the changed node re-rendering, so no change was needed.
- **#100: a patch to Puck.** CPU profiles after #96 showed the remaining per-keystroke work is Puck's:
  - every store update runs every `useAppStore` selector, about 10 per element (10–14 ms per update on this page);
  - its permissions slice walks the whole page on every data change, even though no component defines `resolvePermissions` (about 8 ms);
  - its fields slice re-publishes unchanged sidebar fields for the selected element, costing one more full selector pass.

  A `pnpm patch` (`patches/@puckeditor__core@0.23.0.patch`) skips the last two when they would change nothing. pnpm fails the install if the patch no longer applies after a Puck upgrade. Both are drafted for upstream below (reports 3 and 4).

  **What the Puck patch changes**, for re-applying it after an upgrade (Puck is MIT; the licence check fails if a patched package's licence allows only unmodified use, see ADR 0002):
  1. The permissions slice skips its whole-page walk when no component and not the root define `resolvePermissions` (#100).
  2. The fields slice doesn't re-publish the default fields when they and the item's id are unchanged (#100).
  3. Puck's API object (`useGetPuck()`, `__private`) gains `getZoomConfig` and `setZoomConfig`. Puck keeps its canvas zoom out of its public API, and the engine's `setZoom` and `onCanvasSize` need it for the canvas toolbar (1.15). Without it, zooming does nothing and no size is reported.
  4. The canvas re-fits its zoom only when its scroll container's own size changes (the frame's parent, `offsetWidth`/`offsetHeight`, scrollbars included): a window or column resize. Puck re-fitted on any change to the frame, which fills that container's content box, so the scrollbar that a zoom above Fit brings undid that zoom at once (#134).
  5. A rich-text editor sends its last change as soon as it loses focus. Puck sends rich text after a 50 ms debounce (200 ms at most), on timers a background window can throttle further. Clicking elsewhere and pressing Undo inside that window recorded the session without its last keystrokes (canvas-history E2E, about 1 run in 15).
  6. Puck's API object (`__private`) also gains `flushRichText`, which makes the focused rich-text editor send its pending change at once. The engine calls it when Undo or Redo is pressed while typing, and runs the command once that edit is recorded (#146).
  7. The inline rich-text editor is imported with the canvas instead of lazily on the first click into rich text. Puck showed a fallback `contenteditable` until its Tiptap chunk loaded, then replaced it, losing what was typed meanwhile (ADR 0004, 1.23). The chunk (about 0.6 MB) is now part of the renderer's main bundle.

### Before and after
Same page, harness and machine as above. Three runs of each state, interleaved; the ranges are across runs. One round overlapped with other work on the machine, so the upper ends are noisy.

| What (225 nodes) | Before 1.27 | #96 + #97 | + #100 (Puck patch) | Target |
|---|---|---|---|---|
| Keystroke → next painted frame | p50 56–80 ms, p95 80–96 ms | p50 48–64 ms, p95 72–96 ms | p50 **40 ms**, p95 **48–64 ms** | within 8 ms of the starter page |
| Starter page (4 nodes), same measure | p50 24–32 ms | p50 24–32 ms | p50 24–32 ms | – |
| Long tasks while typing 37 characters | 4–30 (50–69 ms each) | 0, 0, 8 | **none** | none |
| Drop after dragging a heading: longest task | 167–281 ms | 215–384 ms | 252–310 ms | no long tasks |
| Undo (50-step history) | p50 66–106 ms, p95 91–138 ms | p50 56–68 ms, p95 72–98 ms | p50 **51–54 ms**, p95 **59–77 ms** | < 100 ms |
| Redo | p50 66–101 ms, p95 68–128 ms | p50 56–66 ms, p95 66–70 ms | p50 51–53 ms, p95 63–82 ms | < 100 ms |
| Jump to start / end in Undo History | 84–163 / 83–148 ms | 146–149 / 136–141 ms | **63–98 / 56–89 ms** | < 100 ms |
| Load the page into the canvas | 1.7–2.8 s | 1.9–2.6 s | 1.8–2.0 s | – |
| Memory: JS heap / renderer | 73–93 / 296–305 MB | 65–73 / 303–304 MB | 82–87 / 295–296 MB | – |

Against the targets:
- **Typing has no long tasks.** Keystroke-to-paint is now 8–16 ms above the starter page's, down from 24–56 ms. That narrowly misses the 8 ms target. What remains is Puck's single selector pass per keystroke, which grows with the number of elements on the page.
- **Undo, redo and jumps are within U7's < 100 ms.**
- **Jumps without the patch got slower (about 146 ms).** A translated jump is two Puck actions, and each paid for the permissions walk and a selector pass, where one `setData` paid once. With the patch they are the fastest of the three. Translating many-step changes into many actions isn't worth it, which is why `pageActions` hands them to `setData`.
- **The drop hitch is unchanged (mitigation 5).** A profile of the drop alone shows about 150 ms of React re-rendering every draggable element after the drag ends (Puck's drag state), plus layout. Our part is about 18 ms: recording the move compares the whole page through `syncDraft`. No change on our side removes the rest.

### What next
- **Selector cost.** Puck's `_experimentalVirtualization` renders only the visible top-level sections. It would cut the selector work roughly in proportion, but it takes off-screen sections out of the DOM (find-in-page, scroll positions, E2E counts). Revisit if pages larger than about 25 sections are common, or when Puck makes it stable.
- **The drop hitch** needs Puck to stop re-rendering every draggable element when a drag ends. That would be a third patch or upstream work. Not pursued in Phase 1: one hitch per drop of about 0.3 s on a 225-element page is noticeable but rare.
- **Moves and inserts** could carry a targeted change like text edits do, saving the remaining 18 ms of `syncDraft` per drop. This becomes worthwhile once the drop hitch itself is fixed.

## Upstream reports (drafts)

**1. `InlineTextField` moves the caret to the start when its value changes from outside**
> With `contentEditable: true` text fields, setting new data from outside (for example `dispatch({ type: "setData", … })` for an app-level undo) makes `InlineTextField` replace its text node, so the caret jumps to position 0 while the field keeps focus. Expected: keep the caret offset (clamped to the new length) when the field is focused. Workaround today: record the offset and restore it in a `MutationObserver` after the field's content changes. Puck 0.23.0.

**2. Rich-text editor ignores an external value change for 200 ms after typing**
> The rich-text field skips syncing an external value while its "still saving" timer runs (up to 200 ms after the last keystroke). The check is computed at render time, so an app-level undo issued right after typing can be ignored entirely: the canvas keeps the old text while the document has the undone value. Expected: apply external values once the timer ends, or let integrators force a sync. Workaround today: remount the editor of unfocused nodes whose value changed, by keying it with a revision. Puck 0.23.0.

**3. The permissions slice walks the whole page on every change, even without `resolvePermissions`**
> `resolvePermissions()` with no arguments runs on every `state.data` change. It calls `flattenData` (a full `walkAppState`, including `flattenNode` per element) and starts a promise per element, even when no component and no root config define `resolvePermissions`. On a 225-element page that is about 8 ms per keystroke. Expected: skip the walk when nothing resolves permissions. Puck 0.23.0.

**4. The fields slice re-publishes unchanged fields on every change of the selected element**
> Without `resolveFields`, `resolveFields()` still calls `setState` with a new `fields` object on every change of the selected element (every keystroke in it), with the same `fields` and `id` as before. Every `useAppStore` selector re-runs; on a 225-element page that's a second full selector pass per keystroke. Expected: skip `setState` when nothing changed. Puck 0.23.0.
