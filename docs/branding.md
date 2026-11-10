# Branding: the app's name and icons

"Webforge" is a working title (#450). Renaming the app touches two places, the logo and the beta's pages. The identifiers listed below stay as they are, whatever the app is called.

## What changes with a rename

| What             | Where                                                      | Used for                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The app's name   | `app.name` in `packages/i18n/src/en/app.ts`                | Every UI string that names the app. Each message writes `{appName}`, and `t()` and `template()` fill it in from `app.name`. That covers the window title, the title bar, About, the macOS application menu and `getAppInfo`. In development, main's `app.setName`, which names the About panel and the menus.             |
| The product name | `productName` in `apps/desktop/electron-builder.yml`       | The installers and the app bundle (`Webforge.app`, `Webforge-Setup-….exe`), and so the installed app's user data folder. In development, the macOS menu, Dock and About panel: `pnpm dev` gives Electron's own `Electron.app` this name and signs it again ad hoc (`tools/src/ensure-electron.ts`, not yet run on a Mac). |
| The logo         | `apps/desktop/branding/`, drawn into `apps/desktop/build/` | The logo's masters, and the app icons `pnpm app-icons` draws from them ([below](#the-logo)). The icon's letters, **WF**, are the name's initials, and the wordmark spells the name out: both are redrawn for a new name.                                                                                                  |
| The beta's pages | `.github/ISSUE_TEMPLATE/beta-*.yml` and `docs/beta/`       | The beta's issue forms and testers' guide, which testers read on GitHub. Nothing fills in `{appName}` there, so they spell out the name.                                                                                                                                                                                  |

`pnpm ui-strings` fails on a catalogue message that spells out the name rather than taking `{appName}`, so the name can't creep back in.

## The logo

The product owner approved the logo on 10 Nov 2026 ([#454](https://github.com/nexustech/webforge/issues/454)). Its masters are in `apps/desktop/branding/`:

| File                 | What                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `icon.svg`           | The icon, from 48 px up: white **WF** in front of an ember flame, on a white anvil, on a charcoal rounded tile. The start screen and About show it. |
| `icon-small.svg`     | The icon at 32 px and below: larger letters, the anvil as a bar and one flame, since the full icon's flame and anvil blur together there.           |
| `wordmark.svg`       | The name: "web" in Sora Regular and "forge" in Sora Bold, lower case, in charcoal, for light backgrounds.                                           |
| `wordmark-white.svg` | The same in white, for dark backgrounds.                                                                                                            |

- **Colours:** charcoal `#2C2C2A`, ember `#D85A30`, white.
- **The letters are outlines,** traced from [Sora](https://fonts.google.com/specimen/Sora) (SIL Open Font License 1.1), so the files never need the font, and neither the app nor the repository ships it. The OFL covers the font software, not artwork made with it.
- **The app's icons are drawn from the masters:** `pnpm app-icons` (`tools/src/build-app-icons.ts`) writes `icon.ico` (Windows, 16–256 px), `icon.icns` (macOS, 16–1024 px, on Apple's icon grid) and `icons/` (Linux) into `apps/desktop/build/`, where electron-builder finds them. A test fails when a master changes and they aren't drawn again.
- **No installer art for the beta:** the Windows installer installs in one click, so it never shows header or sidebar images, and the macOS DMG keeps electron-builder's plain window. Both show the app's icon.

## Development data stays apart

A development build keeps its user data in the folder named after the package, `@webforge/desktop` (for example `%APPDATA%\@webforge\desktop`), even though it shows the app's name. Main reads that path before naming the app and sets it back afterwards. The e2e tests' `--user-data-dir` is kept the same way.

Named after the app, the folder would be the installed app's. The two would then share:

- the single-instance lock: `pnpm dev` would hand its site to the installed app and quit;
- backups, recent sites, _My themes_ and preferences;
- the clipboard folder, downloaded fonts and crash reports.

## What never changes

These are in people's files and sites, and changing them would break both:

- the bundle id, `app.webforge.desktop`;
- the `.wforge` site file extension and its file association;
- the `webforge:` link scheme inside documents;
- the `webforge.js` script in exported sites;
- the `window.webforge` preload namespace.

Code identifiers (`WebforgeError`, the `@webforge/*` packages), log lines and worker process names aren't seen by the people using the app, so they keep the working title too.
