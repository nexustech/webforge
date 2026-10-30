# Webforge Architecture Review, second pass

**Date:** 30 Oct 2026 · **Commit:** `main` at `c602885` (Phase 3 exit) · **First review:** [2026-10-23](2026-10-23-architecture-review.md) · **Security review:** [2026-10-30](2026-10-30-security-review.md)

The first review's work landed. Of its 17 findings, 13 hold in the code, 3 hold only in part (R9, R10, R12) and 1 is not done (R17, docs only). The largest structural problems are gone:
- `main/index.ts` went from 538 lines to 21.
- The Puck adapter went from 958 lines to 445 of wiring, with its sync state and DOM contract in tested modules.
- No raw document subscriptions are left in the renderer (46 on 23 Oct).
- The React Compiler is on, and checked.
- Exports pull blobs one at a time in a cancellable worker.

The codebase has since tripled to about 170k lines, and two things stand out:
- **One real bug:** storage garbage collection is never called, so every site file grows without bound (A1).
- **Phase 4 is about to make decisions nobody has written down.** 4.4, 4.5 and 4.6 are on the critical path (4.2 → 4.4 → 4.5 → 4.6) and run in the next two weeks across streams A and B. Each will have to choose:
  - which process runs a publish;
  - where destinations live;
  - what a version snapshots;
  - where the Site Check gate runs;
  - what storage format versions need.

  Each choice is cheap to make in an ADR now, and expensive to change after the first of those PRs merges (A2–A6).

The structural findings repeat a pattern the first review already named. A few central files (`project-session.ts`, `app.ts`, `EditPanelHost.tsx`) absorb every feature. Phase 4 will add about ten more operations to each unless they get a seam first.

**Method.** Six reviewers covered:
- main
- the renderer
- the engine
- model, storage and history
- publish
- pipeline, Site Check, themes, components and commands

Two more checked R1–R17 against their issues and the code. Each of the 38 findings went to its own verifier, which tried to disprove it. 34 were confirmed, 3 are plausible and 1 was refuted (dropped below). A second agent re-checked every R1–R17 status and agreed with all of them. Duplicates are merged here. The 26 findings with a planned item or an issue behind them are numbered A1–A26; the smaller ones are listed unnumbered under their area.

Severity is as the verifiers set it. **High** means a real bug. **Medium** means a design gap that will force rework of a planned item, or a structural cost that keeps growing. **Low** means worth doing when nearby. Line numbers are from `c602885`.

## What to fix first

