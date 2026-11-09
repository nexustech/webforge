# 0023. The editor's own scheme, and what may run in the canvas

- Status: Accepted
- Date: 2026-11-08
- Related: #652, security review S5, S7, S8 ([2026-10-30](../reviews/2026-10-30-security-review.md)) and S33 ([2026-11-08](../reviews/2026-11-08-security-review-2.md)), [architecture §3 and §9](../../spec/01-architecture.md), Electron's security checklist (item 18), [ADR 0004](0004-puck-with-webforge-history.md), [ADR 0019](0019-code-trust.md)

## Context

The packaged editor and the Help window loaded their pages from `file://` (`loadFile`). Electron's `GrantFileProtocolExtraPrivileges` fuse was on, as it is by default. That left three gaps of defence in depth:

- **S5:** a `file://` page may `fetch` other `file://` URLs, and its CSP's `'self'` very likely matches them. A script that got into the renderer could read any of the person's files and send them out, which defeats §3's "the renderer never names a file".
- **S7, S33:** `isAppUrl` and `isHelpPageUrl` compared a `file:` URL's path, never its host. `file://attacker.example/<install path>/index.html` passed every sender check and navigation guard. On Windows it opens as a network share.
- **S8:** §3 and §9 said the canvas iframe is sandboxed. It isn't. Puck's `AutoFrame` is a same-origin `<iframe srcDoc>`, and the engine reaches into it: selection, inline text editing, the canvas's styles and the history keys (ADR 0004). A script running in the canvas would have the editor's origin, so it could call `parent.webforge`, the whole preload API.

## Decision

1. **The packaged app's pages come from a scheme of its own:** `webforge-app://editor/index.html` and `help.html`, never `file://`.
   - The scheme is registered before "ready" as standard and secure, with `fetch`. Its pages get an origin of their own, which `'self'` in the CSP names.
   - `webforge-app` is named like the app's other schemes, `webforge-media` and `webforge-font`, rather than the review's `app://`.
   - `main/app-scheme.ts` answers it on the default session with files of `out/renderer` only. It matches the raw URL: plain names in folders, none starting with a dot, of the build's own types, GET only. Anything else is a 404.
   - The dev server is unchanged: in development, pages come from Vite's `http://localhost`.
2. **The `grantFileProtocolExtraPrivileges` fuse is off** (`electron-builder.yml`). No page of the app's is a `file:` one any more.
3. **`isAppUrl` compares protocol and host, never `origin`,** and a `file:` page's path too. Node gives every custom scheme's URL the origin `"null"`, so comparing origins would let any two match. `isHelpPageUrl` builds on it, so the Help window's checks compare hosts as well.
4. **The canvas stays a same-origin frame, and the boundary is what runs in it.** No script of the site's or the person's, and no custom code, ever runs in the Puck frame or anywhere in the editor's page.
   - Custom code that must run while editing will only ever run in a separate `WebContentsView` or partition, with no preload and no route to the editor's.
   - The sanitisers, the CSP (`script-src 'self'`) and code trust (ADR 0019) keep scripts out of the canvas today.
   - `zz-security-customcode-2-…test.tsx` records the frame as it is. A sandbox there would mean revisiting this decision.

## Consequences

- A script in the renderer can no longer read the computer's files, and a foreign host's page is never the app's. E2E checks both: `smoke.spec.ts` in the built app, and `packaged-app.spec.ts` in the packaged one, with the fuse.
- The canvas's frame inherits the editor's origin, as before. Fonts and Media keep their own schemes, which allow any origin.
- Anything that loads a page of the app's uses `appPageUrl`, and a new kind of file in the renderer's build needs its type in `app-scheme.ts`.
- #655 adds a test of the packaged app's fuses that reads them from the binary, this one included.
- §3 and §9 of the architecture say the canvas is a same-origin frame that runs no scripts, rather than a sandboxed one.

## Amendment, 9 Nov 2026 (#893): the code cache

- **The scheme has `codeCache: true`.** V8 keeps the code it compiled for the editor's and Help's scripts in the profile's `Code Cache` folder, as Chromium does for http(s) pages, and later starts use it. The editor's first render comes about 0.26 s sooner from the second start on ([the start-up review](../reviews/2026-11-09-startup-performance.md), recommendation 2).
- **What it grants:** nothing a page can use. Electron passes the scheme to Chromium's list of code-cache schemes and to Blink's `RegisterURLSchemeAsCodeCacheWithHashing` ([electron#40544](https://github.com/electron/electron/pull/40544)). It changes no origin, storage, `fetch` or file access, and requires the scheme to be `standard`, which it already was.
- **How an entry is checked:** as Chromium's own WebUI pages are. Blink's `ScriptCachedMetadataHandlerWithHashing` stores a SHA-256 of the script's text with each entry, and compares it with the text the scheme serves before using the entry (`third_party/blink/renderer/platform/loader/fetch/script_cached_metadata_handler.cc`). An entry for any other text, an earlier version's included, is dropped and evicted. An update's scripts also have new names (Vite hashes them).
- **The threat:** someone who can write to the person's profile (`%APPDATA%\Webforge`, `~/Library/Application Support/Webforge`).
  - The hash ties an entry to a script's text. It doesn't authenticate the compiled code, so such a writer could pair the real script's hash with code of their own, which would run with the preload API.
  - That writer is the person's own account, or malware already running as them. None of the app's other files in the profile that this review checked (preferences, the AI apps' and trusted code's lists, Local Storage) gives them code to run in the app, so the cache is a new path, and the asar integrity fuse doesn't cover it.
  - It's the same trust Chromium and every Electron app's http(s) pages place in the profile's code cache. With the hash check, no stale or mismatched entry is ever used. **Accepted for the renderer**, for the measured gain.
- **Main's compile cache (`module.enableCompileCache()`) is not used.** Measured, it saved 23 ms, within noise: since #892, main loads 1.4 MB at start-up. Node's cache would sit in the profile too, and V8 checks its entries against little more than the source's length. Planted code there would run in the main process, past the asar integrity fuse, for no measurable gain.
- **For the next security review:** confirm `codeCache` still grants nothing else, that entries for `webforge-app:` are still checked by hash in the Electron version shipped, and that main still doesn't turn on Node's compile cache.
