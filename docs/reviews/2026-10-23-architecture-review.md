# Webforge Architecture Review

**Date:** 23 Oct 2026 · **Commit:** `main` at `0b66dad` · **Live doc:** https://claude.ai/artifact/WhJDG6hmpfKamM64ExxnRU

The architecture on `main` is sound and the hard rules (Puck isolation, history-only mutations, typed IPC, zod at every boundary, no Node in the renderer) hold in the code, not just the spec. The findings below are about structure and consistency as the codebase doubles in Phase 2: one real bug, a handful of standards the code never adopted, and several places where the same problem has three solutions.

## What to fix first

Eight findings carry most of the value. Each was verified in the code.

| # | Finding | Where | Why it matters | Fix |
| --- | --- | --- | --- | --- |
| 1 | **Bug: pasting an image into an element inside a linked copy records an undo step but changes nothing.** `selectedNode` returns `{ node, copy }`, but the paste path drops `copy` and searches page content, so `findNode` misses while the step and the Media import still happen. Cut handles `copy` correctly. | `renderer/clipboard/element-clipboard.ts:321-361` | Silent no-op with a phantom history entry; no test covers it. | Branch on `copy` as cut does and write through `updateSectionField` with the `editedSharedSection` label; add a regression test. |
| 2 | **No error boundary and no uncaught-error route in the renderer.** `createRoot(...).render(...)` has no `onUncaughtError`/`onCaughtError`; no `error`/`unhandledrejection` listeners; main only sees `render-process-gone`. | `renderer/main.tsx`, `main/crash-wiring.ts` | One throwing panel blanks the whole editor and the error never reaches the local crash reports that F-SITE-7 promises. | Forward sanitised errors to the crash handler through a preload call; wrap each registered panel and the canvas in an error boundary with a `t()` fallback. |
| 3 | **React Compiler is not enabled, but standards §4 ("no manual useMemo/useCallback") and §2a assume it.** `plugins: [react(), ...]`, no `babel-plugin-react-compiler` anywhere. Code that would break under it already exists (ref written during render in `LayersPanel.tsx:164`, `setState` during render in `box-field.tsx:52`, dependency-less `useLayoutEffect` in `engine/chrome.tsx`). | `apps/desktop/electron.vite.config.ts:78` | Hot paths (Layers rows, Add panel groups, link targets) recompute on every render with nothing memoising them; turning the compiler on later breaks files. | Decide now: enable it (annotation mode first, warnings as errors in CI) and fix the three render-time writes, or amend §4. |
| 4 | **IPC handlers forward raw exception messages to the renderer.** `registerIpcHandler` has no try/catch around `impl`; Node fs errors carry absolute paths. | `main/ipc.ts:25-33`, `main/project-session.ts:187`, `main/recent-sites.ts:149` | Breaks the "renderer never sees a path" rule the rest of main keeps carefully, and the WebforgeError/messageKey rule. | Catch in `registerIpcHandler`, log the code only, rethrow a fixed error or return the contract's `failed` shape; test that no message contains a path. |
| 5 | **The Puck adapter is a 958-line closure with ~30 mutable variables and five reentrancy flags** (`inAction`, `applying`, `reporting`, `revision`/`shownRevision`). The echo path depends on the app calling `applyChange` synchronously inside `onUserEdit`. | `packages/engine/src/puck/puck-engine.tsx:185-958` | Every Puck upgrade, shared-section edge case and performance change lands here; its invariants live in comments. | Extract a `CanvasSync` object (revision/echo state with `beginApply/endApply/isEcho` and its own tests) and a pure `routeEdit(...)` built on `shared-layout`/`shared-copies`; the adapter becomes wiring. |
| 6 | **Autosave commits carry no site identity.** `commitSite` sends document changes only; during a hand-off the store is swapped before the window reloads, so a late autosave from site A can be accepted as structurally valid into site B. | `main/project-session.ts:195-224`, `main/hand-off.ts:40-44` | Rare but silent corruption of a user's file. | Add a `sessionId` to `ProjectSummary`, require it on `commitSite`/`setUiState`/`importMedia`, refuse with `stale-session`. |
| 7 | **`HistoryManager.run` is not re-entrant and does not detect it.** A recipe (or a synchronous store subscriber) that calls `run`/`undo`/`jumpTo` passes `assertNoTransaction`; the outer `run` then overwrites the inner result while its entry stays. | `packages/history/src/history-manager.ts:247-257` | Breaks the undo invariant silently; the property tests never nest and no test covers a recipe that throws. | A `busy` guard around `run`, transactions, `moveTo` and `endSession` throwing `HistoryError("reentrant")`; tests for nested run and a throwing recipe. |
| 8 | **Export reads every media blob into main memory and ships them in one `postMessage`.** Up to 10,000 × 50 MB read synchronously from SQLite on the main thread, then structured-cloned to the worker. | `main/export-ipc.ts:40-74`, `main/export-worker-client.ts:55` | Main stalls for the whole read; two copies of all images in memory; §3 says the worker does image work. | Let the worker pull blobs on demand over the MessagePort (`read-blob` request/response), or open the `.wforge` read-only in the worker. |

