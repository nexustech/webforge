# Branding: the app's name and icons

"Webforge" is a working title (#450). Renaming the app touches two places and the icons. The identifiers listed below stay as they are, whatever the app is called.

## What changes with a rename

| What | Where | Used for |
| --- | --- | --- |
| The app's name | `app.name` in `packages/i18n/src/en/app.ts` | Every UI string that names the app. Each message writes `{appName}`, and `t()` and `template()` fill it in from `app.name`. That covers the window title, the title bar, About, the macOS application menu and `getAppInfo`. In development, main's `app.setName`, which names the About panel and the user data folder. |
| The product name | `productName` in `apps/desktop/electron-builder.yml` | The installers and the app bundle (`Webforge.app`, `Webforge-Setup-….exe`). In development, the macOS menu, Dock and About panel: `pnpm dev` gives Electron's own `Electron.app` this name (`tools/src/ensure-electron.ts`). |
| The icons | `apps/desktop/build/`, referenced from `electron-builder.yml` only | Nothing yet: the repository has no logo or icon. |

`pnpm ui-strings` fails on a catalogue message that spells out the name rather than taking `{appName}`, so the name can't creep back in.

## What never changes

These are in people's files and sites, and changing them would break both:

- the bundle id, `app.webforge.desktop`;
- the `.wforge` site file extension and its file association;
- the `webforge:` link scheme inside documents;
- the `webforge.js` script in exported sites;
- the `window.webforge` preload namespace.

Code identifiers (`WebforgeError`, the `@webforge/*` packages), log lines and worker process names aren't seen by the people using the app, so they keep the working title too.
