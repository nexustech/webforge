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
  - since #338 (24 Oct 2026), the commit of one changed page of a site with this page, against architecture §10's 50 ms (`e2e/perf/commit.perf.ts`). It was a `pnpm e2e` check until then, but on shared runners the first commits after the site opens wait for the page being drawn and the canvas CSS compiling.
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

  A `pnpm patch` (`patches/@puckeditor__core@0.24.0.patch` since Puck 0.24, below; `@0.23.0` before) skips the last two when they would change nothing. pnpm fails the install if the patch no longer applies after a Puck upgrade. Both are drafted for upstream below (reports 3 and 4).

  **What the Puck patch changes**, for re-applying it after an upgrade (Puck is MIT; the licence check fails if a patched package's licence allows only unmodified use, see ADR 0002). `packages/engine/src/puck/patch-contract.test.tsx` takes the items by number and names the test of each, so an upgrade that loses one fails by name:
  1. The permissions slice skips its whole-page walk when no component and not the root define `resolvePermissions` (#100).
  2. The fields slice doesn't re-publish the default fields when they and the item's id are unchanged (#100).
  3. Puck's API object (`useGetPuck()`, `__private`) gains `getZoomConfig` and `setZoomConfig`. Puck keeps its canvas zoom out of its public API, and the engine's `setZoom` and `onCanvasSize` need it for the canvas toolbar (1.15). Without it, zooming does nothing and no size is reported.
  4. The canvas re-fits its zoom only when its scroll container's own size changes (the frame's parent, `offsetWidth`/`offsetHeight`, scrollbars included): a window or column resize. Puck re-fitted on any change to the frame, which fills that container's content box, so the scrollbar that a zoom above Fit brings undid that zoom at once (#134).
  5. A rich-text editor sends its last change as soon as it loses focus. Puck sends rich text after a 50 ms debounce (200 ms at most), on timers a background window can throttle further. Clicking elsewhere and pressing Undo inside that window recorded the session without its last keystrokes (canvas-history E2E, about 1 run in 15).
  6. Puck's API object (`__private`) also gains `flushRichText`, which makes the focused rich-text editor send its pending change at once. The engine calls it when Undo or Redo is pressed while typing, and runs the command once that edit is recorded (#146).
  7. The inline rich-text editor is imported with the canvas instead of lazily. Puck drew each rich text as a fallback `contenteditable` until its Tiptap chunk loaded, in the first moments after the canvas showed, then replaced it, losing what was typed meanwhile (ADR 0004, 1.23). The chunk (about 0.6 MB) is now part of the renderer's main bundle.
  8. Each drop zone answers whether it accepts the element being dragged when the drag library asks (a getter on the element's collision data, `inDroppableZone`), instead of passing the answer to every element in it as a prop. The prop flipped at the start and the drop of every drag, on every element in a zone that doesn't take the dragged kind, and each drew again (#786).
  9. Each element keeps which of the zones inside it are active in a ref, read through a getter (`containsActiveZone`) when the drag library asks, instead of in React state. Setting it drew every element holding a zone again at the start and the drop of every drag (#786).

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

## Addendum: Puck 0.24 (#669, 2026-11-01)

Puck 0.24.0 came out on 29 Oct 2026. Our 0.23 patch couldn't be applied to it: it edits Puck's built files, whose hashed names 0.24 changed (A9, second architecture review).

- **Still needed.** 0.24 still walks the whole page for permissions on every change and still publishes new fields for an unchanged selected element. So all seven items above are re-applied, each where 0.24 now has the code.
- **ESM only.** The new patch edits Puck's three ESM chunks: 153 lines, down from 433. The 0.23 patch also edited the CommonJS `index.js` and `no-external.js`. Those are never loaded:
  - Puck's package exports give `import` its `index.mjs`, and `require` alone the CommonJS copy;
  - the app's renderer is built by Vite, and the tests run in Vitest, both through `import`;
  - nothing in the repository `require`s Puck.

  `patch-contract.test.tsx` runs on what Vitest loads, and fails without items 1 or 2: each was checked by taking it out of the installed Puck.
- **Items 1 and 2 have mounted tests** for the first time. Before, only this `e2e:perf` check covered them.
  - Item 1: on a page of 30 elements, a change looks up `resolvePermissions` fewer times than there are elements. The walk looks it up for each one.
  - Item 2: a change to the selected element runs a store selector as often as a change to another element. The re-published fields would add a pass.
- **One new string.** 0.24's dictionary gains `action-drag` (the action bar's drag handle), now in `t()` as *Drag to reorder* (glossary T3).
- **The canvas's stripes moved out of the themes package (A19).** `themeCss` stripes the exported page's sections, plus the places its caller names. The canvas's CSS names the engine's `CANVAS_EVEN_SECTIONS`, built from `puck-dom.ts`. No exported stylesheet carries the canvas's rules any more.
- **E2E uses the engine's names for Puck's DOM (A20),** through `@webforge/engine/puck-dom`, a React-free subpath. `puck-dom.ts` now names the six attributes the E2E tests used on their own. Two have mounted tests: the rich-text menu, and the action bar with its label and actions. Puck sets the five drag-time attributes only during a pointer drag, which happy-dom can't make. For those, the test checks that Puck's installed stylesheet still names them.

**Before and after**, on the same machine as above: `pnpm e2e:perf` three times on each version, interleaved, on `main` (0.23) and the branch (0.24). The ranges are across runs.

| What (225 nodes) | Puck 0.23 | Puck 0.24 |
|---|---|---|
| Keystroke → next painted frame | p50 48–56 ms | p50 48–56 ms |
| Long tasks while typing 37 characters | none, none, one of 50 ms | one of 50 ms, one of 53 ms, none |
| Drop after dragging a heading: longest task | 215–249 ms | 222–259 ms |
| Undo (50-step history), p50 | 35–49 ms | 37–52 ms |
| Redo, p50 | 35–39 ms | 36–52 ms |
| Jump to start / end in Undo History | 103–109 / 104–125 ms | 112–132 / 113–137 ms |
| Load the page into the canvas | 1.2–1.4 s | 1.3–1.5 s |
| Memory: JS heap / renderer | 117–141 / 412–414 MB | 117–141 / 418–425 MB |

- **No change beyond this machine's noise.** The ranges overlap, and the one long task while typing, right at 50 ms, came on both versions. The p95s jump between runs on both (up to 440 ms typing and 303 ms undo once each), as a busy machine does.
- **On this machine both versions now miss the jumps' 100 ms**, which they met in October (56–98 ms). The page and the harness are the same, so that is the machine, not Puck. The drop's long tasks missed their target then too (mitigation 5). 5.1 sets the budgets on CI's runners.

## Addendum: drawing the whole page again (A25, 2026-11-01)

The second architecture review's A25: any change to what the canvas renders with, besides the page, draws the whole page again (`redraw()` in `puck-engine.tsx`). Such a change can be a theme look, Media, an edit-only preview or Site Settings. `redraw()` builds Puck a new config, because a component draws again only when its props or its config change. Nothing measured it until now.

- **The case:** `large-page.perf.ts` now has a step that turns the theme's italic look for Heading on and off ten times on the 225-node page. It goes through a perf-only hook, `toggleHeadingLook`, as one history step each, as Theme Studio's look change makes one. The app then calls `setLooks`, as it does for any theme change.
- **What is timed:** from the change until the first heading on the canvas shows it, in a painted frame. It is looked for frame by frame, in the canvas as it is then: a `class` observer on the heading saw nothing. So the time covers the whole theme change as the app handles it, of which the redraw is the long task.
- **The other entry points:** `setPreviews`, Media and Site Settings go through the same `redraw()`, so this one case stands for them all.

**Result**, on the same machine: `pnpm e2e:perf` three times each, interleaved, on `main` and the branch with the new step. The branch adds the step only, so the other rows show the machine's noise on the day.

| What (225 nodes) | `main` | With the new step |
|---|---|---|
| **A theme look changed, until shown** | not measured | **p50 1.7–2.2 s, p95 1.9–3.1 s** |
| Long tasks while it is drawn again | – | one per change, 1.4–2.8 s |
| Keystroke → next painted frame | p50 48 ms | p50 48–56 ms |
| Drop after dragging a heading: longest task | 217–362 ms | 247–275 ms |
| Undo (50-step history), p50 | 54–70 ms | 53–56 ms |
| Redo, p50 | 54–55 ms | 47–55 ms |
| Jump to start / end in Undo History | 116–125 / 117–187 ms | 113–134 / 111–118 ms |
| Load the page into the canvas | 1.4–2.0 s | 1.6–1.9 s |
| Memory afterwards: JS heap / renderer | 125 / 423–425 MB | 111–347 / 631–692 MB |

- **Far over "instant".** A theme change on a large page holds the editor for about two seconds, 17–22 times the 100 ms that U7 takes as instant, and every keystroke or click in that time waits. Each change is one long task of the page being drawn again: with a new config Puck draws every component again, all 225, not only the headings the look changes. The other rows match `main` within the machine's noise, so the step adds this cost alone.
- **Memory.** After the ten changes, the renderer holds about 200–270 MB more than `main` does at the same point. That is likely the replaced elements still waiting for garbage collection, but the run doesn't show whether it is ever given back.
- **No budget yet:** the step records its numbers without failing, as 5.1 sets the budgets on CI's runners. The fix is a follow-up of its own: give the components what they render with through a store they subscribe to, so that a change draws only the components that read the part that changed, and Puck's config stays the same.

## Addendum: drawing only what reads the change (#727, 2026-11-01)

The follow-up above, done.
- **What it does:** `redraw()` is gone. The engine keeps the render context in a store (`render-context-store.ts`), and Puck's config is built once per library.
- **How a component follows the context:** each one draws through a small `Drawn` component, which records what it reads of the context as it draws. It records:
  - a value (`navigation`);
  - an entry of a plain object: its own kind's look, or one preview;
  - a function's answer for the arguments it was called with (`image("m1")`, `setting("contact.phone")`).
- **What draws again:** a change reaches only the components whose reads give something else now. A function's answer is compared as JSON, and a drawn hint counts as changed whenever its function does.
- **Kept or read whole:** the canvas always holds a looks object, empty for a theme without looks. Otherwise every element would read "no looks" as one value, and a theme's first look would change it for all of them. A component that lists the context's keys, or spreads it, reads it whole and draws again on any change: none on the canvas does.

**Before and after**, on the same machine: `pnpm e2e:perf` three times each, interleaved, on `main` (after A25's step) and the branch.

| What (225 nodes) | `main` | Drawing only what reads it |
|---|---|---|
| **A theme look changed, until shown** | p50 1.8–3.0 s, p95 2.3–3.3 s | **p50 36–38 ms**, p95 122–350 ms |
| Long tasks while it is drawn again | one per change, 1.6–2.9 s | none, none, one of 63 ms |
| Keystroke → next painted frame | p50 64–72 ms | p50 48–56 ms |
| Undo / Redo, p50 | 50–82 / 51–78 ms | 52–72 / 54–71 ms |
| Load the page into the canvas | 2.7–3.0 s | 1.5–1.9 s |
| Memory afterwards: JS heap / renderer | 111–190 / 635–663 MB | 125–133 / 429–430 MB |

- **Within U7's 100 ms at p50, with no long task over 200 ms** (#727's targets). A look change draws the headings whose kind's look changed, and nothing else. The p95 is one change in ten, from 122 to 350 ms; the long-task observer saw no task above 63 ms then, so it's work spread over frames rather than one task.
- **The memory A25 found has gone:** the renderer ends at what `main` held before the step was added (423–425 MB, A25's table).
- **The other rows** show nothing this change explains. They come before the step in each run, and `main`'s slower typing and load on these runs are this machine's noise (A25's runs of the same code gave p50 48 ms and 1.4–2.0 s).
- **A test checks it:** `puck-engine.test.tsx` mounts the engine with an element that reads nothing of the context and one that reads an image. A look, a preview and a Site Settings change draw neither again, and a new image draws only the second. A new config would draw both.

## Addendum: nightly on Windows and macOS (5.1, 2026-11-07)

`pnpm e2e:perf` stays off pull requests, as decided above, but now runs nightly in CI's Performance job on `windows-latest` and `macos-latest`, 5.1's reference machines. The benchmarks' comparison gates PRs (ADR 0022).
- **It adds** a 20-page export, timed twice, the second with the export worker's caches warm: §10's "images cached" (`export.perf.ts`).
- **Then the job builds the installers** and checks each against §10's 150 MB (`tools/src/check-installer-size.ts`).
- **The preview's page timing** now listens for the server's events before typing. On the Windows runner the reload for the typed text came before the stream opened, and the test waited 30 s for a reload that had already been sent.

**First run** (Run workflow 42398191584, before that fix):

| What | Windows | macOS | Budget |
|---|---|---|---|
| Open a template's site | 1.3–1.7 s | 1.4–2.4 s | < 3 s |
| Commit one page (1 / 21 pages) | 21 / 21 ms | 11 / 5 ms | < 50 ms |
| Export 20 pages: first / caches warm | 2.2 / 0.8 s | 2.8 / 0.7 s | < 5 s |
| A theme colour reaches the browser | 18 ms | 83 ms | < 100 ms |
| A changed page reaches the reload | (the race above) | 34 ms | < 200 ms |
| Jump to start / end in Undo History | 81 / 83 ms | – | < 100 ms |
| Long tasks while dragging (drop) | 8, the longest 148 ms | 3 | none |
| Windows installer | 121 MB (built locally) | – | ≤ 150 MB |

Everything is within §10 except the drop hitch, mitigation 5 above, which 5.1's part 3 takes up.

## Addendum: a drag's budget, set from CI's runners (5.1, part 3, 2026-11-07)

§10's "no dropped frames" while dragging is the one budget the app still misses, and only on a page this large: the 225-element page is far above a typical small-business page. As this ADR left it to 5.1, the budget is set from what CI's reference runners measure (coordinator's decision, 7 Nov 2026).
- **No long task over 350 ms** during a drag.
- **The move recorded within 1 s** of the drop: from the mouse's release to the Undo History's "Moved Heading".

**What each drag costs.** On the 2018 i7 laptop above, a drag has 6–7 long tasks of 100–330 ms. They fall at its start, on its moves and at the drop. A trace and a CPU profile, on an unminified perf build, put almost all of it in Puck's drag library:
- **At the drag's start and at the drop,** the drag state's change re-renders every `DraggableComponent`. React's work is about 480 ms over a drag.
- **At the start,** `Scroller.getScrollableElements` walks the page for its scrolling containers, about 135 ms.
- **On each move,** hit-testing (`elementFromPoint`) and `getBoundingClientRect` force a style and layout pass over the whole page. Style recalculation is 620 ms over 220 passes, up to 63 ms each.
- **The editor's own part** is about 18 ms (`syncDraft`, above).

**On CI's runners** (Run workflow 42408964869 and 42411225219):

| | Windows | macOS | Budget |
|---|---|---|---|
| Long tasks per drag | 1–6 | 1–3 | – |
| The longest | 102–159 ms | 94–170 ms | < 350 ms |
| The move recorded after the drop | 400–483 ms | 394–564 ms | < 1 s |

**Typing on the large page** keeps §10's frame for the editor's own handlers per keystroke (CI: at most 9 ms). The target after 1.27, no long task at all, is relaxed to none over 120 ms. On macOS' runner a run sometimes has one or two of 54–102 ms among 37 keystrokes; Windows' runner and this laptop had none.

**A theme look's redraw** (A25, #727) gets #727's targets as its budget: p50 within U7's 100 ms (CI: 31–33 ms), and no long task over 200 ms (CI: none).

**The 50-step jump** keeps U7's 100 ms: CI measured 46–88 ms on Windows, and 50–134 ms on macOS.

**Noise.** `pnpm e2e:perf` now retries once on CI, so a miss must repeat to fail, and keeps a failure's trace and screenshot. In these runs a commit (82 ms once) and the macOS jump each missed once and passed on their retry.

**Taking the hitch further** is #786: memoise the draggables on drag-state changes, and cache the scrolling containers per drag, as a fourth item of the Puck patch. Then measure against the figures here. Drawing only the visible sections (`_experimentalVirtualization`, "What next" above) was set aside: it's a product call.

## Addendum: dragging without drawing every element again (#786, 2026-11-08)

The follow-up part 3 names above. On the i7 a drag had 6–7 long tasks, the longest about 250–300 ms.

- **What drew the page again.** Counting `DraggableComponent`'s renders, and which of its inputs changed for each, found about 380 renders per drag. Almost all came from two values that change at the start and at the drop:
  - `inDroppableZone`: each drop zone works out whether it accepts the dragged kind and passed that to every element in it as a prop. On this page many zones don't take a Heading, so the prop flipped for about 127 elements, twice per drag. That also broke `DropZoneChildMemo`, so each element's render function was made anew.
  - `containsActiveZone`: an element holding zones kept which were active in React state, set as each zone's answer changed.
  Only the drag library's collision check reads either. Patch items 8 and 9 above hand them over as getters it calls as it checks, so the answers stay current and nothing draws again for them.
- **Not done: caching the scrolling containers per drag** (#786's second idea). `Scroller.getScrollableElements` doesn't appear in a profile of the drag with Puck 0.24 and `@dnd-kit/dom` 0.4, where part 3's profile found about 135 ms: `isOverflowVisible` takes 2–7 ms over a whole drag now.
- **Out of reach:** each pointer move hit-tests the page (`elementFromPoint`, `getBoundingClientRect`), which forces a style and layout pass over it: about 300–500 ms over a drag. It grows with the page's elements and its CSS.
- **Contract tests:** `patch-contract.test.tsx` starts a drag through the drag library's manager in happy-dom (`@dnd-kit/react`, a dev dependency of the engine at Puck's pin) and reads each element's collision data at once, before React draws again. Both items fail without the patch.

**Before and after**, on the same i7: `large-page.perf.ts` three times on each, and a profile of three drags with the renders counted.

| What (225 nodes) | `main` | With items 8 and 9 |
|---|---|---|
| `DraggableComponent` renders per drag | about 380 | about 21 |
| React's work over a drag (`performWorkOnRoot`, profiled) | 600–730 ms | 230–330 ms |
| Longest long task in a drag | 237–303 ms | 172–225 ms |
| Long tasks per drag | 6–7 | 6 |
| The others | 87–153 ms | 87–153 ms |
| The whole drag, until "Moved Heading" | 2.5–3.3 s | 2.1–2.9 s |

- **The drag's start and drop are about 30% shorter**, which was the longest task. The number of long tasks doesn't fall: the rest are the pointer moves' hit-testing.
- **The budget:** the drag's longest task is now held under 250 ms (`DRAG_LONGEST_TASK_MS`), down from part 3's 350 ms, as agreed with stream B. CI's runners measured 94–170 ms before this change, so it leaves room. The number of long tasks per drag stays reported, not asserted: §10's "no dropped frames" needs the hit-testing cut, which Puck's `_experimentalVirtualization` would do by leaving off-screen sections out of the page ("What next" above).

## Upstream reports (drafts)

**1. `InlineTextField` moves the caret to the start when its value changes from outside**
> With `contentEditable: true` text fields, setting new data from outside (for example `dispatch({ type: "setData", … })` for an app-level undo) makes `InlineTextField` replace its text node, so the caret jumps to position 0 while the field keeps focus. Expected: keep the caret offset (clamped to the new length) when the field is focused. Workaround today: record the offset and restore it in a `MutationObserver` after the field's content changes. Puck 0.23.0.

**2. Rich-text editor ignores an external value change for 200 ms after typing**
> The rich-text field skips syncing an external value while its "still saving" timer runs (up to 200 ms after the last keystroke). The check is computed at render time, so an app-level undo issued right after typing can be ignored entirely: the canvas keeps the old text while the document has the undone value. Expected: apply external values once the timer ends, or let integrators force a sync. Workaround today: remount the editor of unfocused nodes whose value changed, by keying it with a revision. Puck 0.23.0.

**3. The permissions slice walks the whole page on every change, even without `resolvePermissions`**
> `resolvePermissions()` with no arguments runs on every `state.data` change. It calls `flattenData` (a full `walkAppState`, including `flattenNode` per element) and starts a promise per element, even when no component and no root config define `resolvePermissions`. On a 225-element page that is about 8 ms per keystroke. Expected: skip the walk when nothing resolves permissions. Puck 0.23.0.

**4. The fields slice re-publishes unchanged fields on every change of the selected element**
> Without `resolveFields`, `resolveFields()` still calls `setState` with a new `fields` object on every change of the selected element (every keystroke in it), with the same `fields` and `id` as before. Every `useAppStore` selector re-runs; on a 225-element page that's a second full selector pass per keystroke. Expected: skip `setState` when nothing changed. Puck 0.23.0.
