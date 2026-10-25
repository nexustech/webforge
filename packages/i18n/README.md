# @webforge/i18n

UI strings (English for the MVP) and the `t()` lookup used by every user-facing string. Wording comes from the glossary in [`research/product/01-terminology.md`](../../research/product/01-terminology.md): Site → Page → Section → Element.

## Public API
- `t(key, params?)`: returns the string for `key`, replacing `{placeholder}`s with `params`.
- `MessageKey`, `MessageParams`: types for keys and params. Unknown keys are type errors.

```ts
import { t } from "@webforge/i18n";

t("app.version", { version: "1.2.0" }); // "Version 1.2.0"
```

## Boundaries
- Framework-free: no React, no Electron. Used by both the main process and the renderer.
- No hard-coded UI strings elsewhere: add a key to the area file under `src/en/` instead (`pnpm ui-strings` checks the renderer, editor-ui, engine and site-components).

## Names that are data, not UI strings
Some names come with the content they name and aren't translated, as a font's family name isn't. The icon picker shows each Lucide icon by its name ("arrow right", from `arrow-right`) and finds it by Lucide's English tags. They are the icon set's own names, like font names, not forgotten strings (PH2-4, 2.9b). A translated icon catalogue can replace them later.

## Catalogue layout
The English catalogue is split by area: one file per area under `src/en/`, assembled in `src/en.ts`. Each key lives in exactly one area (a test checks this), so work on different areas edits different files.

| Area | File | What |
|---|---|---|
| `app` | `en/app.ts` | App name and version |
| `shell` | `en/shell.ts` | Title bar, menus, commands |
| `panels` | `en/panels.ts` | Editor panels (Undo History, Pages, Layers…) |
| `site` | `en/site.ts` | New/open site, Site Settings |
| `storage` | `en/storage.ts` | Saving, backups, recovery |
| `canvas` | `en/canvas.ts` | The page canvas |
| `history` | `en/history.ts` | Undo step labels (D2) |
| `components` | `en/components/<family>.ts` | Site components, a file per family (2.19): their names and fields, exported-site text, the starter page |
| `export` | `en/export.ts` | Exporting to a folder |
| `puck` | `en/puck.ts` | Text inside the Puck editor, mapped by `puckDictionary()` in `@webforge/engine` |

A new area is a new file plus two lines in `src/en.ts` (the `areas` list and the spread into `en`).
