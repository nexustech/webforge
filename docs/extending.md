# Extending the editor

The editor is put together from **areas**: folders under `apps/desktop/src/renderer/` (`site/`, `layers/`, `media/`…), each adding panels, commands, toolbars or connections to the canvas through a few registries. This page says where each kind of addition goes, how it's registered, and what checks it. It comes from plan item 2.20 (#322) and the extensibility review in `docs/reviews/`.

A site component (a Hero, a Heading) is a different thing: it's what people place on their pages, and [docs/components.md](components.md) is its guide.

## Starting one: `pnpm scaffold`

```bash
pnpm scaffold area Bookings
```

| What | Command | Writes and registers |
|---|---|---|
| An area | `pnpm scaffold area <Name> [--window]` | `renderer/<name>/area.ts` and its test, listed in the composition root; its strings file |
| A panel | `pnpm scaffold panel <Name> --area <folder> [--window]` | the panel, its `register…Panel`, a `panelStory()` story and a test; an area for it, listed; its strings |
| Commands | `pnpm scaffold commands <Name> --area <folder> [--window]` | `register…Commands` with one command, and a test; an area for it, listed; its strings |
| A kind of field | `pnpm scaffold field-kind <Name>` | `fields/<kind>/` (renderer, registration, story, test), and the kind in all seven places it touches, storing a string |
| An IPC domain | `pnpm scaffold ipc-domain <Name>` | the contract with one call, the preload's API, main's handler and its test, each registered |

What it writes passes `pnpm check` as it is; then make it what it should be. `--window` registers the area with the window rather than the editor (see [Two lists](#two-lists-the-editors-and-the-windows)). It refuses a name, folder, file or string key that's taken, and writes nothing when it refuses. 2.19's `pnpm new-component` does the same for site components.

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
  - every context: `session`, `commands`, `panels`, `preferences`;
  - the editor's: `toolbars`, `engine`, `siteWide`, `compileCss`, `sectionPreviews`, `editPreviews`, and `dialogs` (the editor's dialogs: naming a shared section, renaming a layer, picking an image);
  - the window's: `siteWide`, `canvasView`, `exportSite`.
- **The canvas engine** is there only while the editor has one mounted. Use `ctx.engine.whileMounted(({ engine, connection }) => connect…)`: it connects to each engine as it mounts and undoes that as the engine goes. Flush the canvas's pending edit with `ctx.engine.flush()` before a command changes the document.
- **Design or Content mode:** follow it with `followLayoutLock(ctx.preferences, (locked) => …)` (`shell/preferences-store.ts`). Never hold a ref for someone else to call.

### Two lists: the editor's and the window's

`EDITOR_AREAS` is connected by `Editor` as its canvas mounts; `WINDOW_AREAS` by `App`, after the shell's own commands (New Site, About, the panel toggles). React runs a child's effects before its parent's, so the Edit menu's commands (all the editor's) come after Undo and Redo, while Export follows Site Settings in the File menu and the zoom commands follow the panel toggles in the View menu. An area needing the canvas engine or the editor's dialogs goes in `EDITOR_AREAS`; one adding to the File, View or Help menus usually belongs in `WINDOW_AREAS`. The window's context is made once, so its areas register once and a panel keeps what it shows.

### Boundaries

`pnpm deps` checks them:
- **Another area only through its `index.ts`** (`renderer-areas-through-index`, B2): the index says what an area offers the others; everything else in its folder is its own.
- **No cycles between areas** (`tools/src/check-area-cycles.ts`): two areas needing each other move what both need into `editor/` or `shell/`.
- **`shell/`, `editor/` and `testing/` are what every area builds on,** not areas. `editor/` reaches an area only through its `index.ts` too (`renderer-editor-areas-through-index`); `Editor.tsx`, which draws the editor's dialogs and menus, is the exception.
- **`renderer/testing/` is for tests and stories only** (`renderer-testing-only-in-tests`).
- **The renderer never imports Node or Electron,** and only `packages/engine` imports Puck.

## Panels

A panel is a tab in one of the window's slots: `left.top`, `left.bottom`, `left.lower`, `right.top`, `right.bottom` or `drawer` (`shell/panels.ts`).
- **Register it** with `panels.register({ id, slot, title: t(…), component, icon?, order?, advancedOnly? })`, from a `register…Panel(panels, session)` function in its area. `order` sorts a slot's tabs, lowest first; ties keep registration order.
- **It has a story,** made with `panelStory()` from `renderer/testing/stories.tsx`, which registers it as the area does and draws it. `tools/src/panel-stories.test.ts` fails for a `register…Panel` without one, and says how to add it.
- **A dialog's story** uses `dialogStory()`.

## Commands

A command is in the command box, and in a menu if it names one (`shell/commands.ts`).
- **Register it** with `registry.register({ id, label: t(…), run, menu?, shortcut?, enabled?, palette?, keywords? })`, from a `register…Commands(registry, …)` function; it returns how to remove it. `registry.update(id, { enabled })` changes it later.
- **Ids are dotted** (`edit.cut`, `site.export`); shared ones are in `shell/command-ids.ts`.
- **A change to the site goes through `session.history`** as one undo step with a meaningful label ("Changed Hero button link"), never around it.
- **Shortcuts** follow the standard (Mod for Ctrl or Cmd). Text keeps its own keys while it's being edited (`textKeys`).

## Contextual toolbars

The selected element's own controls, in the row under the canvas toolbar (SP-4, `shell/contextual-toolbars.ts`): `toolbars.register({ id, types: ["Heading"], component, inContentMode? })`, in an editor area. A toolbar changing the design shows in Design mode only; `inContentMode` for one changing only what an element says (a List's items).

## Kinds of field

What a component's field is (`text`, `select`, `media`, `link`…) decides how the Edit panel draws it (2.20, B5). `FIELD_KINDS` (`renderer/fields/field-kinds.ts`) lists every kind with the renderer that draws it and that renderer's story, and its comment lists the seven places a new kind touches:
1. `FieldDef`, `StoredOne` and `ValueOne` in site-components' `schema.ts`;
2. `valueReader` in `define.ts`;
3. `toPuckField` in the engine, and its every-kind test;
4. `FieldSpecs` in editor-ui;
5. its renderer: the Edit panel's own, or the app's in `renderer/fields/<kind>/`, listed in `fieldRenderers`;
6. `specOf` and `accepts` in `EditPanelHost.tsx`;
7. its story, and its line in `FIELD_KINDS`.

Three tests fail until a kind has all it needs, each saying what to add:
- **Renderer and story:** the renderer's field-kind test (`renderer/fields/field-kinds.test.ts`) checks the kind's renderer and that its story's title exists.
- **Puck:** the engine's every-kind test checks it maps to a Puck field.
- **Type check:** a kind missing from `FIELD_KINDS` doesn't type-check.

`pnpm scaffold field-kind` writes a kind storing a string, drawn as a text box, in all seven places; then make it store and draw what it should.

## IPC domains

The renderer reaches the main process only through `window.webforge`, the preload's typed API (`shared/webforge-api.ts`). A domain is:
- **its contract,** in `shared/ipc/<domain>.ts`: each call's channel (`<domain>:<call>`) and its request and response as zod schemas, which main checks on every call;
- **listed** in `shared/ipc-contract.ts` (`ipcContract` and `ipcDomains`) and in `WebforgeApi`;
- **the preload's builder,** `preload/api/<domain>.ts`, listed in `preload/api.ts`;
- **main's handlers,** `main/<domain>-ipc.ts`, registered with `registerIpcHandler` (which refuses a renderer it doesn't trust), called from `main/index.ts`.

