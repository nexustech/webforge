# Extending the editor

The editor is put together from **areas**: folders under `apps/desktop/src/renderer/` (`site/`, `layers/`, `media/`…), each adding panels, commands, toolbars or connections to the canvas through a few registries. This page says where each kind of addition goes, how it's registered, and what checks it. It comes from plan item 2.20 (#322) and the extensibility review in `docs/reviews/`.

A site component (a Hero, a Heading) is a different thing: it's what people place on their pages, and [docs/components.md](components.md) is its guide.

## Starting one: `pnpm scaffold`

```bash
pnpm scaffold area Bookings
```

| What            | Command                                                      | Writes and registers                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An area         | `pnpm scaffold area <Name> [--window]`                       | `renderer/<name>/area.ts` and its test, listed in the composition root; its strings file; a help page, in Help's contents, and a **?** topic                                                      |
| A panel         | `pnpm scaffold panel <Name> [--area <folder>] [--window]`    | the panel, its `register…Panel`, a `panelStory()` story and a test; an area for it, listed; its strings; its area's help page (written if it isn't there), and a **?** topic for its **?** button |
| Commands        | `pnpm scaffold commands <Name> [--area <folder>] [--window]` | `register…Commands` with one command, and a test; an area for it, listed; its strings                                                                                                             |
| A kind of field | `pnpm scaffold field-kind <Name>`                            | `fields/<kind>/` (renderer, registration, story, test), and the kind in all seven places it touches, storing a string                                                                             |
| An IPC domain   | `pnpm scaffold ipc-domain <Name> --site` or `--app "<why>"`  | the contract with one call, the preload's API, main's handler and its test, each registered, and the call listed as the open site's or the app's                                                  |

What it writes passes `pnpm check` as it is; then make it what it should be. A panel or commands go in the folder `--area` names, or without it the name's own (`pnpm scaffold panel Notes` makes `renderer/notes/`). `--window` registers the area with the window rather than the editor (see [Two lists](#two-lists-the-editors-and-the-windows)). It refuses a name, folder, file, string key or **?** topic that's taken, and writes nothing when it refuses. An area's or a panel's help page (`docs/help/<name>.md`) is a heading and a line to write in the app's words, as `docs/help/README.md` says, and its line in that README's contents (HP-4). 2.19's `pnpm new-component` does the same for site components.

## Areas and the composition root

Each area exports its registrations from an `area.ts` next to its code (2.20, B1):

```ts
import type { Area, EditorContext } from "../editor/areas.js";
import { registerBookingsPanel } from "./register-bookings-panel.js";

/** The Bookings panel. */
export const bookingsPanelArea: Area<EditorContext> = {
  id: "bookingsPanel",
  register: ({ panels, session }) => registerBookingsPanel(panels, session),
};
```

