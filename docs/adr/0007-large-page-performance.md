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
- **Proposed plan change (needs approval):** add a Phase 1 item "Editing performance: targeted patches, atomic Puck actions, memoised renders" (about 3 days, area engine/history), depending on 1.9 (History hardening) and checked with `pnpm e2e:perf` against this ADR's targets. Until approved, the plan (spec/04) is unchanged.
- `pnpm e2e:perf` stays on demand, not in CI: timings on shared runners are too noisy to gate PRs. Run it before and after performance work and when upgrading Puck.
- **Upstream reports:** the two Puck issues from ADR 0004 are drafted below for filing from the project account.

## Upstream reports (drafts)

**1. `InlineTextField` moves the caret to the start when its value changes from outside**
> With `contentEditable: true` text fields, setting new data from outside (for example `dispatch({ type: "setData", … })` for an app-level undo) makes `InlineTextField` replace its text node, so the caret jumps to position 0 while the field keeps focus. Expected: keep the caret offset (clamped to the new length) when the field is focused. Workaround today: record the offset and restore it in a `MutationObserver` after the field's content changes. Puck 0.23.0.

**2. Rich-text editor ignores an external value change for 200 ms after typing**
> The rich-text field skips syncing an external value while its "still saving" timer runs (up to 200 ms after the last keystroke). The check is computed at render time, so an app-level undo issued right after typing can be ignored entirely: the canvas keeps the old text while the document has the undone value. Expected: apply external values once the timer ends, or let integrators force a sync. Workaround today: remount the editor of unfocused nodes whose value changed, by keying it with a revision. Puck 0.23.0.