Never log or store site content, credentials or personal data on the way; secrets stay in the OS keychain.

## Strings

No UI text is hard-coded (`pnpm ui-strings` checks): every string goes through `t()` from `@webforge/i18n`, worded from the glossary (`research/product/01-terminology.md`).
- **Each area's strings** are in `packages/i18n/src/en/<area>.ts`, listed in `en.ts`; a test fails on a key in two files.
- **`t(key, params)` is typed by the message:** its `{placeholders}` are the params it needs, checked when it compiles.
- **Counts** use `plural(base, count)`, with `base.one` and `base.other` keys.
- **Code that fills placeholders itself** (a script, Puck) uses `template(key)`.

## Tests and stories

- **The fake canvas engine** is `createFakeEngine()` from `@webforge/test-utils/renderer`.
- **The app's fixtures** are in `renderer/testing/`:
  - `sessionWith(site?, pageId?)`: an editor session on a new site's starter page, unless given another;
  - `registriesForTest({ mac? })`: empty panel, command and toolbar registries, and preferences;
  - `fakePreloadApi(overrides)`: a `window.webforge` in which every call not overridden is a `vi.fn()`;
  - `panelStory()` and `dialogStory()`: the story helpers.
- **Why there are two places:** packages can't import the app, so only the engine fake is in `@webforge/test-utils`, and the helpers typed by the app are in the app (B6). That's a change from the issue's wording.
- **Stories** run in Storybook's axe and screenshot checks (`pnpm visual:docker`; commit new screenshots with the PR). A story that draws after it renders says so with `data-story-state="drawing"` until it has, as `panelStory()` does.