## Standards vs. reality

spec/03 states several rules the code never adopted. Each needs one decision: adopt it now, or amend the standard so new Phase 2 code isn't written against a rule nobody follows.

| Rule in spec/03 | What the code does | Decision needed |
| --- | --- | --- |
| §4 React Compiler enabled; §2a its warnings are CI errors | Not configured; 12 `useMemo`, 0 `useCallback`, render-time ref/setState writes in three files | Enable (annotation mode, then full) or amend §4 to "manual memoisation where measured" |
| §4 Errors are `WebforgeError` subclasses with `code` + i18n `messageKey` | No `WebforgeError` exists; six ad-hoc classes (`ProjectFileError`, `SiteFormatError`, `BuildError`, `WriteError`, `PublishError`, `CredentialError`) and six `instanceof` chains in `project-session.ts` | Add `WebforgeError` to `@webforge/model` (or `@webforge/errors`), make the six extend it, one `errorCode(error)` helper |
| §4 Logging via electron-log, structured | 16 `console.error` sites in main; nothing in a packaged app ever sees them. Renderer boundary catches log nothing (`export-command.ts:48`, `element-clipboard.ts:130`, `import-media.ts:112`) | A small `log.ts` (electron-log or a capped file appender) and a `reportError(context, error)` helper in the renderer shell |
| §10 Uncaught errors route through the shared crash handler | Main and native crashes only; renderer and utility processes have no handlers | Finding 2 above, plus `uncaughtException`/`unhandledRejection` in `export-worker.ts` posting a `crashed` outcome |
| §3 Document mutations only through `HistoryManager`; UI state in a separate store | Holds for the document (0 direct writes). The UI store (`session.ui`) is a writable `StoreApi` written raw from 15+ call sites, so `showPage`'s "page exists" guard is bypassable | Expose `ui` as `ReadonlyStore` (as `history.document` is) and add `session.select`/`setViewport`/`edit({ selectionAfter, apply })` |
| §4 One component per file; shadcn + tokens, no inline styles | `PageSettingsDialog.tsx` exports `Field`, `Check`, `ImageChoice` used by Site Settings; `LinkDialog` has its own `Field` with a different API; 9 inline `style=` props (most geometry-driven and fine) | Move form primitives to `@webforge/editor-ui`; document the geometry exception |
| §5 Every editor-ui component has stories for its states; site components have stories per variant; property tests for migrations | editor-ui: 30 stories, field renderers only inside `EditPanel`, no error/hover/loading states, 2 `play` functions. site-components: 8 stories, none with a navigation dropdown. 0 fast-check properties for migrations although `siteDocArbitrary` exists | Story and property work is cheap now and expensive once the catalogue is 36 components |
| §9 crash reports keep 50 / 90 days with breadcrumbs | Code keeps 20 / 30 days, no breadcrumbs, drops the message (stricter, good) | Align the spec to the code |
| architecture §6 `Pipeline.build` is an `AsyncIterable<BuildEvent>` with `AbortSignal` | `buildSite` returns one promise, cannot be cancelled or observed, and re-encodes every image on every build (ADR 0005 measured ~2.3 s per photo) | Add `{ signal, onProgress }` and an injectable derivative cache before Phase 3's pipeline items (3.1) |
| architecture §4 `site-components` exposes a React-free catalogue entry for `commands` (4.8) | The only entry pulls React, `react-dom/server` and a Vite-only `import.meta.glob` | Split `library-types.ts` into a `/schema` subpath before 4.8; replace the glob with generated string constants |

## Renderer: React and state

The renderer's shape is good: each feature is a framework-free logic module plus a presentational component taking an `actions` object, bound by a host; document reads go through `useSyncExternalStore` with selectors, and there are zero `vi.mock`s because engine and preload are injected. The problems are consistency and a few components that hold business logic.

**State and data flow**

