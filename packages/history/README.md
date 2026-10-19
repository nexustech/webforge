# @webforge/history

History Manager: transactions, coalescing, undo labels and selection restore. Every document change goes through `HistoryManager.run/begin`. Design: [research/stack/03-undo-redo.md](../../research/stack/03-undo-redo.md); spike results: [ADR 0003](../../docs/adr/0003-puck-with-webforge-history.md).

## Public API
`src/index.ts` is the only entry point; import the package as `@webforge/history`, never its internal files.

- `createHistoryManager({ initial, selection?, limit?, coalesceWindowMs?, now? })` → `HistoryManager`
  - `document`: read-only Zustand store holding the document (frozen by Immer).
  - `state`: read-only store with `entries`, `cursor`, `canUndo`, `canRedo` and `transaction`, for the toolbar and the Undo History panel.
  - `run(label, recipe, { coalesceKey?, coalesceWindowMs?, selectionAfter? })`: one labelled undo step. Consecutive runs with the same key inside the window merge into one entry.
  - `begin(label)` → `Transaction` with `update(recipe)` (applied live), `commit()` (one entry) and `cancel()` (restores the document and selection exactly).
  - `undo()`, `redo()`, `jumpTo(entryId | null)`, `entries()`, `clear()`.
  - `endSession(coalesceKey)`: ends a text-editing session by merging its chunks into one step (D1). `breakCoalescing()` stops merging.
- `syncDraft(draft, next)`: makes an Immer draft equal to `next`, writing only what differs, so patches stay granular.
- `compactPatches(patches)`: drops `replace` patches that later ones overwrite.

```ts
const history = createHistoryManager({
  initial: { page },
  selection: { get: () => ui.getState().selection, restore: (selection) => ui.setState({ selection }) },
});
history.run(t("history.moved", { item: "Heading" }), (draft) => {
  moveNode(draft.page, id, to);
});
history.undo(); // restores the document and the selection
```

## Boundaries
- Framework-free: no React, no Electron.
- Core package: coverage ≥ 90% lines / ≥ 85% branches. The undo invariant is property-tested with fast-check (`undo-invariant.test.ts`).
