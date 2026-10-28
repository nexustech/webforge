# Branding: the app's name and icons

"Webforge" is a working title (#450). Renaming the app touches two places and the icons. The identifiers listed below stay as they are, whatever the app is called.

## What changes with a rename

| What | Where | Used for |
| --- | --- | --- |
| The app's name | `app.name` in `packages/i18n/src/en/app.ts` | Every UI string that names the app. Each message writes `{appName}`, and `t()` and `template()` fill it in from `app.name`. That covers the window title, the title bar, About, the macOS application menu and `getAppInfo`. In development, main's `app.setName`, which names the About panel and the menus. |
| The product name | `productName` in `apps/desktop/electron-builder.yml` | The installers and the app bundle (`Webforge.app`, `Webforge-Setup-….exe`), and so the installed app's user data folder. In development, the macOS menu, Dock and About panel: `pnpm dev` gives Electron's own `Electron.app` this name and signs it again ad hoc (`tools/src/ensure-electron.ts`, not yet run on a Mac). |
| The icons | `apps/desktop/build/`, referenced from `electron-builder.yml` only | Nothing yet: the repository has no logo or icon. |

`pnpm ui-strings` fails on a catalogue message that spells out the name rather than taking `{appName}`, so the name can't creep back in.

## Development data stays apart

A development build keeps its user data in the folder named after the package, `@webforge/desktop` (for example `%APPDATA%\@webforge\desktop`), even though it shows the app's name. Main reads that path before naming the app and sets it back afterwards. The e2e tests' `--user-data-dir` is kept the same way.

Named after the app, the folder would be the installed app's. The two would then share:
- the single-instance lock: `pnpm dev` would hand its site to the installed app and quit;
- backups, recent sites, *My themes* and preferences;
- the clipboard folder, downloaded fonts and crash reports.

## What never changes

These are in people's files and sites, and changing them would break both:

- the bundle id, `app.webforge.desktop`;
- the `.wforge` site file extension and its file association;
- the `webforge:` link scheme inside documents;
- the `webforge.js` script in exported sites;
- the `window.webforge` preload namespace.

Code identifiers (`WebforgeError`, the `@webforge/*` packages), log lines and worker process names aren't seen by the people using the app, so they keep the working title too.
