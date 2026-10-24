# @webforge/desktop

The Webforge Electron app: main process, preload script and renderer, built with electron-vite and packaged with electron-builder.

## Layout
| Folder | Process | Notes |
|---|---|---|
| `src/main/` | Main (Node) | Window, security hardening, IPC handlers, the open site (`ProjectSession` on `@webforge/storage`) |
| `src/preload/` | Preload (sandboxed) | Exposes the typed `window.webforge` API via `contextBridge`; built as CommonJS |
| `src/renderer/` | Renderer (sandboxed) | React 19 editor UI; no Node or Electron imports |
| `src/shared/` | Main + renderer | IPC contract (zod), `WebforgeApi` type, Content Security Policy |

## Security
- `contextIsolation`, `sandbox` (also `app.enableSandbox()`), no `nodeIntegration`, no `<webview>`, no `@electron/remote`.
- Content Security Policy injected into `index.html` by `electron.vite.config.ts`; in development a per-run nonce admits Vite's inline HMR scripts.
- Pop-ups are denied, navigation away from the app is blocked, and all web permissions are refused.
- Every IPC channel is declared in `src/shared/ipc-contract.ts`; the main process checks the sender frame and validates requests and responses with zod.
- Packaged builds set Electron Fuses (no `RunAsNode`, ASAR integrity, cookie encryption).

## Errors and logs (standards §4, R12)
- **Errors:** errors thrown on purpose are `WebforgeError`s (`@webforge/errors`) with a `code` and the i18n `messageKey` of what the person sees.
- **Main process:** logs through `src/main/log.ts`:
  - `log.info/warn/error(event, context)`, where the event is a fixed sentence and the context holds codes and counts only;
  - `logFailure(event, error)`, which adds the error's name and code (`errorCode`), never its message;
  - context strings that aren't short plain tokens (paths, URLs, text) are written as `[redacted]`.
- **Log file:** `src/main/log-file.ts` sends lines to electron-log's file: `main.log` in the OS's log folder for the app, at most 1 MB plus one older copy.
- **Renderer:** reports a failure it handled with `reportFailure(context, error)` (`src/renderer/log.ts`). That sends only a context (`clipboard.paste`) and the code over `app:log-failure`. Unhandled errors become local crash reports (R3).
- **No console calls elsewhere:** `src/logging.test.ts` fails on any `console` call outside the two `log.ts` files.

## Commands
Run from the repository root (`pnpm dev`) or here:

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the app with hot reload |
| `pnpm build` | Builds main, preload and renderer into `out/` |
| `pnpm preview` | Runs the production build |
| `pnpm package:dir` | Packages the app for the current OS into `release/<version>/` without an installer (used by `pnpm e2e:packaged`) |
| `pnpm package:win` | Builds the Windows NSIS installer (per-user, x64, unsigned) into `release/` |
| `pnpm package:mac` | Builds the macOS arm64 DMG (unsigned) into `release/`; run on macOS |