- **`register(ctx)` returns how to remove what it registered.** `connectAreas(areas, ctx)` registers a list in order and removes it in reverse.
- **The composition root,** `renderer/areas.ts`, lists every area in order. Menus, the command box and each panel slot list what is registered in the order it registers, so an area's place in its list is its place there.
- **The context** (`editor/areas.ts`) holds what an area registers into and works on:
  - every context: `api`, `session`, `commands`, `panels`, `preferences`;
  - the editor's: `toolbars`, `engine`, `siteWide`, `compileCss`, `sectionPreviews`, `editPreviews`, `imagePicks` (the Edit panel's image picker, opened from the canvas), and `dialogs` (the editor's dialogs: naming a shared section, renaming a layer, picking an image);
  - the window's: `siteWide`, `canvasView`, `canvasPointer`, `settings`, `windowDialogs`, `siteCheckIgnored` and the previews.
  - `tips` (the window's), the first-time tips (OB-4): `tips.reached("export")` says the person has reached a tip's place, and the onboarding area shows it if it's the first time. A tip that follows a dialog is reached once the dialog has closed (`whenClosed` in `editor/first-tips.ts`); a new tip adds its id to `TipId`, its strings and, if it points at something, an anchor in `onboarding/tips.ts`.
  - `siteWide` in both has `setBeforeSiteWideAction(hook)`: the hook runs before an action that changes every page, once the person has agreed, as 4.6's automatic version before a site-wide action does.
- **Even the editor's own panels are areas** (#668): Undo and Redo with Undo History (`undo-history/`) and the Edit panel (`edit-panel/`) head `EDITOR_AREAS`, so `Editor.tsx` registers nothing by hand.
- **Main only through `ctx.api`** (#668): an area never reads `window.webforge`. It passes `ctx.api.<domain>` (or a call of it) to what it registers, as the Media panel gets `ctx.api.media`. `App` takes the API as one prop, `api`, which is `window.webforge` in the app, and gives the same object to both lists; it is fixed for the window's life. A new call needs no new prop or context field: add it to its IPC domain, and the area calls it.
- **The canvas engine** is there only while the editor has one mounted. Use `ctx.engine.whileMounted(({ engine, connection }) => connect…)`: it connects to each engine as it mounts and undoes that as the engine goes. Flush the canvas's pending edit with `ctx.engine.flush()` before a command changes the document.
- **Design or Content mode:** follow it with `followLayoutLock(ctx.preferences, (locked) => …)` (`shell/preferences-store.ts`). Never hold a ref for someone else to call.
- **A build of the site** (Export, and Publish and Republish from 4.5) composes `editor/build-flow.ts` (#668): `gateOnSiteCheck(site, mode, …)` stops it on a _Must fix_ in that mode and shows Site Check; `runWithProgress(…)` runs it with its progress in a toast whose Cancel button stops it.

### Two lists: the editor's and the window's

`EDITOR_AREAS` is connected by `Editor` as its canvas mounts; `WINDOW_AREAS` by `App`, after the shell's own commands (New Site, About, the panel toggles). React runs a child's effects before its parent's, so the Edit menu's commands (all the editor's) come after Undo and Redo, while Export follows Site Settings in the File menu and the zoom commands follow the panel toggles in the View menu. An area needing the canvas engine or the editor's dialogs goes in `EDITOR_AREAS`; one adding to the File, View or Help menus usually belongs in `WINDOW_AREAS`. The window's context is made once, so its areas register once and a panel keeps what it shows.

### Boundaries

`pnpm deps` checks them:

- **Another area only through its `index.ts`** (`renderer-areas-through-index`, B2): the index says what an area offers the others; everything else in its folder is its own.
- **No cycles between areas** (`tools/src/check-area-cycles.ts`): two areas needing each other move what both need into `editor/` or `shell/`.
- **`shell/`, `editor/` and `testing/` are what every area builds on,** not areas.
  - `editor/` imports no area (`renderer-editor-imports-no-area`, #379). What two areas share, such as the shared sections' and Layers' commands, the links' changes or the settings registry, lives in `editor/`, or in `@webforge/model` when it is a pure function of the document.
  - `Editor.tsx`, which draws the editor's dialogs and menus from the areas, is the exception. `editor/`'s tests and stories may use areas too, through their `index.ts`.
- **`renderer/testing/` is for tests and stories only** (`renderer-testing-only-in-tests`).
- **The renderer never imports Node or Electron,** and only `packages/engine` imports Puck.

### File names

In the renderer, a file whose main export is a component is named after it, in PascalCase: `versions/VersionHistoryPanel.tsx`. A file for registration or logic is kebab-case, even when it draws a small component of its own: `versions/register-version-history-panel.tsx`, `edit-panel/area.tsx`, `add/section-preview.tsx`. A file's test and story take its name (`register-site-panel.test.tsx`, `register-site-panel.stories.tsx`).

### The start screen's code

The start screen draws without the editor's code (#896): `main.tsx` loads `editor-start.tsx`, and with it `App`, with `import()` when a site is open, and on the start screen only once it has drawn and the window is idle (`preloadEditorWhenIdle`, #945). A site opened from the start screen reloads the window, which then finds the editor's code compiled already.

- **Taking one thing from an index takes only that.** The bundler leaves out a module of Webforge's own (`apps/desktop/src`, `packages/*/src`) when nothing it exports is used (`tools/src/bundle-side-effects.ts`). So the start screen can take `hexOf` from `fields/index.ts` without every kind of field, and Puck with them.
- **A module that does something when loaded,** beyond what it exports, is listed in `SIDE_EFFECT_MODULES` there, as `shell/form-messages.ts` is; otherwise it is left out wherever nothing it exports is used. The test fails for an import made only to load a module (`import "./x.js";`) that isn't listed.
- **Keep what the start screen needs out of the editor's modules.** A function the start screen takes from a module that imports a panel brings the panel; `recipeName` has a module of its own for that reason. The start screen's first bundle is measured by `e2e/perf/`'s cold-start check.

## Panels

A panel is a tab in one of the window's slots: `left.top`, `left.bottom`, `left.lower`, `right.top`, `right.bottom` or `drawer` (`shell/panels.ts`).

- **Register it** with `panels.register({ id, slot, title: t(…), component, icon?, order?, advancedOnly? })`, from a `register…Panel(panels, session)` function in its area. `order` sorts a slot's tabs, lowest first; ties keep registration order.
- **It has a story,** made with `panelStory()` from `renderer/testing/stories.tsx`, which registers it as the area does and draws it. `tools/src/panel-stories.test.ts` fails for a `register…Panel` without one, and says how to add it.
- **A dialog's story** uses `dialogStory()`.
- **An editor panel** joins the list of panels `Editor.test.tsx` expects, so a panel an area adds by mistake fails it.

### Window dialogs

A dialog an area opens from anywhere (Theme Studio), not from inside one of its panels, is drawn once by the window: `windowDialogs.register({ id, component })` from a window area (`shell/window-dialogs.tsx`), its open state kept by the area (a store it makes as it registers). A dialog a panel opens for itself stays in that panel.

## Commands

A command is in the command box, and in a menu if it names one (`shell/commands.ts`).

- **Register it** with `registry.register({ id, label: t(…), run, menu?, shortcut?, enabled?, palette?, keywords? })`, from a `register…Commands(registry, …)` function; it returns how to remove it. `registry.update(id, { enabled })` changes it later. A command with `submenu: <id of another command>` is listed in that command's submenu instead of a menu of its own (File › Open Recent), after a separator with `separated: true`; the title bar and macOS's menu bar both draw it. The command box leaves out the item that opens the submenu and lists the submenu's commands, by `paletteLabel` where their menu label needs the submenu's name ("Open Recent: Rosa's Bakery").
- **Ids are dotted** (`edit.cut`, `site.export`); shared ones are in `shell/command-ids.ts`.
- **A change to the site goes through `session.history`** as one undo step with a meaningful label ("Changed Hero button link"), never around it.
- **Shortcuts** follow the standard (Mod for Ctrl or Cmd). Text keeps its own keys while it's being edited (`textKeys`). Keys without Mod are left to a focused field, list or menu, except a function key marked `everywhere` in the standard (F1, F6), which no control types with.
- **Parts of the window:** a new top-level part (a panel column, a bar) carries `data-region` (`REGION_ATTRIBUTE` from `shell/regions.ts`), so F6 and Shift+F6 reach it, in document order.
- **Dialogs** built on editor-ui's `DialogContent` or `AlertDialogContent` give the focus back to what had it when they opened, with or without a trigger; an `onCloseAutoFocus` that prevents the default places it itself.

## Contextual toolbars

The selected element's own controls, in the row under the canvas toolbar (SP-4, `shell/contextual-toolbars.ts`): `toolbars.register({ id, types: ["Heading"], component, inContentMode? })`, in an editor area. A toolbar changing the design shows in Design mode only; `inContentMode` for one changing only what an element says (a List's items).

## Kinds of field

What a component's field is (`text`, `select`, `media`, `link`…) decides how the Edit panel draws it (2.20, B5). `FIELD_KINDS` (`renderer/fields/field-kinds.ts`) lists every kind with the renderer that draws it and that renderer's story. **Its comment is the checklist for a new kind** (#979): the seven places every kind touches, from `FieldDef` to its story, then those some kinds need: its Edit panel group, a file it holds (Media's count and copying), the export's renderer, and the model.

Four tests fail until a kind has all it needs, each saying what to add:

- **Renderer and story:** the renderer's field-kind test (`renderer/fields/field-kinds.test.ts`) checks the kind's renderer and that its story's title exists.
- **Puck:** the engine's every-kind test checks it maps to a Puck field.
- **Type check:** a kind missing from `FIELD_KINDS` doesn't type-check.
- **Files:** `renderer/media/field-kind-files.test.ts` doesn't type-check until a new kind says whether it holds a file, and then checks Media and copying find it.

`pnpm scaffold field-kind` writes a kind storing a string, drawn as a text box, in all seven places; then make it store and draw what it should, and go through the rest of the checklist.

Some kinds belong to no component, so they skip places 1–3, 6 and `FIELD_KINDS`. They need only their `FieldSpecs` entry and a renderer:

- **The forms' own** (`number`, `time`, `choice`, `multiChoice`, `imageChoice`, `action`), drawn by editor-ui. An `action` is a button that runs its `run` at once and holds no value, so Save keeps nothing for it: Settings › App's _Open AI apps…_ (#752), for a dialog that acts as it's used rather than on Save.
- **The Theme tab's** (`themeColor`, `font`), drawn by the app (`renderer/fields/theme-color/`, `fields/font/`, given to the tab by `themeFieldRenderers`).

The form engine's _Every kind_ story lists every kind, so a new one appears there too.

## Site Check rules

A rule (`packages/site-check`, [ADR 0016](adr/0016-site-check-in-the-renderer.md)) is:

- **a `CheckRule`:** an `id`, a level (`must`, `should` or `tip`), `strictOnPublish` if publishing makes it _Must fix_ (X5), and `check({ site, catalogue })`. Three more flags are optional (`src/types.ts`): `group: "found"` lists it under _Being found_ (3.17, SEO-7); `oneTime` makes it a one-time tip, listed only while it has something to say, whose finding is _Done_ rather than ignored; `drafts` gives it the whole site, draft pages included, where every other rule gets the site as it is published (G37, #864). It returns findings, each with a key that stays the same while the problem lasts (what _Ignore_ remembers) and a place the panel can jump to;
- **listed** in `SITE_CHECK_RULES` (`src/check.ts`), in the panel's order;
- **worded** in `packages/i18n/src/en/siteCheck.ts`: `siteCheck.rule.<id>` for its name, `.pass` for its verdict when nothing is found, and `.fail.one` and `.fail.other` for its verdicts that count;
- **tested** with a site built for it (`src/test-site.test-helper.ts`).

`eachFieldValue` walks the values of fields of given kinds, as the catalogue describes them. It leaves out hidden elements and shared sections no page holds, as the export does. A one-click fix, if the rule has one, is the app's: `fixFor` in `renderer/site-check/actions.ts`, as one undo step.

## Collections

A collection (a Blog; later a Portfolio or Events) is a set of pages that share its fields and a design drawn above and below each item's own content ([ADR 0025](adr/0025-collections.md)). The model is `packages/model/src/collections.ts`; a new preset is another entry in `COLLECTION_PRESETS` there, with no code paths of its own. A component's fields show an item's values through bindings: see `itemBindable`, `boundText` and `boundImage` in [docs/components.md](components.md#fields).

## The assistant

The built-in assistant ([ADR 0026](adr/0026-assistant.md), 6.9a–d, #870–#873) runs its loop in main and reuses the AI apps' tools; the renderer only shows the conversation. Its panel and review card are in `renderer/assistant/`, and its contract with main is the `assistant` IPC domain (`shared/ipc/assistant.ts`, `main/assistant-ipc.ts`). The ADR fixes that contract: a change to it needs a note to stream A.

## IPC domains

The renderer reaches the main process only through `window.webforge`, the preload's typed API (`shared/webforge-api.ts`), which areas get as `ctx.api`. A domain is:

- **its contract,** in `shared/ipc/<domain>.ts`: each call's channel (`<domain>:<call>`) and its request and response as zod schemas, which main checks on every call;
- **listed** in `shared/ipc-contract.ts` (`ipcContract` and `ipcDomains`) and in `WebforgeApi`;
- **the preload's builder,** `preload/api/<domain>.ts`, listed in `preload/api.ts`;
- **main's handlers,** `main/<domain>-ipc.ts`, registered with `registerIpcHandler` (which refuses a renderer it doesn't trust), called from `main/app.ts`.

Two windows call main: the editor's, and the Help window (5.4b, HP-10), whose page has its own preload (`preload/help.ts`, `window.webforgeHelp`). `startApp`'s `isTrustedSender` is the editor's page only. A call for the Help window is registered with `helpWindows.isHelpPage` instead, as `help:open-external` is (`main/help-ipc.ts`), so neither window can make the other's calls.

A **?** that opens Help at a page and heading (5.4b) is a topic in `renderer/help/help-links.json` and a `<HelpButton topic="…" />` where it's drawn; `pnpm help-check` fails on a topic whose page or heading isn't there. A new site component needs a heading on its help page for _Help for This Element_, which `help-check` checks too.

A domain with work that must stop when its site closes, or finish before Webforge exits, is a feature (`AppFeature` in `main/app-feature.ts`, A12): its `register`, its `site` events (opened, committed, closed, a site a hand-off replaced included) and its `quit`, made beside its handlers, as `createExportFeature` is, and listed in `startApp`'s `features`. `startApp` registers each, has the project session tell each as sites open and close, and has quitting wait for each `quit` once the site has closed.

An operation on the open site's file is a function of its own module, written on `projectSession.site(sessionId)` (a `SiteStore`, A13), as `site-media.ts`, `export-choices.ts`, `editor-state.ts` and `site-zip.ts` are: `withStore(kind, work, none)` runs it through the store gate, and gives `none` once that opening has gone; only `writerTurn` stores an import. `ProjectSession` itself keeps to opening and closing sites, the gate, the opening's id, and reading and saving the site's documents (`readSite`, `commit`), because every save is checked against the site as last read or saved, which it holds. `forSession` lists the operations a call may use, and `uiState` and `setUiState` hand on to `editor-state.ts`. A write that throws becomes what the renderer is told through `storeFailure`, which logs it by its code only.

A call that reads or changes the open site names the opening of it the page was loaded for, as its first argument (`sessionIdSchema`, the renderer's `siteSession()`; R6, #663). Main reaches the site only through `projectSession.forSession(sessionId)`, so a call that waited for a dialog while a hand-off replaced the site changes nothing in the next one. `shared/ipc-sessions.test.ts` lists every channel, as the site's or another's with the reason, and fails on a new channel until it is listed. `pnpm scaffold ipc-domain` lists its call there: `--site` makes it take the opening first and main refuse a replaced one; `--app "<why>"` gives the reason it needn't.

A long-running call (an export; a publish, 4.5) is an operation (A14): the renderer names each one as it starts it, with a new UUID (`operationIdSchema` in `shared/ipc/site.ts`), its progress events come back under that name, and its cancel names it, so cancelling one stops no other. Main keeps the operations under way by that id, and refuses a second one under an id already running.

Never log or store site content, credentials or personal data on the way; secrets stay in the OS keychain.

A job for a utility process (a build, a thumbnail, the canvas's CSS) is a schema in `workerJobSchema` with its outcome's (`shared/export-worker-protocol.ts`), a handler in `worker/export-worker.ts`'s dispatch table, which TypeScript makes list every kind, and a call from main through `createWorkerChannel(start).run(job, { outcome, timeoutMs, signal?, onProgress?, readMedia? })` (`main/worker-channel.ts`, A14). The channel and the worker's dispatch carry each job's id, its cancel, its progress and its reads of the site's bytes, and fail it on a timeout, an exit or anything the worker sends that isn't asked for. `worker/` imports nothing of `main/`; what both need is in `shared/`.

## Strings

No UI text is hard-coded (`pnpm ui-strings` checks): every string goes through `t()` from `@webforge/i18n`, worded from the glossary (`research/product/01-terminology.md`).

- **Each area's strings** are in one file under `packages/i18n/src/en/`, listed in `en.ts`; a test fails on a key in two files. A new area gets its own (`<area>.ts`). The areas from before then share files, which `pnpm scaffold` knows (`STRINGS_FILES` in `tools/src/scaffold.ts`):
  - `panels.ts`: add, element-menu, layers, links, menu, site;
  - `site.ts`: clipboard, code-trust, media, site-settings, start;
  - `canvas.ts`: edit-panel, shared-sections;
  - `shell.ts`: preview, settings, undo-history (whose panel title, from before it was an area, is in `panels.ts`);
  - their own: export (`export.ts`), storage (`storage.ts`);
  - none of their own: fields (the colour field's are in `components/shared.ts`), perf.

  The scaffold refuses an area it can't place, rather than starting a second file for it.
- **`t(key, params)` is typed by the message:** its `{placeholders}` are the params it needs, checked when it compiles.
- **Counts** use `plural(base, count)`, with `base.one` and `base.other` keys.
- **Code that fills placeholders itself** (a script, Puck) uses `template(key)`.

## Tests and stories

- **The fake canvas engine** is `createFakeEngine()` from `@webforge/test-utils/renderer`.
- **The app's fixtures** are in `renderer/testing/`:
  - `sessionWith(site?, pageId?)`: an editor session on a new site's starter page, unless given another;
  - `registriesForTest({ mac? })`: empty panel, command and toolbar registries, and preferences;
  - `fakePreloadApi(overrides)`: a `window.webforge` in which every call not overridden is a `vi.fn()`, for `App`'s `api`, `Editor`'s and an area's context;
  - `storyPreloadApi(overrides)` (`testing/story-preload.ts`): the same without Vitest, which Storybook doesn't load: a call not overridden does nothing;
  - `panelStory()` and `dialogStory()`: the story helpers.
- **Why there are two places:** packages can't import the app, so only the engine fake is in `@webforge/test-utils`, and the helpers typed by the app are in the app (B6). That's a change from the issue's wording.
- **Stories** run in Storybook's axe and screenshot checks (`pnpm visual:docker`; commit new screenshots with the PR). A story that draws after it renders says so with `data-story-state="drawing"` until it has, as `panelStory()` does.
