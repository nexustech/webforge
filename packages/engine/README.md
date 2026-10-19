# @webforge/engine

`CanvasEngine` interface and its Puck implementation. Why Puck and how it runs under Webforge's history: [ADR 0004](../../docs/adr/0004-puck-with-webforge-history.md).

## Public API
`src/index.ts` is the only entry point; import the package as `@webforge/engine`, never its internal files.

- `CanvasEngine` ([architecture §6](../../spec/01-architecture.md#6-key-interfaces)): `mount`, `loadPage`, `applyChange`, `onUserEdit`, `select`, `onSelectionChange`, `onHistoryCommand`, `setViewport`, `setMode`, `renderStatic` and `destroy`. The engine shows the page and reports edits as `EngineEdit`s; the app records them in `@webforge/history`, which stays the source of truth.
- `createPuckEngine({ iframe? })`: the Puck implementation. Puck's own undo history is bypassed.
- `ComponentLibrary`, `ComponentDef` and `FieldDef`: components described independently of the engine (`text`, `richtext`, `select` and `slot` fields), with the helpers `textValue`, `optionValue` and `slotComponent`.
- `installHistoryKeys(window, onCommand)` and `historyCommandFor(event)`: route Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y (and native undo) to the app's history before anything else sees them.

```ts
const engine = createPuckEngine();
engine.mount(element, { library, theme });
engine.loadPage(page, layout);
engine.onUserEdit((edit) => history.run(labelFor(edit), (draft) => syncDraft(draft.page, edit.page)));
history.document.subscribe((doc) => engine.applyChange({ page: doc.page }));
```

## Boundaries
- The only package allowed to import Puck (`@puckeditor/core`), enforced by dependency-cruiser.
- Puck is pre-1.0 and pinned. The workarounds that depend on Puck internals are listed in ADR 0004; the E2E suite `e2e/app/canvas-history.spec.ts` guards them on upgrades.