- **No shared document-selector hook.** 46 raw `useSyncExternalStore(document.subscribe, selector)` calls; four subscribe to the whole `SiteDoc` (`LinkField.tsx:76`, `RichTextLinkHost.tsx:84`, `EditPanelHost.tsx:185`) and so re-render on every canvas keystroke, re-walking all pages for link targets or anchors. Add `useDocument(selector, equals?)` (zustand's `useStore` + `useShallow`) and select slices (`pages`, `layout`, `sharedSections`, `media`).
- **Three techniques for "did the page list change?"**: `JSON.stringify` snapshots (`CanvasToolbarHost.tsx:12`, `page-commands.ts:9`, `register-layers-panel.tsx:55`, `canvas-navigation.ts:59`) versus reference comparison (`SitePanel.tsx:94`). Standardise on reference checks, with one `pageListOf(site)` memoised by `WeakMap`.
- **Preferences and mode live in three places**: React state, a `latest` ref kept in sync by effects (`App.tsx:96-100`, `164-183`), and a zustand `addStore` bridged both ways with an echo guard (`Editor.tsx:387-404`). Make preferences a vanilla store with `change()` as its action; command closures read `getState()`; the refs and bridge disappear.
- **The UI store is written raw from 15+ sites** (see Standards table). Panels also re-register on mode change: `registerLayersPanel(..., { layoutLocked })` in an effect keyed on `mode` unmounts the panel and loses its collapsed set and filter (`App.tsx:148`), while the Add panel solves the same problem with a store prop. One pattern: changing inputs via a store, registration deps `[panels, session]`.

**Components**

- **`Editor.tsx` (469 lines) holds six registration-handle refs and a 110-line mount effect** that fans `setLayoutLocked` out to four command sets. Move the wiring into `connectEditor(engine, session, deps) -> { setMode, dispose }` like the existing `connectEngine`/`connectFieldDrags`, and let command registrations subscribe to a `layoutLocked` store themselves (style and shared-section commands already do; clipboard needs Editor to push).
- **`EditPanelHost.tsx` (484 lines) is the Edit panel's controller inside a component**: ~190 lines of change/list/gesture/text-session logic, recomputed per document change; its 706-line test exercises pure logic through a rendered component. Extract `editPanelController(session)` with `fieldsFor()` and `change/commit/reset`, unit-tested without React.
- **Unvalidated list and attribute edits**: `changeList(name, list, value as ListChange)` writes `change.value` into the document without checking it against `list.fields[change.name]`, unlike scalar `change()` which uses `accepts()`. Same for `withAttributeChange`. A wrong-typed value becomes an undo step and is autosaved.
- **Six copies of "how an element is named"** (`labels.ts`, `element-clipboard.ts:38`, `layers.ts:73`, `register-add-panel.tsx:121`, `link-targets.ts:50`, `SharedSectionCommands.tsx:88`) with different edge handling (`||` vs `=== ""`). One `elementName(node, library, shared?)` in `editor/labels.ts`.
- **Two HTML5 drag-and-drop list implementations** (`LayersPanel.tsx` and `MenuPanel.tsx`: same `dragged` ref, half-row maths, indicator classes, subtly different `dataTransfer` checks). A `useRowDrag({ type, canDrop, onDrop })` hook in `shell/`; the Pages panel is the third consumer.
- **Three ways to open a dialog after a menu closes** (`use-menu-dialog.ts` vs rAF + opener refs in `CanvasElementMenu.tsx:69` vs `renamedFromMenu` in `LayersPanel.tsx:547`). Let `ElementMenu` take a `MenuDialog` from `useMenuDialog`.
- **Model limits re-typed as literals**: `maxLength={200}`/`{300}`/`{80}`/`{100}` in dialogs and `MAX_NAME_LENGTH = 100` in two files, duplicating `pageEntrySchema` and `layerName: z.string().max(100)`. Export the limits from `@webforge/model` (`SHARED_SECTION_NAME_MAX` is the right pattern).

**Smaller items**

- Undo labels for crop/focal/alt and every Site Settings save are generic ("Cropped image", "Changed Site Settings"); add/replace/delete name the file. D2 asks for the name or the changed section.
- Branded ids recovered by cast from `<select>` values (`CanvasToolbar.tsx:105`, `LinkDialog.tsx:236`, `SiteSettingsDialog.tsx:122,239,405`); `LinkDialog.tsx:216` already shows the `.find` pattern. `media[mediaId as keyof typeof media]` in three files wants a `mediaItem(site, id)` helper like `sharedSection(site, id)`.
- User-facing text assembled by concatenation in `CommandButton.tsx:188`, `confirm-site-wide.tsx:389`, `PagesPanel.tsx:140`; use parameterised keys.
- The Add panel registers twice per mount because its effect depends on the `engine` state set inside the mount effect (`Editor.tsx:419-445`); `CanvasResizeHandles` re-subscribes its Escape listener on every pointer move (`[drag]` dependency).
- `StartScreen.tsx:67` `remove` is an unhandled rejection on IPC failure; `shared-confirmations.ts:300` calls the engine after a possible disconnect (no `disposed` flag, unlike `connectSiteCss`).
- Stories missing for `DeviceDialog`, `NameDialog`, `PageSettingsDialog`, `CanvasResizeHandles`, `CommandBox`, `StartScreen`; `LinkDialog` has no test of its own; `export-command.test.ts` mocks owned code (`vi.mock("@webforge/editor-ui")`) where injecting `notify` would do.
- `menuFileLinks` loop duplicated in `export-request.ts:20` and `media-usage.ts:47`; belongs in model beside `syncMenuWithPages`.

## Main process, IPC and worker

This is the strongest area. One contract (`shared/ipc-contract.ts`, 22 channels, all handled), every request and response zod-parsed on both sides, sender-frame checks, the renderer never sees a path, hardening verified by the smoke E2E, and 30 of 33 modules unit-tested under plain Vitest through injected `Pick<IpcMain>`/dialog/timer types. Findings are about what happens on the main thread and what happens when things fail.

- **Raw error messages cross IPC** (fix-first #4) and **autosave commits carry no site identity** (fix-first #6).
- **Synchronous heavy work on the main thread.** Every autosave rebuilds and zod-parses the whole `SiteDoc` then runs the SQLite transaction (`project-session.ts:206-212`); `importMedia` hashes and inserts up to 100 MB per request (`media-import.ts:54`); `clipboard.write` copies each image with `writeFileSync`; the media protocol copies a blob into a new `Uint8Array` before `Response` (`media-protocol.ts:27`). All IPC and `webforge-media:` requests stall meanwhile; the §10 "<50 ms autosave" budget won't hold for large sites. Validate only the changed documents, move hashing into the existing thumbnail worker, pass `blob.data` without copying, measure with `pnpm e2e:perf`.
- **Dropped files travel as bytes over IPC** (`shared/ipc/media.ts:14-26`, `MAX_IMPORT_REQUEST_BYTES = 2 * MAX_MEDIA_BYTES`), structured-cloned twice. Electron's pattern is `webUtils.getPathForFile(file)` in the preload and the existing `readChosenFile` in main; keep the byte path only for pasted screenshots.
- **`main/index.ts` (538 lines) holds untested logic, not just wiring**, while `vitest.config.ts` excludes it: `rememberWindowState`, `canvasArea` (injected JS + zod), the capture/resize flow, four dialog adapters incl. the e2e hook, and module-level mutable flags (`quitting`, `flushOnClose`, `preferencesStore`) that callbacks close over; `BrowserWindow.getAllWindows()[0]` appears four times. Move them to `window-state.ts`, `dialogs.ts` and an `AppLifecycle` object; shrink the exclusion.
- **Nothing guarantees every contract channel has a handler** beyond runtime. A `registerAllHandlers(ipc, impls: { [N in IpcName]: ... })` makes the type checker enforce exhaustiveness, or a test that asserts handled ⊇ contract channels.
- **Export worker has no `uncaughtException`/`unhandledRejection` handlers**; a worker crash is recorded only via `child-process-gone` without a stack. Also `WorkerProcess` is typed twice (`worker-requests.ts`, `export-worker-client.ts`) and `createWorkerRequests` takes `job: Record<string, unknown>`, so a malformed `compile-css` job compiles.
- **`create()` over the open file closes it before the new store exists** (`project-session.ts:136-144`): a failing `ProjectStore.create` leaves no site open although the class promises "a failure keeps the current site".
- **Clipboard image cache keeps full-resolution site images in `userData/clipboard` indefinitely** (`clipboard.ts:179-195`); only the next copy clears them. Clear on `will-quit` and when the system clipboard no longer holds `ELEMENTS_FORMAT`.
- **Defence in depth gaps**: `will-navigate` covers the main frame only; add `will-frame-navigate` and `will-redirect` with the same `isAppUrl` check and an explicit `frame-src` in the CSP (today blocked implicitly by `default-src 'none'`).
- **Dangling promise chains**: `void save().catch(...).then(() => call("projectFlushed", id))` in `preload/api/app.ts:17` protects `save` but not the `call`; same shape in `media-protocol.ts:52`.
- **Netlify auth and credential store exist but aren't wired** (Phase 4); fine, but `credential-store.ts` already defines its own `CredentialError` shape that the `WebforgeError` decision should absorb.

## Engine, site components, pipeline, editor-ui and publish

The Puck firewall is real: `canvas-engine.ts` imports only `model` and `site-components`, the app fakes the whole interface in tests, and `pageActions`/`editFromAction` are pure and property-tested. But roughly 6k of the engine's 7.4k lines are Puck workarounds, so the fallback canvas in ADR 0004 is now a rewrite, not a swap; treat `CanvasEngine` as the product's canvas API.

**Engine**

- The 958-line adapter closure (fix-first #5).
- **Puck's DOM contract is scattered across seven files**: `data-puck-component` literals in 7 files, `.ProseMirror` in 2, `[class*="PuckCanvas-root"]` (`puck-engine.tsx:585`, a hashed class), `[data-puck-dropzone=...]`, `[data-puck-drawer-item]`, and the patched `__private.flushRichText/getZoomConfig`. A selector drift on upgrade silently disables zoom reporting or View options. One `puck/puck-dom.ts` with named selectors and a Vitest test that mounts Puck and asserts each selector matches, so `pnpm check` catches an upgrade before Playwright does.
- `renderStatic` on the interface is called only by engine tests and oddly requires a mounted canvas; drop it (callers use `renderPage`) and mark the Puck-shaped members (`addDragSource`, `onFrameWindow`, `setZoom`, `perform`) in TSDoc so a second engine knows what it must emulate.
- Chrome hard-codes theme colours in iframe CSS (`#f028f3`, `#0a6fb7` in `chrome.tsx`, `spacing-handles.tsx`, `view-options.ts`) duplicating `theme.css` tokens; four copies of "append a `<style>` once". Pass chrome tokens from the app and add `ensureStyle(doc, attr, css)`.

**Site components**

- **`defineComponent` gives no compile-time link between `fields`, `defaults` and `values`** (`values: Record<string, unknown>`); every render re-narrows and a typo is a module-load failure. Before the catalogue grows from 8 to ~36 components (Phase 2), make it generic: `defineComponent<const F extends Record<string, FieldDef>>` with `ValuesOf<F>` mapping `select` to its option values, `toggle` to boolean, `box` to `Responsive<BoxValue>`. Keep the runtime checks for file data.
- **Behaviours are untyped JavaScript covered only by Playwright** (`behaviours/menu.js`, no `@ts-check`, no unit test). Tabs, carousel, lightbox, sticky, embed and animate are about to join. Add `// @ts-check` with JSDoc and a happy-dom unit test per behaviour, or author in TS and emit readable classic JS via a tiny tools step.
- **No React-free entry point** (Standards table): needed by `commands` (4.8) and any Node tool.
- Display names are evaluated at module load (`t()` at import), fixing the locale at import time; harmless for English-only MVP, worth a note.

**Pipeline**

- `buildSite` cannot be cancelled or observed and re-encodes images every build (Standards table).
- **`@webforge/pipeline/navigation` runs in the renderer and needs two bespoke dependency-cruiser rules**; `navigationFor`/`hrefFor` are pure functions over model types and belong in `site-components` or `model`. The package-wide `lib: ["dom"]` (for jSquash's `ImageData`) lets a stray `document.` type-check; a 10-line `image-data.d.ts` is enough.
- `writeSiteFolder` trusts path keys (`join(staging, ...path.split("/"))`), safe only because callers validated through `siteSnapshotSchema`; `publish/manifest.ts` already has `sitePathSchema` for exactly this. A rejected codec `ready` promise poisons every later export in the process; `Object.assign(globalThis, { ImageData })` mutates a global.

**editor-ui**

- **`FieldSpec` re-describes fields as a loose bag** (`kind: string`, every per-kind prop optional) although `site-components` already has the discriminated `FieldDef`; renderers need `field.options ?? []` and `edit-panel.tsx:71` an `as FieldRenderer`. `ListItemValue {key, values}` vs `ListItem {id, ...}` are two shapes for one record. The renderer registry is a module-level `Map` (process-wide singleton; tests must unregister). Type `FieldSpec` as a union on `kind`, reuse `ListItem`, pass renderers via prop or context.
- `box-field.tsx:52` sets state during render; `picker.tsx:255` is the package's one inline style (`gridTemplateColumns`).
- Stories: field renderers have none of their own, no error/hover/loading states, 2 `play` functions in 16 files.

**publish**

- Clean and testable (injectable `fetch`, zod on every response, stateful fake Netlify, env-gated live test). Drift to note: `PublishEvent.published.removed` is always 0, `diffManifest`/`sitePathSchema` have no caller yet (FTP/SFTP publishers), and `test(dest, signal?)` differs from §6's signature; two abortable sleeps (`pause`, `wait`).

**Cross-package duplication**: `withSides` (engine and editor-ui), `idsOf` (two engine files), tree walkers `childLists`/`holds`/`childrenIn` (engine, site-components). `model` should own `walkNodeTree`/`idsOf`.

## Core packages: model, history, storage, i18n

No high-severity issue. The model is schema-first with drift protection (`const s: z.ZodType<T>` ties hand-written types to schemas), prototype-pollution defence is systematic and iterative, storage matches ADR 0003 to the letter, and history is generic and property-tested in four variants.

- **Nested slot nodes are not validated at the boundary.** `nodeDocSchema` checks only top-level nodes; a Section with `content: [{ type: 5, props: null }]` passes `siteDocSchema`. Walkers guard with `isNodeDoc` and `library.ts:497` re-parses `advanced` at render, so this is robustness, not security, but the schema's contract is weaker than its name. Make it recursive with `z.lazy` or add `nodeTreeIssues()` to the `superRefine`.
- **Recursive walkers over untrusted depth** (`anchorsIn`, `containsCopy`, `walkNodes`, `copyNode`, `walkLinks`, storage's `collectHashes`) right after the one iterative guard (`findUnsafeKey`, whose comment states the rule). A deeply nested file throws `RangeError`, which `safeParse` does not turn into a `ZodError`, so `migrateSite` surfaces a raw error instead of `SiteFormatError("invalid")`. Enforce a depth cap once in `findUnsafeKey` and map non-Zod errors in `migrateSite`.
- **`HistoryManager.run` re-entrancy** (fix-first #7); also `selection?: SelectionAdapter<S>` is "required when S is not null" by comment only; a conditional options type makes it a compile error.
- **Version fixtures never exercise their migrations**: `v1/site.json` already holds the post-migration Hero shape and `v3` has one shared section, so the chain tests prove only pass-through; 1→2 and 3→4 logic is covered solely by synthetic input, and there is no fast-check property for migrations (§5 lists one). Give each fixture the pre-migration shape its step changes and add a down-grade/up-grade round-trip property.
- **Two migration mechanisms.** The versioned `MIGRATIONS` chain, and read-time tolerance in schemas with no bump (`LEGACY_PADDING` in `box.ts:33` "before 1.32", `media.size` "before 1.28", `heroImageValues`). A format-4 file is therefore not one shape and every reader keeps legacy branches. Fine pre-1.0, but write the rule down (ADR): any stored-shape change bumps the format and gets a migration.
- **Document ids/kinds are stringly typed and declared three times**: `SiteDocument.id: string` with the `page:<PageId>` rule in prose (`site-documents.ts:8`), storage's structurally identical `DocumentChange`, and the IPC layer's `z.enum` of nine kinds plus a `refine` re-encoding the `page:` rule (`shared/ipc/project.ts:62-85`). Export `SITE_DOCUMENT_KINDS`, a `siteDocumentChangeSchema` and a discriminated `SiteDocumentChange` from model.
- **`NodeId` is branded but unused**: `props.id: string` everywhere, 0 uses of `NodeId` outside model, while page/media/menu/shared-section ids are consistently branded. Brand at the engine boundary or delete the type so it doesn't promise what nothing enforces.
- **Casts on schema constants defeat the drift check**: `sharedSectionsDocSchema ... as z.ZodType<...>` (`shared-sections.ts:159`), `responsive.ts:57`, `ids.ts:62` silence exactly the annotation the rest of the package relies on. Find the mismatching property (likely `readonly`) and fix it.
- **`readSite()` rewrites the file as a side effect of a read** (`project-store.ts:511-518`): opening an older site through the renderer's `readSite` IPC commits a full rewrite before any edit, making the file unreadable by the version that wrote it even if the user only looked. Keep the migrated site in memory and let the first `commit()` write it, or document the choice in ADR 0003.
- **Foreign keys rely on better-sqlite3's default** (`hardenConnection` never sets `foreign_keys = ON`; the tests even switch it off). One explicit pragma and one guard test.
- **`t()` keys are compile-time checked; params and plurals are not.** A missing `{item}` shows up at runtime as literal text; plurals are hand-rolled `...One`/`...Many` key pairs. A template-literal `Params<typeof en[K]>` type and a `plural()` helper, before a second locale.
- Hygiene: `@webforge/test-utils` re-exports `tempDirFactory`, which imports `vitest`, and Playwright files import the same index; `vitest` is a runtime dependency. Move it to a `/vitest` subpath. `schema-migration.test.ts` is the only `vi.mock` of owned code in these packages; an injectable `{ formats }` option (as `migrateSiteWith` has) removes it. Optional-property style is mixed (`?: T` vs `?: T | undefined`) under `exactOptionalPropertyTypes`, and `readonly` is applied to some document types but not `NodeDoc`/`PageDoc`/`LayoutDoc`; pick one convention and note it in §2.

## Strengths to keep and spread

- **History discipline is real.** `history.document` is a `ReadonlyStore`; every renderer mutation goes through `session.edit`/`begin` (0 direct writes across 24+ sites); labels come from the glossary; selection restore is separated from history (U3/U6); the renderer has its own fast-check undo suite (`editor/undo-invariant.test.ts`) on top of the package's four.
- **Dependency injection instead of module mocks.** `AppProps`/`EditorProps` take `createEngine`, `compileCss`, `savePreferences`, `exportSite`; main modules take `Pick<IpcMain, "handle">`, dialog records and `Timers`; publish takes `fetch`. Zero `vi.mock` in the renderer, one in main's area, one in storage.
- **One IPC contract enforced both ways**, sender-frame checks, zod on request and response in main and again in the preload, and a test that rejects a result leaking a path (`preload/api.test.ts:92`).
- **Electron hardening verified, not assumed**: sandbox, Fuses, strict CSP from one tested function with a dev-only nonce, permission handlers, and `e2e/app/smoke.spec.ts` asserting all of it in the packaged app.
- **Untrusted `.wforge` handling** per ADR 0003: application id, `quick_check`, exact schema comparison against an in-memory reference DB, defensive mode, read-only fallback for newer formats, temp-file + rename, and a test that kills a real child writer mid-commit.
- **Structural-sharing-aware caching**: `WeakMap` keyed by layout (`shared-layout.ts`), per-node-list class cache (`site-css.ts`), minimal Immer drafts (`apply-patch.ts`, ADR 0007), autosave diff by reference (`changedDocuments`, property-tested). The pattern to spread wherever `JSON.stringify` is used as a change detector today.
- **One renderer for canvas and export** (`renderPage`), golden files with a byte-stability test, `<script defer>` only, Tailwind compiled from rendered markup with injected resources, staging + swap + marker so user files are never deleted.
- **Accessibility handled deliberately**: Layers is a real `role="tree"` with roving tabindex and keyboard paths for every drag; `use-menu-dialog.ts` solves the Radix menu-to-dialog focus hand-off; `CanvasResizeHandles` as `role="separator"` with `aria-valuenow`; drag refusals announced via `role="status"`.

## Suggested order of work

Effort is in ideal days with Claude Code, at the plan's granularity. "Before Phase 2 components" means before 2.6/2.7/2.9 add 28 components on top of the current patterns.

| When | Item | Effort |
| --- | --- | --- |
| Now (bug) | Paste-image-into-linked-copy fix + regression test (#1) | 0.5 |
| Now (decision) | React Compiler on or standard amended; fix the three render-time writes (#3) | 1 |
| Now | Renderer error boundaries + crash route for renderer and worker (#2) | 1 |
| Now | IPC error wrapping with a no-path test (#4) | 0.5 |
| Now | `HistoryManager` re-entrancy guard + tests (#7) | 0.5 |
| Now | `sessionId` on commits during hand-off (#6) | 1 |
| Before Phase 2 components | Generic `defineComponent<F>` with typed `values`; `@ts-check` + unit tests for behaviours; React-free `/schema` entry | 2 |
| Before Phase 2 components | `puck/puck-dom.ts` selectors + upgrade test; `CanvasSync`/`routeEdit` extraction (#5) | 3 |
| Before Phase 2 components | `useDocument(selector)` hook; replace `JSON.stringify` change detectors; `ReadonlyStore` UI with `session.select` | 1.5 |
| Before Phase 2 components | `elementName()`, `useRowDrag`, form primitives into editor-ui, model limits exported, `mediaItem()` | 1.5 |
| With 2.3 / 2.9 | `FieldSpec` as a union; renderers via context; field-renderer stories with states | 1.5 |
| Before 3.1 | `buildSite` with `AbortSignal` + progress + image cache; blobs pulled by the worker (#8); dropped files by path | 2 |
| Before 3.1 | `navigation.ts` out of pipeline; `dom` lib removed; `sitePathSchema` in `writeSiteFolder` | 0.5 |
| Phase 2, any stream | `WebforgeError` + `errorCode()`; `log.ts`; `console.error` sites routed | 1 |
| Phase 2, any stream | Main-thread work: incremental validation on commit, hashing in the worker, no blob copy in the media protocol; `index.ts` split and tested | 2 |
| Phase 2, any stream | Migration fixtures with real pre-migration shapes + round-trip property; depth cap; nested `nodeDocSchema`; `readSite` no longer writes | 1.5 |
| Before beta | Spec alignment: §9 crash-report numbers, §6 publisher signature, `PH2` decisions, migration rule ADR | 0.5 |

Total about 21 days; the first six rows (about 4.5 days) are the ones to do before new feature work.

**Tracked on GitHub (23 Oct 2026)** as issues R1–R17 in the same order, with native *blocked by* links from the plan items they precede:

| Issue | Item | Milestone | Stream |
| --- | --- | --- | --- |
| #234 | R1 Paste-image-into-linked-copy bug | Phase 1 | B |
| #235 | R2 React Compiler decision + render-time writes | Phase 1 | A |
| #236 | R3 Renderer error boundaries + crash routing | Phase 1 | A |
| #237 | R4 IPC error wrapping | Phase 1 | B |
| #238 | R5 HistoryManager re-entrancy | Phase 1 | C |
| #239 | R6 Session id on commits | Phase 1 | B |
| #240 | R7 Typed defineComponent, behaviours, schema entry (blocks 2.6–2.11, 4.8) | Phase 2 | C |
| #241 | R8 Puck DOM module + adapter extraction (blocks 2.6, 2.10, 2.17) | Phase 2 | C |
| #242 | R9 Renderer state hook, read-only UI store (blocks 2.3, 2.9) | Phase 2 | A |
| #243 | R10 Renderer consistency (blocks 2.3, 2.7, 2.9) | Phase 2 | A |
| #244 | R11 editor-ui FieldSpec union + stories (with 2.3) | Phase 2 | A |
| #245 | R12 WebforgeError + logging | Phase 2 | B |
| #246 | R13 Main-thread work + index.ts split | Phase 2 | B |
| #247 | R14 Migration fixtures, depth cap, readSite | Phase 2 | B |
| #248 | R15 Cancellable buildSite, image cache, worker pulls blobs (blocks 3.1) | Phase 3 | B |
| #249 | R16 Pipeline hygiene (blocks 3.1, 3.3) | Phase 3 | B |
| #250 | R17 Spec alignment | Phase 5 | any |

## Method and metrics

Reviewed `main` at `0b66dad` (23 Oct 2026): about 68k lines of TypeScript across `apps/desktop` (39.9k) and 11 packages, read in full by five parallel reviewers (renderer core; renderer features; main/preload/IPC/worker; model/history/storage/i18n; engine/site-components/pipeline/editor-ui/publish) against CLAUDE.md, spec/01, spec/03 and ADRs 0003–0007, plus a configuration pass (tsconfig, Biome, dependency-cruiser, Vitest, electron-vite). Every finding in "What to fix first" was re-verified in the source by the coordinating session; the rest carry the reviewers' file and line references.

| Metric | Value |
| --- | --- |
| `any` / non-null `!` outside tests | 0 / 0 |
| `as` casts outside tests | renderer 38, main 8, engine 30, site-components 7, pipeline 5, editor-ui 3, model 19, history 13, storage 1, publish 0 |
| `useEffect` / `useMemo` / `useCallback` (renderer + editor-ui + engine) | 85 / 12 / 0 |
| Raw `useSyncExternalStore` calls in the renderer | 46 (4 on the whole document) |
| Zustand stores | 4 in the renderer + 2 in history; 2 hand-rolled external stores |
| `vi.mock` of owned code | 3 (`export-command.test.ts`, `schema-migration.test.ts`, one in storage) |
| fast-check properties | 14 in core packages + 4 in the renderer; 0 for migrations |
| Stories | editor-ui 30 (2 `play`), site-components 8, desktop renderer 13 |
| IPC channels defined / handled | 22 / 22 (+1 push event) |
| Non-test files over 300 lines | 32; largest `puck-engine.tsx` 958, `project-store.ts` 821, `SiteSettingsDialog.tsx` 709, `LayersPanel.tsx` 620, `index.ts` (main) 538 |
| Coverage floors | 90/85 core, 80 elsewhere, enforced per workspace in `vitest.config.ts` |
| Hygiene | `electron.vite.config.ts` contains a literal NUL byte in `"\0webforge-base64:"` (tools treat the file as binary; use the `\0` escape) |