| # | Finding | Where | Severity | Why it matters | Fix |
| --- | --- | --- | --- | --- | --- |
| A1 | **Garbage collection is never run.** `ProjectStore.collectGarbage()` has no production caller. Every commit points `documents.blob_hash` at a new content-addressed blob and never deletes the old one. Autosave commits 2 s after editing stops, and at least every 30 s while it continues, so every save of a page leaves its previous JSON in the file for good. Undone imports and unused bundle files stay too. Four comments in main, and the storage README, say GC runs "at open or close". | `storage/src/project-store.ts:553-573, 697-728`, `main/project-session.ts:369,392,479`, `main/bundle-ipc.ts:21` | high | The file grows with editing time: about 36 MB per two-hour session on one large page. Each of the 5 rolling backups copies the orphans, and open time grows with `quick_check`. 4.6's "Space used + Clean up" has nothing under it. | Call `collectGarbage()` in `#closeNow` before `store.close()`, where access is already exclusive and after the last save. Add a ProjectSession test that commits twice, closes, and checks the old blob is gone. Correct the comments and the README. Leave VACUUM to 4.6's Clean up (A5). |
| A2 | **Nothing decides which process runs a publish.** `publishSite` takes a `BuildOutput`, the whole build as a map in memory, which exists only inside the export utility process. The worker protocol has no `publish` job. Credentials stay in main (ADR 0006 §5). spec/01 §3 lists publishing under Main, but also lets the build worker "touch the network during publish". | `publish/src/run.ts:30`, `publish/src/publisher.ts:2-5`, `shared/export-worker-protocol.ts:18,256`, `worker/run-export.ts:43-58`, spec/01 §3 | medium | If 4.4/4.5 call `publishSite` from main, which is the obvious route since the secrets are there, every built file is cloned into main. That undoes R15's memory work and puts main's event loop on the upload path. Moving it after 4.5 means reworking the runner, the protocol and the IPC. | **ADR 0006 decision 9, before 4.4:** publishing runs in the export utility process. Add a zod-checked `publish` job (snapshot, mapped destination, and the secret read from the credential store after the S2 fingerprint check, held only for that job). The worker builds with `mode: "publish"`, runs `publishSite`, and streams `PublishRunEvent`s back as `progress`; cancel reuses `cancel`. Main keeps secrets at rest. `ssh2` and `basic-ftp` load only in the worker. Correct spec/01 §3. |
| A3 | **Publish destinations sit in the undoable, versioned SiteDoc.** `publishDestinationSchema` is part of `siteSettingsSchema.publish`. It is always `[]` today, and nothing reads it. Its shape also matches neither publisher: three field sets, no mapper, no `url`, and no auth method. | `model/src/settings.ts:114-136,290`, `publish/src/ftp.ts:10-24`, `sftp.ts:15-29`, `netlify.ts:22` | medium | If 4.4 writes destinations there, every change becomes an undo step. Undoing past a first publish drops Netlify's `siteId`, and the next publish creates a second site. A 4.6 restore brings back an old destination list: secrets are orphaned, or a republish goes to a stale place. FTP's live check can never run without a `url`. | **ADR 0006 decision 10, with 4.4:** keep destinations out of SiteDoc, in per-site, non-undoable, unversioned state in the `.wforge` (the `meta` pattern of `readExportChoices`, or a `publish_destinations` table). Drop `publish` from `siteSettingsSchema` with a trivial ADR 0012 step. Use one stored shape with `url` and `auth`, plus a mapper to each publisher. Trust state stays in userData (security review S2). |
| A4 | **Versions and builds read different copies of the site.** `saveVersion` copies the committed `documents` rows, which trail the editor by the autosave delay (up to 30 s, plus any open text session). Exports and publishes build from the snapshot the renderer sends. Only the renderer can build a snapshot (`siteContentFor`; `siteToSnapshot`'s `blobs` branch is dead in the app). `readVersion` returns un-migrated documents, and there is no `readVersionSite`. | `storage/src/project-store.ts:598-648`, `renderer/export/export-request.ts:29-68`, `model/src/to-snapshot.ts:53-71`, `renderer/storage/autosave.ts:47-48` | medium | The automatic "Published …" version (4.5/F-PB-3) can differ from what went live. "Before restore" and "before a site-wide action" can miss the last edits, which is the very case versions exist for. "Republish a version" (4.6) has no way to build a stored version without opening it in the editor, which its scope rules out. | One flow in main for 4.5 and 4.6. The renderer ends the text session and awaits `autosave.flush()`, then calls with its session id (A7). Main saves the version and builds *that version* from the store in the worker (A2). Republish is the same flow with an existing version id. Move `siteContentFor` into a React-free module (`@webforge/pipeline` `snapshotForSite`). Add `ProjectStore.readVersionSite(id)`, which migrates like `readSite`. |
| A5 | **The versions table can't hold what 4.6 needs, so storage format 2 is unavoidable.** The table records no reason (daily, before restore, before site-wide, on publish), no thumbnail, no site format and no publish target. `format_version` always stores storage format 1. There is no `deleteVersion`, no prune and no per-version size query. `open()` accepts only the exact schema, and the manifest is a `strictObject`. `SCHEMA_MIGRATIONS` is `{}`, and its only test fakes a step with `vi.mock`. Separately, the storage writer only handles imports, so Clean up (GC + VACUUM) would run on main's connection. | `storage/src/schema.ts:46-53,68`, `project-store.ts:147-155,619`, `shared/storage-writer-protocol.ts`, ADR 0013 | medium | 4.6 is estimated at 5 days. Finding this halfway through means making a storage-format decision, writing the first real schema migration and fixture, and changing GC, the fingerprint and the open checks, all inside the item. A VACUUM of a 300 MB file on main blocks IPC and autosave for seconds (ADR 0014). | **A 1-day prep item before 4.6, plus an ADR.** Storage format 2 adds `reason`, `site_format`, `thumbnail_hash` (counted by GC) and `published_to`. Write the first real `SCHEMA_MIGRATIONS[1]` with a v1→v2 fixture. Add `deleteVersion`, `pruneAutoVersions(keep)` and `versionSpace()`. In an ADR 0013 addendum, add writer-thread jobs for `cleanup` (GC + VACUUM) and `put-blobs`; move `storeBlobs`/`storeCopiedMedia` across. Snapshots stay manifests over content-addressed blobs: that design is right, and opening 300 versions measured about 70 ms. |
| A6 | **Only the renderer enforces Site Check's Must-fix gate.** `passesSiteCheck` in the export command is the only code that stops a build. That includes `externalResources`, which enforces the "no external requests" hard rule. The export IPC handler and the worker build whatever they are given. ADR 0016 plans for 4.5 to check in the renderer, but "republish a version" builds a stored version that may never have passed the publish check. | `renderer/export/export-command.ts:130-136`, `main/export-ipc.ts:110-140`, ADR 0016 | medium | A republished manual or daily version could put external scripts or broken required fields live: the X5 guarantee fails. | ADR 0016 amendment before 4.5. Add `publishGate(doc, target)` to site-check. Main's publish and republish handlers run it on the `SiteDoc` they build from (A4) and refuse with `must-fix` before asking the worker. The renderer keeps its check for the panel's UX. Test that a version with an external script can't be republished. |
| A7 | **Session scoping (R6) is opt-in per channel.** `site:export`, `site:export-choices`, `site:set-export-choices`, `preview:open/update` and the AI bridge carry no session id. ProjectSession still exposes unscoped `readMedia`, `exportChoices` and `setExportChoices`. The AI bridge's `listening` flag is never reset on reload. | `shared/ipc/site.ts:195,210`, `shared/ipc/preview.ts:37,43`, `main/project-session.ts:401,417,428`, `main/export-ipc.ts:119-138`, `main/ai-ipc.ts:65-96` | medium | A hand-off while the export folder dialog is open builds site A's snapshot against site B's blobs (missing images), stores A's export choices in B, and makes B's *Open export* open A's. During a reload, AI requests time out as `busy` after possibly running, so the app retries and the change happens twice. 4.5's publish and 4.6's versions would copy the unscoped pattern. | Require `sessionIdSchema` on every channel that touches the open site, including the future publish and version channels, and add a contract test listing them. Make `forSession(id)` the only way into ProjectSession. Capture it when an export, preview or publish starts. In ai-ipc, reset `listening` and settle pending requests as `not-found` when the window reloads. |
| A8 | **The remote manifest doesn't say which site wrote it.** `.webforge-publish.json` is `{version, files}`. A second site published to the same FTP/SFTP folder diffs against the first site's manifest and deletes every file it doesn't have. | `publish/src/manifest.ts:12-15`, `publish/src/remote-folder.ts:68-70` | medium | Copies are about to become common: several destinations per site (4.4), open a version as a new site (4.6), ZIP import (4.7). Pointing a draft copy at `/public_html` silently replaces the live site, with no rollback on FTP. | Manifest v2 (still reading v1) records `site: {projectId, destinationId}` and `publishedAt`. When the folder holds another project's manifest, refuse with `PublishError('other-site')` before uploading; 4.5 asks "This folder has another site published with {appName}. Replace it?" Netlify needs nothing. Do it with 4.3/4.4. |
| A9 | **Puck 0.24.0 shipped on 29 Oct, and our patch can't be re-applied to it as written.** The 433-line patch edits hashed dist file names that 0.24 renamed. 0.24 still has the whole-page permissions walk, so the patch is still needed. Each change is written three times: ESM, CJS `index.js`, and `no-external.js`, and the last two look unreachable. Items 1 and 2 of ADR 0007 (skip the permissions walk and the fields re-publish, worth about 8 ms per keystroke) are checked only by the on-demand `e2e:perf`. | `patches/@puckeditor__core@0.23.0.patch`, ADR 0007, `engine/src/puck/puck-dom.test.tsx:169-195` | medium | The canvas is the product's core, and no plan item covers the upgrade. When one is forced (a security fix, or a React or Tiptap bump), it blocks stream C. A rewritten patch can silently drop items 1 and 2: a typing regression ADR 0007 measured, which `pnpm check` won't catch. | A time-boxed chore, "Evaluate and take Puck 0.24". Rewrite the patch against the ESM chunks only, after proving the CJS copies are never loaded. Add a mounted `patch-contract.test.tsx` with one assertion per ADR 0007 item; for items 1 and 2, the `permissions` and `fields` slices keep their identity after a `replace`. |

## R1–R17: status on `main`

| # | Issue | Status | What remains |
| --- | --- | --- | --- |
| R1 | #234 | holds | – |
| R2 | #235 | holds | Low drift from ADR 0010: three manual memo hooks are back. `StartScreen.tsx:88`'s `useCallback` is relied on for correctness, which ADR 0010 §5 rules out. `chrome.tsx:508` still has a `useLayoutEffect` with no dependencies |
| R3 | #236 | holds | The storage writer thread (added after R3, ADR 0013) has no crash routing: its `error`/`exit` only fail the pending jobs (`main/storage-writer.ts:106-111`) |
| R4 | #237 | holds | – |
| R5 | #238 | holds | – |
| R6 | #239 | holds where applied | Export, export choices, preview and AI carry no session id (A7) |
| R7 | #240 | holds | – |
| R8 | #241 | holds | Watch items: `puck-engine.tsx` is at 445 lines against a ~450 target with no guard; `chrome.tsx` (563) is now the engine's largest file; E2E repeats Puck selectors (A20) |
| R9 | #242 | **partial** | PageSettings and StyleDialog subscribe to the whole document even while closed. `selectElements` writes the UI store outside `editor-session.ts`. The first review's `editPanelController` and `connectEditor` extractions were never ticketed, and both files grew (A10, A21) |
| R10 | #243 | **partial** | 9 branded-id casts are back (`as PageId`, `as keyof SiteDoc`) with no guard. List and attribute edits are still written unvalidated (A11). `menu-actions.ts:25` re-types `MAX_LABEL = 100` beside `MENU_LABEL_MAX` |
| R11 | #244 | holds | Minor: `swatch-field.tsx` has no disabled story |
| R12 | #245 | **partial** | `WebforgeError.messageKey` is read nowhere in the app, so standards §4 describes neither of the two patterns in use (A23). Biome's `noConsole` isn't on, so nothing keeps `console.*` out of new publish code |
| R13 (a–d) | #246, #407–#410 | holds | `startApp` is one ~480-line closure (A12). Paste-from-another-site and bundle downloads still write blobs on main (A5) |
| R14 | #247 | holds | Fixtures v1–v11 and the round-trip property hold through format 11 |
| R15 | #248 | holds | – |
| R16 | #249 | holds | – |
| R17 | #250 | **not done** | Every criterion is open. The `ProjectStore` interface in spec/01 §6 now matters, because 4.6 and 4.7 will be planned against it. Move it from Phase 5 to Phase 4, before 4.6 |

## Main process

**Findings**
- **A2**, **A5** and **A7** (above).
- **A12. `app.ts` is one ~480-line closure holding feature logic, with teardown wired in three places** (medium). `startApp` (`main/app.ts:144-624`) holds untested feature glue as well as wiring:
  - `fontsOf`, and the preview font cache keyed by `JSON.stringify(theme.fonts)` (310-350);
  - the export `open` handler (528-537);
  - the templates cache;
  - `siteFonts` (629-667).

  Teardown is split between the single-callback `ProjectSessionEvents.closed` (213-220), `will-quit` (598-603) and window listeners. Phase 4 adds the credential store, Netlify sign-in, destinations, the publish runner (which must abort on close and quit), automatic versions and the MCP server ("runs only while a site is open"). A missed hook, such as a publish left running through quit, is easy to miss in review.

  Fix: each feature module exports `createXFeature(deps)` → `{ register(ipc, isTrusted), siteOpened?, siteClosed?, quit?() }`. ProjectSession emits to a list of listeners, and `closeThenExit` awaits every `quit`. Start by moving `fontsOf` and the font cache into `site-fonts.ts` with tests.
- **A13. `ProjectSession` is the gateway for every store operation, and 4.6/4.7 would roughly double it** (medium). The class is 707 lines and mixes lifecycle (create/open/close/replace, the gate, session ids) with every feature operation. Four of those come as a public method, a `#private` twin and a `forSession` entry. Each maps its own errors: `instanceof ReadOnlyProjectError` appears 5 times, and `errorCode()` has one call site in main. It also imports feature knowledge downward (`createImportJobs`, `BUNDLE_MIME_TYPES`). The gated accessor pattern already exists for backups (`SiteStoreAccess`, `#accessTo`, 140-160) and nothing else uses it.

  Fix: keep ProjectSession to lifecycle, the gate and identity, and expose `site(sessionId).withStore(mode, work)`. Move feature operations into `site-media.ts`, `site-versions.ts` (4.6) and `export-choices.ts`, with one `storeFailure(error)` helper. Do it as 4.6's first PR.
- **A14. Three hand-written worker clients, and no single long-running job pattern from IPC down to the worker** (medium). `export-worker-client.ts` (163 lines), `preview-builder.ts` (147) and `worker-requests.ts` (72) each re-implement lazy start, kill on timeout and discard-on-invalid-message. The first two contain the same `read-blob` responder almost line for line. `export-worker.ts:72-84` dispatches 7 job types through a nested ternary, and its failure answers carry no `id`. At the IPC level, `cancelExport` aborts every export, and `site:export-progress` has no operation id. `main/project-session.ts` imports `../worker/store-import.js`, which imports `../main/*`: a directory-level cycle `no-circular` doesn't catch. 4.5 needs a fourth client, and an export and a publish can overlap.

  Fix: one `workerChannel(start)` (id-correlated, typed outcome per job, progress stream, `AbortSignal` → `cancel`, timeout with kill, optional `readMedia` responder), and a dispatch table on the worker side that always echoes `id`. At the IPC level, start returns an `operationId`, progress carries it, and `cancel(operationId)`. Move `document-files.ts`/`media-files.ts` to `shared/`, and add a dependency-cruiser rule.
- **A15. Five userData JSON stores, each with its own atomic-write, queue and damaged-file policy** (medium).
  - `preferences.ts` turns any read error into defaults, then overwrites the file.
  - `my-themes.ts` queues writes, retries locked renames and moves a damaged file aside.
  - `credential-store.ts` has a queue, but no lock retry. A file that won't parse becomes `{}`, and the next `set` overwrites it, losing every saved secret.
  - `recent-sites.ts` uses sync fs with no retry.

  4.3 (host keys, S2), 4.4 (fingerprints) and 4.9 (paired apps) each add another file. A rename that fails on Windows becomes "couldn't save your password".

  Fix: `createJsonStore(file, schema, { onDamaged })` with an ordered queue, temp + rename with lock retry, and zod. Move the credential store onto it first, and namespace its keys (`publish/<projectId>/<destinationId>`, `mcp/<appId>`) before 4.4 writes real data.

**What holds**
- **IPC.** The IPC layer is uniform. One domain shape (`shared/ipc/<d>.ts`, `preload/api/<d>.ts`, `main/<d>-ipc.ts`, `pnpm scaffold ipc-domain`). A sender check and zod on every channel, both ways. `app.test.ts:217` asserts every contract channel is handled and no other. The preload re-parses every event and response. The contract grew from 22 channels to 52 + 4 events across 12 domains without losing this.
- **Store gate.** ADR 0013 is sound: shared and exclusive turns in arrival order, a bounded close, and the writer stopped if close comes mid-write.
- **The first review's fixes.** R13 holds: `index.ts` is 21 lines, `app.ts` runs against a fake Electron, imports are hashed and stored on the writer thread, and the media protocol doesn't copy. R15 holds: workers pull blobs one at a time, exports are cancellable, and the pipeline cache lives only while the site is open.
- **Coverage.** Exclusions are narrow and justified; 56 of 64 main modules have their own tests.
- **Seams for Phase 4.** `siteToSnapshot` is in model, `NewSiteFill` lets "open as new site" reuse New Site's path, and `AiBridge` is the one place 4.9 forwards through.

## Renderer

**Findings**
- **A10. `EditPanelHost` is still the Edit panel's controller inside a component, now 882 lines** (medium). The first review asked for an `editPanelController` at 484 lines, but no R-issue tracked it.
  - The component (from line 328) rebuilds every field with provenance, gradient source, look reset and device rows on each render, and holds eight document-writing closures around a ref-held `Run` state machine.
  - It serves two hosts through mode props (Edit panel, Style dialog: `appearanceOnly`, `dialogGroups`, `styleAction`, `contentOnly`, `advanced`, `itemCss`).
  - Theme Studio imports `specOf` from it, and docs/extending.md (step 6) and docs/components.md send authors to it.
  - Its test is 1,187 lines, and exercises pure write logic by rendering.

  Fix: split it into `edit-panel-fields.ts` (`specOf`, pure `fieldsFor`), `edit-panel-controller.ts` (`createEditPanelController(session, …)` owning `Run`, unit-tested without React), and a ~150-line binding. Move most of the test across.
- **A11. Four rules for what a field accepts, three of them weaker than `fieldValueSchema`** (medium, bug). `accepts()` (`EditPanelHost.tsx:166-187`) falls through to `typeof value === "string"` for select, slider, spacing, text and code. So Paste writes options the target doesn't offer: Section `gap: "none"` pasted onto Columns records "Pasted Options on Columns" and stores a value off its scale. List edits are cast with `value as ListChange` (605) and written without checking `list.fields` (`list-edit.ts:113-119`), as the first review found. Canvas drags have a third rule (`field-drag.ts:10`). Invalid values become undo steps and are autosaved, and 4.8/4.9 bring AI edits that follow a different rule.

  Fix: export one `acceptsFieldValue(field, value, { responsive })` from site-components, built on `fieldValueSchema`'s per-kind schemas. Use it in change, paste, `changeList`, field drags and commands. Remove step 6's `accepts` from docs/extending.md. Add regression tests for the gap paste and an unknown list field.
- **A16. Areas reach main in three ways** (low).
  1. Per-call App props: export's five calls each appear in `AppProps`, a `…WithPreload` default, an `exportSiteRef` latest-ref mirror (the pattern R9 removed) and `WindowContext`.
  2. Direct `window.webforge` calls, in 24 renderer files.
  3. The test kit's `fakePreloadApi()`, which nothing uses.

  4.4–4.9 add about 20 calls. Fix: `api: WebforgeApi` on `AreaContext`, with one `api?` prop on `App` defaulting to `window.webforge`. Delete the per-call props and the ref, and record the rule in docs/extending.md. Before 4.4.
- **A17. The export flow's building blocks are private to the export area** (low). The Site Check gate, the cancellable progress toast and the web-address prompt are module-private in `export-command.ts:130-218`. 4.5 needs the gate (in `publish` mode) and the toast, about 50 lines. Fix: extract `gateOnSiteCheck` and `runWithProgress` into `editor/` or `shell/` before 4.5.
- **A18. Five value-equality helpers with different semantics** (low). editor-ui's `sameValue` counts `undefined` keys, while the engine's and `theme-edits.ts`'s ignore them. `differsFromDefault`, `setLook` (`theme-edits.ts:253`) and `makeThemeLook` use key-order-sensitive `JSON.stringify`. These decide whether an undo step and a D7 question happen. Fix: one `sameJson` in model.
- **A21. `Editor.tsx` still registers Undo/Redo, Undo History and the Edit panel by hand** (low). They sit outside the area list (`Editor.tsx:312-341, 484, 517`; 583 lines, 469 on 23 Oct). Version History (4.6) belongs beside Undo History. Also, `SiteWideConfirm.setBeforeSiteWideAction`, the hook 4.6 is meant to use, is left out of both `WindowContext.siteWide` and `EditorContext.siteWide`. 4.6's scope doesn't say which actions take an automatic version. Fix: `undoHistoryArea` and `editPanelArea` in `editor-areas.ts`, expose the hook, and state the rule in #74.
- **A22. One-component-per-file isn't followed, and spec/03 §4 still says it is** (low). `QuickStartDialog.tsx` has 8 components, editor-ui's `edit-panel.tsx` 7 in 1,000 lines, and `NewSiteDialog.tsx` 6, exporting 5. Phase 4's dialogs will copy whichever pattern they see. Decide: amend §4 to "one exported component per file", or split.

**What holds**
- **R9.** No `useSyncExternalStore` on the document. Reads go through `use-document.ts`, and the JSON.stringify page-list detectors are gone.
- **R10.** `useRowDrag` serves Layers and Menu, and the form primitives live in editor-ui.
- **R11.** `FieldSpec` is a discriminated union, renderers come through context, and there are 28 editor-ui story files.
- **The B1 areas composition root works:** 15 editor areas and 13 window areas, registered and disposed in order.
- **Large files that are fine.** `LayersPanel.tsx` (703) is presentational, over injected actions. `QuickStartDialog.tsx`'s logic is in `quick-start*.ts`. `theme-edits.ts` is a framework-free module where every change is one labelled step. `editor-session.ts` is the only writer of the UI store.
- **Shell seams for Phase 4:** `COMMAND_IDS.publish` and `saveVersion` are reserved, and the title bar draws the Publish button.

## Engine and canvas

**Findings**
- **A9** (above).
- **A19. Puck's canvas DOM structure is encoded in the themes package** (low). The canvas stripe selector (`themes/src/theme-css.ts:178-181`: drop zone, then one Puck wrapper per section, then the section) sits outside `puck-dom.ts`. It is tested only against hand-written DOM, and up to 3 dead `.wf-sections` rules ship in every exported site. Fix: themes exports `evenSectionRules(selector)`, and the engine builds the canvas variant from `puck-dom` constants.
- **A20. E2E keeps its own copy of Puck's DOM contract** (low). 18 files under `e2e/app` hard-code about 40 Puck and Tiptap selectors. Six attributes (`data-puck-rte-menu`, `data-puck-entry`, `data-puck-dragging`, `data-puck-disabled`, `data-dnd-placeholder`, `data-puck-line-placeholder`) are named nowhere in `puck-dom.ts`. Fix: export the constants through a React-free `@webforge/engine/puck-dom` subpath, add the six with mounted assertions, and import them in E2E.
- **A24. The echo contract is still a timing flag, and the public interface doesn't state it** (low, plausible). `CanvasPage.apply` adopts any change that arrives while `sync.isReporting()` without comparing it (`canvas-page.ts:247-251`). `CanvasEngine.onUserEdit` and `applyChange` don't say the edit must be taken over synchronously and unchanged, and ADR 0004 still describes the old deep-equality check. No current caller breaks it. 4.8/4.9 add wrappers. Fix: TSDoc now; later an explicit `applyChange(change, { echoOf: revision })`. In dev and test builds, assert the echo deep-equals what's shown.
- **A25. Each render-context change rebuilds the whole Puck config and redraws every component** (low). `redraw()` (`puck-engine.tsx:231-237`) runs on every real change to Media, a theme look, a toolbar preview or Site Settings. No perf test measures it on the 225-node page. Fix: add a `setLooks`/`setPreviews` case to `large-page.perf.ts` before 5.1 sets budgets.

**What holds**
- **R8 is met.** `puck-engine.tsx` is 445 lines of wiring. The reentrancy flags live only in `canvas-sync.ts`, set through `during()`.
- **Puck's DOM contract has one home.** `puck-dom.ts` names 17 selectors plus the patched private API, with a mounted upgrade test.
- **Puck stays out of the app's code.** No Puck or Tiptap import, selector or zone concept in `apps/desktop`, and the `CanvasEngine` types carry no zone strings.
- **The patch is documented.** Every change is listed in ADR 0007 for re-application, and the private-API, flush and eager-editor changes have unit tests.
- **Tiptap is deduplicated:** one `@tiptap/core`, shared by Puck and the engine.

## Model, storage and history: ready for Version History (4.6) and project ZIP (4.7)?

Not yet. The storage design is right for 4.6: versions as manifests over content-addressed blobs. But the table, the snapshot source, the restore path and garbage collection all need work first (A1, A4, A5).

**Findings**
- **A1**, **A4** and **A5** (above).
- **A26. 4.7's ZIP and 4.6's "open as new site" need one site-package shape** (medium). The pieces exist in three places:
  - `fillNewSite` (`main/new-site.ts:69-97`) already builds a `.wforge` from site JSON plus hashed images, through the storage writer, with `migrateSite`.
  - A template folder (`template.json` + `images.json` + `images/`) is already a documented JSON-plus-media layout.
  - "Which blobs a site reaches" is private inside GC (`collectHashes`).

  The non-site `meta` (editor mode, export choices, ignored Site Check findings) and the asset metadata are in no package shape, and 4.7's "lossless round trip" needs a decision on them. Without a shared shape, 4.7 (next in stream B) invents a fourth format.

  Fix: define one `SitePackage` schema (site.json read through `migrateSite`, a media manifest with names and dimensions, files/, and an explicit `project` block) beside the template schema. Export `reachableBlobs()` from storage. Make ZIP import and open-as-new-site `NewSiteFill`s.
- **Restore as one undo step has no model support** (low, plausible; part of the 4.6 prep). `HistoryManager` ignores a recipe's return value, so `run(label, () => versionSite)` does nothing. The obvious working version replaces top-level fields, which emits `['pages']` patches. Then `datePages` (`page-updated.ts:16-30`) leaves restored pages with stale `updated` dates (wrong sitemap `lastmod`), and the next autosave rewrites every document. Fix: a `restoreSite(draft, target)` helper in model that assigns per document only where the JSON differs, with property tests: restore then undo is identity, one restore is one entry.
- **Copied elements carry no site format** (low). `copiedElementsSchema` has no `formatVersion`, although ADR 0012 said to add one "before the first release". The format has since gone from 6 to 11, and steps 5 and 9 rewrite Section props, so a Section copied in the previous build pastes with its padding or content width reset. Fix: add `formatVersion`, migrate older payloads on paste, and refuse newer ones.

**What holds**
- **History.** R5 holds (`HistoryError('reentrant')`). The patch model with a budget, a `finish` hook and `mergeSince` is enough to build restore on.
- **Migrations.** R14 holds through format 11 (fixtures v1–v11, a down-and-up property). `readSite` migrates in memory, and the first commit writes the migrated site (ADR 0003 §7, ADR 0012 rule 5).
- **GC** is conservative and correct where it runs, with a fast-check property. It just isn't called (A1).
- **Backups and versions don't overlap.** Backups are whole-file copies outside the file, for damage recovery. Versions live inside it, for the person.

## Publish package: ready for 4.4, 4.5 and 4.6?

The interface is right. Where it runs (A2), where destinations live (A3) and what it builds from (A4) are not decided.

**Findings**
- **A2**, **A3**, **A4** and **A8** (above).
- **A23. Publish errors can't carry 4.5's failure guidance** (low). Seven of `PublishError`'s eight codes share `errors.publishFailed`. Nothing in the app reads `WebforgeError.messageKey`: export maps codes to keys at the UI instead. A timed-out Netlify deploy and an unexpected response both collapse into `failed`. Fix:
  - Export `PUBLISH_ERROR_CODES` as a const array, and derive the type and the IPC zod enum from it.
  - Add a `timeout` code and per-code `publish.failed.<code>` keys, with a ui-strings test.
  - Put credential states (no secret, S2 mismatch, encryption unavailable) in 4.4's IPC result.
  - Settle standards §4's `messageKey` in R17.
- **Three copies of an abortable sleep** (low): `netlify.ts:107` rejects on abort, while `netlify-sign-in.ts:29` and `verify.ts:31` resolve. Keep one `sleep(ms, signal)` when 4.4 or 4.5 next touch these files.

**What holds**
- **The interface matches architecture §6:** `test`, `publish` → `AsyncIterable<PublishEvent>` with an `AbortSignal`, and an optional `verify`. `publishSite` adds the live check with the cancel behaviour 4.5 needs.
- **Incremental publishing survives several destinations:** the manifest lives on each host, and Netlify diffs by digest. The crash-safe manifest protocol (pending digests first, old entries kept until clean-up ends) is careful and tested.
- **FTP and SFTP** share one tested flow through a small `RemoteFolder` port, with upload-then-rename.
- **The Netlify client** puts zod on every response, retries only idempotent methods, and never puts the token in messages.
- **No overlap with the pipeline.** The pipeline's `BuiltSite.files` fits `BuildOutput` without an adapter, `BuildMode` already has `publish`, and publish duplicates nothing.
- **Tests:** 100 pass against local FTP, FTPS and SFTP servers and a fake Netlify.

## Pipeline, Site Check, themes, components and commands

**Findings**
- **A6** (above).
- **Theme looks are invisible to Site Check and the AI command queries** (medium). The rule "own value, else the kind's look, else the default" is `withLook` (`site-components/src/library.ts:203-212`), in the React entry, which site-check and commands may not import.
  - `underlinedTextRule` reads `lookUnderline` from node props only. A Text look that underlines every Text gives no tip.
  - The `fields` query reports the default where a look applies (`commands/src/queries.ts:104`).

  Looks are now the main way a theme styles components. Fix: move `withLook` into model as `effectiveValues(node, defaults, looks)` with provenance (`own` / `look` / `default`). Use it in `eachFieldValue` and the `fields` query, with tests.
- **Contrast is judged against the page's surface inside a Reversed section, and Site Check never checks element colour fields** (medium). Both `contrastRule` (`site-check/src/rules/look.ts:40`) and the Edit panel's `ColourField` (`renderer/fields/color/ColourField.tsx:212`) measure against `base-100`. A Reversed section draws with the inverse palette, and `lookBackground` gives any element its own surface. Site Check also skips `color`/`lookColor`/`lookTitleColor`, and the size-aware threshold `contrastNeeded` exists only in the renderer. So the panel and Site Check disagree, and both are wrong in coloured sections. Fix: move `contrastNeeded` into themes, add `surfaceAt(site, place, nodeId, looks)`, and use both in the panel and the rule, extended to colour fields.
- **Fields a layout hides are still exported and still checked** (low). `mediaUsedBy`, `documentsLinkedBy` and Site Check's `eachFieldValue` ignore `variantHides`. A Hero switched to *Text only* still has its old image encoded at every width and written to `assets/img/`, and Site Check reports alt text for a field the panel hides. Fix: skip `fieldsHiddenBy(def, values)` in the walkers, and put `variantHides` into `catalogue-data.json`.
- **The commands package needs small additions for 4.9** (low). Tools have no `description` field; descriptions exist only as JSDoc, so the MCP server would keep a parallel list. The content/style split is written three times: `isContent`, `TOKEN_KINDS` and the renderer's `fieldGroupOf`. Fix: give each entry a `description`, export one `AI_TOOLS` list with JSON Schemas that main registers from, and write each field's resolved group (and #658's `sensitive`) into the catalogue data.
- **With the preview server open, exports and previews take turns recompiling Tailwind** (low). `createStyleCompiler` keeps one compiler, and preview and export sources never match (`pipeline/src/css.ts:139-146`), so each switch pays about 100 ms. Fix: one compiler per `grow` flag, and separate page caches.

Refuted and dropped: a claim that Site Check and the pipeline don't know where a site is published, so 4.2/4.5 would block Netlify publishes. The "netlify" form default is a deliberate placeholder whose wiring is 4.2's own scope (#70).

**What holds**
- **The first review's fixes.** R7 holds: `/schema` and `/catalogue-data` entries, with dependency-cruiser rules. R15 holds: cancellable builds, a 256 MB in-memory image LRU, and workers pulling blobs. R16 holds: no `dom` lib in the pipeline, and `sitePathSchema` in `writeSiteFolder`.
- **ADRs 0016 and 0017 match the code.** Site Check is framework-free and its findings carry ids, never text. Custom CSS and JS are hashed files.
- **The page cache key is sound:** `RenderContext` has no theme field.
- **Single sources.** Theme CSS comes from one place, `@webforge/themes`, and form-unset logic from one place in model.
- **`catalogue-data.json` staleness** is caught by a file snapshot.

## Proposed issues

Grouped by when they are needed. Nothing is opened until the product owner says go.

| # | Issue | Findings | Type | Est | Needed by |
|---|---|---|---|---|---|
| 1 | Run storage garbage collection when a site closes | A1 | `type/bug` | 0.5 | now |
| 2 | ADR: which process publishes, where destinations live, and how a version is built and gated | A2, A3, A4 (decision), A6 | `type/docs` | 1 | before 4.4 |
| 3 | Destinations out of SiteDoc: per-site store, one shape, mappers to each publisher | A3 | criteria on #72 (4.4) | – | 4.4 |
| 4 | Every site-touching channel carries a session id; the AI bridge resets on reload | A7, R6 remainder | `type/bug` | 1.5 | before 4.5 |
| 5 | Remote manifest v2 names its site; refuse to overwrite another site's folder | A8 | criteria on #71 (4.3) | – | 4.3 |
| 6 | Storage format 2 for Version History, the first real schema migration, and writer jobs for clean-up | A5, restore helper | `type/chore` (4.6 prep) | 1.5 | before 4.6 |
| 7 | One snapshot and publish/version flow in main; `readVersionSite`; Site Check gate in main | A4, A6 | criteria on #73 (4.5) and #74 (4.6) | – | 4.5 |
| 8 | Main-process seams: feature modules in `app.ts`, ProjectSession to lifecycle only, one worker channel with operation ids | A12, A13, A14 | `type/chore` | 3 | before 4.5 (split into three PRs) |
| 9 | One JSON-store helper for userData; namespaced credential keys | A15 | `type/chore` | 1 | before 4.4 |
| 10 | Edit panel controller out of `EditPanelHost`; one field-acceptance rule | A10, A11 | `type/chore` + `type/bug` | 2.5 | before 4.10 |
| 11 | Renderer seams: `api` on the area context, a shared build-flow module, Undo History and Edit panel as areas | A16, A17, A21 | `type/chore` | 1.5 | before 4.4 |
| 12 | Evaluate and take Puck 0.24, with a mounted patch-contract test | A9, A19, A20 | `type/chore` | 2 | stream C, time-boxed |
| 13 | SitePackage schema shared by ZIP export/import and open-as-new-site | A26 | criteria on #75 (4.7) | – | 4.7 |
| 14 | Looks and surfaces in Site Check and commands: `effectiveValues`, `surfaceAt`, hidden fields skipped | the three Site Check findings | `type/bug` | 2 | before the beta |
| 15 | Smaller consistency fixes: value equality, the clipboard format version, branded casts, memo drift, storage-writer crash routing, the abortable sleep, the Tailwind compiler per mode, the canvas redraw measurement | A18, A22–A25, R2, R3, R10 remainders | `type/chore` | 2 | when nearby |
| 16 | Move R17 (#250) to Phase 4 and add the `messageKey` decision | R12, R17, A23 | edit #250 | – | before 4.6 |
