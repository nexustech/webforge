# Webforge Security Review

**Date:** 30 Oct 2026 · **Commit:** `main` at `c602885` (Phase 3 exit) · **Refs:** #81 (5.6)

The security on `main` is unusually careful for this stage of a product. The Electron hardening, the IPC boundary, the sanitisers, the storage defences and the download checks all hold in the code, not just the spec. They are listed under *What holds* at the end of each area. No critical or high finding was found.

The findings below cluster around three things:
- **Files from other people are trusted for their code.** A `.wforge` file is checked for integrity, but not for the code inside it. A site file someone else made can put scripts on the owner's published site, run them in their browser through Preview, and redirect their analytics. A crafted file can also freeze the app.
- **Phase 4's designs need security requirements before they are built.** Saved publish passwords, the MCP server (4.9) and the AI command layer (4.8) each have a gap that is cheap to fix now and expensive once shipped.
- **A few controls rest on weaker footing than the spec says.** The packaged editor runs from `file://`, a Fuse is left on, the canvas iframe isn't sandboxed, and the Fuses are never tested.

**Method.** Ten reviewers each covered one area from [the credits plan §1](2026-10-30-cloud-credits-plan.md#1-security-audit-and-threat-model-35). Each finding then went to its own verifier, which tried to disprove it in the code. Where it could, the verifier wrote a Vitest test that fails on `main` because of the flaw. 30 findings went to verification: 29 were confirmed and 1 is plausible (a requirement for code not yet written). Two duplicates were merged here (S1, S17). The 27 tests are in [`2026-10-30-security-review-tests/`](2026-10-30-security-review-tests/), each with its original path on its first line. They are stored as `.ts.txt`, so CI doesn't run tests that are meant to fail. Copy one back to its path to run it; it is the regression test for the fix.

Severity: **medium** means reachable by an attacker who gets the user to open a file or paste content, with real harm to the owner or their visitors. **Low** means defence in depth, or a flaw in code that isn't wired up yet. **Info** means a spec gap or a product decision.

## Issues opened (30 Oct 2026)
| Issue | Findings |
|---|---|
| #649 Ask before code from someone else's site file runs for visitors or in Preview | S1, S6 |
| #650 Consent: only the pipeline's banner counts, and analytics cookies stay off without one | S3, S25 |
| #651 Check a site file's tables before reading them, and cap image decoding | S4, S12 |
| #652 Serve the editor from an app:// scheme and turn off the file-access fuse | S5, S7, S8 |
| #653 Phone preview: a fresh link each time, an idle timeout, the right network, a Host check | S9, S24 |
| #654 Downloads: parse IP addresses properly, stream fonts with checked redirects | S10, S11 |
| #655 Test the packaged app's fuses, and remove electron-log's unchecked IPC channel | S15, S17 |
| #656 Add Renovate, run the audit every night, and upgrade Electron to the latest 44.x | S16 |
| #657 JSON-LD escapes <, > and &, and hidden pages are flagged as still reachable | S14, S13 |
| #658 AI commands: confirm payment and form addresses, keep away from Custom Code, check requests in main | S18, S19, S21 |
| #659 Sanitisers: no url() in SVG attributes, and rich text cleaned when a site is opened | S22, S23 |
| Acceptance criteria added to #71 (4.3) and #72 (4.4) | S2 |
| Acceptance criteria added to #171 (4.9) | S20, the 4.9 requirements |

## Threat model

**What we protect**
| Asset | Where it lives |
|---|---|
| The owner's site and its unpublished content | `.wforge` (SQLite), the renderer's memory, the preview server |
| Publish credentials (FTP/SFTP passwords, Netlify token) | `credentials.json` in userData, encrypted with `safeStorage` |
| The owner's other files and accounts on the computer | The file system; the browser profile |
| The visitors of the published site: their privacy, form data, safety | The exported HTML/JS on the owner's host |
| The owner's legal standing (GDPR/ePrivacy consent) | consent.js, GA4 settings |
| The app's availability and the integrity of the undo history | The main process; `HistoryManager` |

**Who attacks, and through what**
| # | Attacker | Way in |
|---|---|---|
| a | Whoever made a file the user opens | A `.wforge` site file, a template, pasted elements (`web application/x-webforge-elements`), later an imported ZIP (4.7) |
| b | A malicious or compromised server | Download and bundle, Fontsource/jsDelivr, FTP/SFTP/Netlify endpoints, DNS rebinding |
| c | Another device on the same network | The phone preview's LAN listener |
| d | Another app, or a web page in the user's browser | Loopback ports (preview today, MCP in 4.9) |
| e | Script that got into the editor renderer | Escalation through `window.webforge` IPC, `file://` reads |
| f | Content aimed at visitors | Site content that breaks out into script on the exported pages |
| g | Leaks | Credentials, paths or site content in logs, crash reports or errors |
| h | An AI app, or a prompt injection steering it (4.8/4.9) | MCP tool calls |

**Trust boundaries**
```
                (b) servers                     (c) LAN devices    (d) local apps/pages
                    │ https only                      │ 128-bit path       │ loopback
┌───────────── Main process ─────────────────────────────────────────────────────────┐
│ ProjectStore (SQLite) ◄── (a) .wforge     preview server     MCP server (4.9)       │
│ credential store (safeStorage)            publishers (4.2–4.4)                     │
└──────▲─────────────────────────────────▲───────────────────────────────────────────┘
       │ registerIpcHandler: sender URL check + zod both ways          │ MessagePort, zod
┌──────┴──────── Renderer (sandbox, contextIsolation, CSP) ────┐  ┌────┴── utility workers ─┐
│ editor UI, HistoryManager, commands (4.8)  ◄── (h) AI calls  │  │ build, images, thumbs   │
│  └─ canvas iframe (Puck srcdoc: SAME origin, see S8)         │  └─────────────────────────┘
└──────────────────────────────────────────────────────────────┘
          │ export / publish
          ▼
   Published site ──► (f) visitors
```

The design depends on four lines holding:
1. **The renderer can't escalate.** Sender checks, zod, no paths, and no free URLs in main. *Holds, with S5, S7 and S8 as defence-in-depth gaps.*
2. **Content from a file can't run in the editor.** Sanitisers and the CSP. *Holds.*
3. **Code from a file doesn't reach visitors or the owner's browser without the owner knowing.** *Doesn't hold: S1, S3 and S6.*
4. **Secrets go only where they were typed for.** *Doesn't hold in the 4.4 design: S2.*

## What to fix first

| # | Finding | Where | Severity | Why it matters | Fix |
| --- | --- | --- | --- | --- | --- |
| S1 | **Code in a site file someone else made reaches the published site with no trust step.** Custom Code elements and the site's head, body-end and `custom.js` are exported as written. Nothing on open, export or publish says the file carries code. Pasted elements aren't filtered by editor level, so Custom Code can be pasted in Simple mode. Site Check's external-resources rule only flags script URLs that end in a known file extension, so `fetch` and `sendBeacon` skimmers pass. It also honours `allowedExternalUrls` from the same untrusted file. | `site-components/src/catalogue/custom-code.tsx:43-46`, `pipeline/src/site-code.ts`, `site-check/src/rules/external.ts:34`, `site-check/src/external.ts:85-94`, `renderer/clipboard/element-clipboard.ts` | medium | A "starter site" or template from a freelancer or forum skims every visitor's contact form under the owner's domain. Site Check passes, and in Simple mode the owner never sees the code. §9's "custom scripts off by default" only covers the editor. | Record where a site's code came from. On first export or publish of code the owner didn't write here (opened file or paste), list it and ask: "This site contains code that will run for your visitors: Review / Remove". Keep the file's `allowedExternalUrls` unapplied until then. Drop `advancedOnly` types from a paste in Simple mode, or ask first. Document the external-resources rule as a portability check, not a safety check. |
| S2 | **Saved publish passwords are keyed only by IDs from the shareable site file.** `credentialKey(projectId, profileId)` is the only lookup key. Host, port, protocol, SFTP host-key pin and Netlify site ID all live in the same `.wforge`. | `main/credential-store.ts:40-42`, `storage/src/project-store.ts:335`, `publish/src/ftp.ts:10-24,65`, `publish/src/sftp.ts:15-28,102` | medium (design; not wired up yet) | The owner sends their file to a designer for help. It comes back with the FTP host pointing at the attacker and `protocol: "ftp"`. Publish sends the real hosting password, usually the cPanel login, to the attacker in clear text. SFTP pinning doesn't help, because the pin travels in the same file. | Fix in 4.3/4.4, before they ship. Store a fingerprint of protocol, host, port, user and SFTP host key (and any FTPS pin) in userData beside the encrypted secret. On a mismatch, ask for the password again and show the new host. Keep trust state (host keys, "plain FTP warned") out of the `.wforge`. |
| S3 | **Advanced-mode `data-*` attributes can impersonate the consent banner.** consent.js takes the *first* `[data-wf-consent]` in the page. Without `data-ask` it loads GA at once with consent granted, for whatever `data-measurement-id` it finds. The real banner comes last in `<body>`, and `attributeNameSchema` allows any `data-*`. | `site-components/src/behaviours/consent.js:10,17,96-98`, `model/src/documents.ts:58-60`, `site-components/src/library.ts:512`, `pipeline/src/html.ts:108` | medium | A crafted file, template or paste makes every visitor tracked in the attacker's GA4 property with no consent, and the owner's banner never shows. The owner is the one in breach of GDPR. | Make consent.js read only the banner the pipeline wrote (the last `[data-wf-consent]` child of `<body>`, or a pipeline-only id). Reserve `data-wf-*` and `data-measurement-id` in `attributeNameSchema`/`withAdvanced`. |
| S4 | **A crafted `.wforge` runs SQL from its own views before the schema check, freezing the main process.** `validateProject` reads `SELECT … FROM meta` before comparing `sqlite_schema`, so `meta` can be a view with an endless recursive CTE. `trusted_schema=OFF` doesn't stop CTEs or innocuous built-ins. `ProjectStore.open` is synchronous on the main thread, and better-sqlite3 has no interrupt. Files of a newer format skip the schema and content checks altogether, so their `documents`, `blobs` and `assets` can also be views. | `storage/src/project-store.ts:273,291-336`, `main/project-session.ts:202,304,682`, `main/hand-off.ts`, `main/app.ts:545` | medium | Double-clicking an e-mailed file hangs Webforge at 100% CPU until it is force-quit. Hand-off saves the open site first, so little is lost, but it is a reliable denial of service. The test measured 3.3 s per 30M steps, and an unbounded view never returns. | Read `sqlite_schema` (a system table, safe) first. Require `meta`, `documents`, `blobs` and `assets` to be plain tables with the expected SQL, for every format version, before any `SELECT` on a user table. Refuse views and triggers in newer formats too. |
| S5 | **The packaged editor loads from `file://`, and the `GrantFileProtocolExtraPrivileges` fuse is left on.** With it on, a `file://` page can `fetch` other `file://` URLs. A CSP of `'self'` on a file page very likely matches them (not confirmed in a runtime). | `apps/desktop/electron-builder.yml:43-52`, `main/app.ts:153,426`, `shared/content-security-policy.ts` | medium (defence in depth) | Any script that gets into the renderer can read `~/.ssh`, browser profiles and documents. It can send them out through `site:bundle-file` (an https URL of its choice) or by writing them into the site. That defeats §3's "the renderer never names a file". | Serve the renderer from a privileged custom scheme (`app://editor/`, `protocol.handle`, limited to `out/renderer`), update `appUrl`/`isAppUrl`, set `grantFileProtocolExtraPrivileges: false`, and add it to §3's Fuse list. This also closes S7 and narrows S8. |
| S6 | **Preview runs a crafted site's scripts in the user's everyday browser.** Preview builds include `custom.js`, the head/body snippets and Custom Code scripts with no preview guard (analytics, by contrast, is dropped). They run from a loopback origin, with no CSP and no per-site trust step. | `pipeline/src/build.ts:456-468,582,657`, `main/app.ts:327-359` | low | One press of Ctrl/Cmd+I runs an untrusted file's script in the user's real browser profile, from `127.0.0.1`. From there it can reach other local services without Chrome's Local Network Access prompt, and it shares a site with other localhost apps for `SameSite` purposes. | Treat Preview like the editor's script toggle: leave the site's own scripts out until they are enabled for that site, or ask once. Share the trust record with S1. |
| S7 | **The app-URL check ignores the host of `file:` URLs.** `isAppUrl` compares only protocol and path, so `file://attacker.example/<install path>/index.html` passes. The same check gates every IPC sender check and every navigation guard. | `main/security.ts:40-42,60,77-91`, `main/app.ts:153-154` | low (defence in depth) | No way to start such a navigation from content was found. If one appears, Windows resolves the URL as a UNC path, leaks the user's NTLM hash, and could load attacker HTML that main treats as the editor. | Require `target.host === app.host`, and add foreign-host cases to `security.test.ts`. Moot once S5 moves to `app://`. |
| S8 | **The canvas iframe isn't sandboxed, contrary to §3 and §9.** Puck's AutoFrame is a plain same-origin `<iframe srcDoc>`, and the engine depends on that access. Anything that ran in the canvas could call `parent.webforge`. | `engine/src/puck/puck-engine.tsx:211`, Puck `AutoFrame`, spec/01 §3, §9 | low (spec mismatch) | Nothing runs there today, because the sanitisers and the CSP hold. But any future "run custom scripts in the editor" option would hand that script the whole preload API. | Correct §3/§9. Record in an ADR that editor-side scripts may only ever run in a separate `WebContentsView` or partition with no preload, never in the Puck frame. |

## Opened files, pasted content and the published site

**Findings**
- **S1** and **S3** (above).
- **S14. JSON-LD escaping misses `<!--`** (low). `jsonLd` escapes only `</` (`pipeline/src/structured-data.ts:149`). A site or business name containing `<!--<script>` sends the HTML tokeniser into the "double escaped" state. The rest of the head and the body is then swallowed into an inert ld+json script, which blanks the page and invalidates the structured data. No script runs. Fix: escape `<`, `>` and `&` as `<`, `>` and `&`.
- **S12. The 50-megapixel decode limit applies only at import** (low). `MAX_IMAGE_PIXELS` is enforced in `worker/store-import.ts:110`. Blobs inside an opened `.wforge` go straight to `decodeOriginal` for thumbnails and export (`main/media-protocol.ts:90`, `pipeline/src/images.ts:72,91,232`). A PNG of a few KB claiming 30000×30000 decodes to about 3.6 GB in the utility process. The harm is limited to worker churn and failed previews or exports. Fix: sniff the header dimensions before every decode and cache the refusal by hash.
- **S23. Latent: Puck's rich-text Suspense fallback inserts stored HTML unsanitised** (info). Unreachable today: every richtext field is inline, and the patch loads the editor eagerly. Adding an `inline: false` field, or `resolveData`/`resolvePermissions` to any component, would reach it, and rich text from an opened file is never sanitised on load (only the MCP path does that). Fix: sanitise richtext props on load and paste with `sanitizeStoredRichText`, or patch the fallback to render nothing.
- **S25. With the banner off, GA4 loads on the first view with analytics consent granted** (info). Research decision B4 allowed this as the owner's responsibility "with a help note", but the note is missing (`settings-sections.ts:329`), and the behaviour contradicts CLAUDE.md ("GA4 behind consent") and §9. **Decided 30 Oct 2026 (product owner, B4 amended):** with the banner off, analytics cookies stay off. consent.js keeps Consent Mode's `analytics_storage` denied for every visitor, so GA4 counts visits without cookies, and never calls `loadAnalytics(true)` without a visitor's choice. Site Settings adds a help note beside the banner switch saying so. This goes with S3's consent.js fix.

**What holds**
- **SQLite.** Defensive mode is on in every connection, with a test (`storage/test/project-store.test.ts:402`). The exact schema is compared row by row for older and current formats. The metadata uses a strict zod schema. `checkContent` re-hashes every document. All queries are parameterised.
- **Parsing.** No prototype pollution: `Object.create(null)` maps, `withoutUnsafeKeys` with a depth cap. No path traversal from site data: media names are display-only, export paths go through `sitePathSchema`, bundled names match a strict regex.
- **The custom protocols.** `webforge-media:` serves only `(thumbnail|original)/<sha256>` blobs of the open site with an image MIME type, plus `nosniff`. `webforge-font:` serves only catalogue or downloaded files, with size and SHA-256 checked.
- **Sanitisers.** `sanitizeCustomCode` resisted obfuscated `javascript:`, protocol-relative, UNC, `file:` and entity tricks. The rich-text sanitisers have tight tag and scheme allow-lists, and Tiptap's schema covers canvas edits. The only `innerHTML` sinks are the four known ones.
- **Exported pages.** Strings built by hand are escaped. Link fields are zod-checked at render time. Advanced attributes are allow-listed (no handlers, `style` or `href`). Embeds are built only from parsed ids and checked against fixed prefixes. Files in `files/` can't be HTML or SVG. The minifier keeps escaping intact. `llms.txt` and the Markdown copies drop script, iframe and form.
- **Paste and recovery.** Clipboard paste is zod-parsed, and kept bytes are reused only when their SHA-256 matches. Recovery restores only the site's own backups and never deletes the damaged file.

## The renderer → main boundary and Electron

**Findings**
- **S5**, **S7** and **S8** (above).
- **S15. Electron Fuses are never checked by a test** (low). `e2e/app` launches stock, unfused Electron (`e2e/app/launch.ts:36`), and `e2e/packaged` only connects over CDP. No test reads a Fuse. If the `electronFuses` block were dropped or ignored by an electron-builder upgrade, RunAsNode, NODE_OPTIONS and `--inspect` would come back with CI green. The 23 Oct review's "Fuses … verified" (line 144) is wrong on this point. Fix: in `e2e/packaged`, read the fuse wire with `@electron/fuses` `getCurrentFuseWire` and assert every value §3 requires, including the one from S5.
- **S17. electron-log registers a raw IPC channel outside the contract** (low). Importing `electron-log/main` (`main/log-file.ts:1`) runs `ipcMain.on/handle('__ELECTRON_LOG__')` at load time. That channel has no sender check, no zod and no redaction, and it writes whatever it is sent into `main.log`. It isn't reachable today, because the preload never exposes `ipcRenderer`. Fix: remove both listeners after import, or use `electron-log/node`, and add a test that the channels registered on `ipcMain` are exactly the contract's.

**What holds**
- **IPC.** Every channel goes through `registerIpcHandler`: sender-frame check (a missing frame is refused), zod on request and response, and fixed `failed`/`ipc-failed` errors with code-only logging. The architecture review's R4 is fixed. Every write channel checks the session (R6 is fixed).
- **No paths from the renderer.** The renderer never names a path. Export destinations come from dialogs, recent sites are opened by a 32-hex id, results carry basenames only. Dropped files use only `webUtils.getPathForFile`, and a page-made `File` gives `""`.
- **External URLs.** `shell.openExternal` takes only fixed guide addresses and main-built preview URLs.
- **Electron settings.** `contextIsolation`, `sandbox`, `app.enableSandbox`, no Node in workers or sub-frames, `webviewTag: false`, `navigateOnDragDrop: false`.
- **Navigation.** `will-navigate`, `will-frame-navigate` and `will-redirect` are guarded, `window.open` is denied, and every permission is denied.
- **CSP.** `default-src 'none'`, `script-src 'self'` with no inline script, `frame-src`, `object-src`, `base-uri` and `form-action` all `'none'`, and the build fails if the placeholder is missing.
- **Fuses.** All but one are set as §3 asks.
- **Production builds.** No devtools. `ELECTRON_RENDERER_URL` and every e2e hook are ignored when packaged or when built outside `--mode e2e`. Single-instance argv accepts only `.wforge` paths.
- **Errors and logs.** Renderer error reports are re-validated and paths redacted. Logs take only tokens.

## Local servers and downloads

**Findings**
- **S6** (above).
- **S9. The phone preview's single secret is weaker than its comments claim** (low). The 128-bit base path is the only protection, and it travels in clear over HTTP. Four gaps:
  - `localNetworkAddress` takes the first RFC 1918 address on *any* adapter, so it can pick a VPN, docker0, VirtualBox or Hyper-V address (`main/network-address.ts:4-18`). The comment says "never a VPN's or another adapter's".
  - The network listener never times out.
  - The base isn't rotated between phone sessions.
  - The whole unpublished site, and every later edit, is served to anyone who saw the URL once.

  Fix: a fresh base for each phone session, an idle timeout (around 10 minutes), stop when the address goes away, and prefer the default-route Wi-Fi or Ethernet interface.
- **S10. Download and bundle misses IPv4-mapped IPv6 in hex form** (low). The URL parser normalises `[::ffff:127.0.0.1]` to `[::ffff:7f00:1]`, which `isLocalAddress` doesn't recognise (`main/bundle-download.ts:137,152-155`). The same goes for NAT64, 6to4 and IPv4-compatible forms. HTTPS still has to succeed against the local target, which limits the harm. Fix: parse addresses with `net.BlockList` (or ipaddr-style logic) and normalise mapped forms before the check.
- **S11. Font downloads buffer the whole body before the size limit, and follow redirects anywhere** (low). In `main/font-library.ts:234-252`, the 8 MB and 4 MB limits are checked after `arrayBuffer()` has read the whole (decompressed) body, and `net.fetch` uses the default `redirect: "follow"`. Exploiting this needs a compromised Fontsource or jsDelivr, or a TLS-intercepting proxy. Fix: reuse bundle-download's streaming `bodyOf` with `redirect: "manual"` and a host allow-list.
- **S24. Neither preview listener checks the `Host` header** (info). DNS rebinding is blocked only because the base can't be guessed (`main/preview-server.ts:209-260`). Fix: accept only `127.0.0.1:<port>`, `localhost:<port>` and the chosen LAN address, and answer anything else with 421.

**What holds**
- **The preview server.** The base is 128-bit (`randomBytes(16)`) and every route sits behind it, live reload included. Files are looked up in an in-memory map of the build's own paths, so traversal and encoded tricks give 404. Only GET and HEAD are accepted. Responses send `nosniff`, `no-referrer` and `no-store`, with no CORS. Loopback binds to `127.0.0.1` and the network listener to one address, never `0.0.0.0`. Analytics is dropped in preview, and everything closes with the site.
- **Download and bundle.** HTTPS is required at every hop, redirects are followed by hand (at most 5), and no cookies are sent. Decimal, octal and hex IPv4 forms are normalised and caught. There is no certificate-error override, so a rebound host can't finish TLS. A running byte cap (10 MB), a MIME allow-list (no HTML or JSON) and generated file names complete the checks.
- **Fonts.** The id is checked by regex at IPC and must match the metadata, the file names match a strict regex, and size and SHA-256 are checked before writing.

## Publishing and credentials

**Findings**
- **S2** (above).
- **S13. The publish manifest sits in the public web root** (low). `.webforge-publish.json` (`publish/src/remote-folder.ts:9,78,96,102`) is written to `/public_html`, and most shared hosts serve dotfiles. It lists every published path with its SHA-1. That includes pages hidden from search engines and files no page links to, which `sitemap.xml` deliberately leaves out. The UI already says hidden pages "stay on your site", so this weakens obscurity, not access control. Fix: keep the manifest outside the served folder where the host allows it, or say in the hide-from-search help that the page is still reachable by its address.

**What holds**
- **Remote clean-up stays inside the site folder.** Every manifest key passes `sitePathSchema`, which rejects `..`, a leading `/`, `\`, `:` and device names.
- **FTPS** does AUTH TLS with Node's default certificate and hostname checks, and fails rather than falling back to plain FTP.
- **SFTP** compares the host key before sending the password, and fails closed on an empty or malformed pin.
- **Netlify** uses the OAuth ticket flow: no loopback listener and no client secret in the app. The token goes only to `api.netlify.com` in a header.
- **The credential store** refuses to write when encryption is unavailable (including the weak Linux `basic_text` backend), writes atomically with mode 0600, and never overwrites a file it can't read.
- **Logs and crash reports** keep only error names and codes, with paths redacted. `verifyPublished` fetches https only, with a size cap.

## AI apps: the command layer (4.8) and the MCP server (4.9)

Nothing outside the app can reach the AI bridge on `main`. The only caller is an e2e global that needs an unpackaged app and `WEBFORGE_E2E_AI=1`. These findings matter as soon as 4.9 ships, and R10 already sends them to this review.

**Findings**
- **S18. AI apps can silently repoint Buy button payment links and Newsletter form addresses** (low). `BuyButton.link` and `Newsletter.action` are plain content fields, so `updateFields` and `editText` can change them on an ordinary page with no D7 confirmation, in Content mode too (`commands/src/commands.ts:55,283`). The only check is that the value is an https URL. A prompt injection in site content could steer a paired AI app into redirecting payments. Fix: mark money and data destinations as sensitive in the catalogue, and require a confirmation that shows the old and new host (or leave them out of the AI surface).
- **S19. AI apps can delete and move Custom Code despite the "no Custom Code tools" rule** (low). `removeNode` and `moveNode` (`commands.ts:356,408`) never call `componentOf()`, and deleting a Section has no subtree check. Fix: apply the same guard in both commands, including a check of slot children.
- **S20. AI commands can push a harmful change past the 200-step undo limit** (low). There is no throttle and no grouping, so one deletion followed by about 200 trivial edits makes it unrecoverable through undo (`history/src/history-manager.ts:235,348`; `commands/src/api.ts`). Fix in 4.9: rate limits per app, one command in flight at a time, and an automatic version ("Before ‹app›'s changes") at the start of each connection or burst.
- **S21. Main forwards AI requests to the renderer without zod or a cap** (low). `AiBridge.ask` sends the request as it arrives (`main/ai-ipc.ts:78`). A malformed request times out as `busy` instead of `invalid`, and the `waiting` map is unbounded. Fix: export `aiRequestSchema` and parse it in `ask()`, cap requests in flight, and bound input size.

**Requirements to add to 4.9 and its Q9 ADR** (info; verified against spec/04:1284-1297 and spec/01 §9)
- **Transport and pairing.**
  - Bind the literal `127.0.0.1` on an ephemeral port, only while the preference is on and a site is open.
  - Refuse every request that carries an `Origin` header, since a browser page is never a client. Require `Host` to equal `127.0.0.1:<port>` exactly.
  - Accept tokens only in `Authorization`, never in the URL. Use at least 256 bits, compare in constant time, and store them in the keychain (ideally hashed).
  - Pairing codes are single-use, expire after about 5 minutes, and lock out after a few failures.
  - The app's display name comes from pairing and is cleaned. Today the 4.8 `AiRequest.app` schema only limits its length.
- **Abuse and prompt injection.**
  - Validate in main, allow one command in flight per app, apply rate limits, and back off after a decline, so an app can't wear the person down with D7 questions.
  - Take an automatic version before an app's first change (S20).
  - Tool descriptions say that site text is untrusted data, and values travel in labelled data fields, never in descriptions.
  - Keep a list of sensitive fields that need confirmation (S18).
  - `addPage` should ask for D7 confirmation, since it adds a menu entry on every page.
- **Open Preview and Run Site Check** (plausible: that code isn't written yet).
  - Open Preview takes no URL, path or host, and never starts the LAN preview.
  - Results and errors use ids and titles only: no absolute paths, user names or stacks.
  - The MCP SDK's own stderr and debug logging is off or routed through the content-free logger.
  - Crash reports leave out request payloads.
  - A test greps logs and crash reports for a planted marker string after AI calls.

**What holds**
- **Allow-list.** Commands are an allow-list (`Object.hasOwn`, names matched by `/^[a-zA-Z]{1,64}$/`).
- **No reach outside the document.** No command touches publishing, credentials, Media import or files.
- **Custom Code can't be read or written.** `fieldValueSchema('code')` is `z.never()`, and the fields query leaves code fields out.
- **Settings.** The settings query leaves out publishing, forms and analytics.
- **Values are checked.** AI rich text is sanitised on the way in and again at render and export. Link values go through `linkValueSchema`. Theme tokens are schema-checked, so CSS can't be injected.
- **D7.** Confirmation is enforced in the renderer's command layer, not only in the UI.
- **Undo.** Every change is one labelled undo step.
- **Nothing logged.** AI requests and answers are never logged.

## Dependencies and supply chain

**Findings**
- **S16. No automated dependency updates, and Electron is behind its own line** (low). spec/03 §7 asks for Renovate or Dependabot, weekly and grouped. Neither is configured. Electron 44.9.1 (`apps/desktop/package.json:56`) trails 44.9.2, 44.9.3 and 44.10.0, and 45.x is stable. Whether those releases carry Chromium security fixes couldn't be confirmed from the sandbox. Monitoring has three gaps:
  - Dependabot can't see the pnpm catalog.
  - The nightly audit is skipped when `main` hasn't changed in 25 hours.
  - The audit fails only on high or critical.

  Fix: add Renovate (it handles catalogs), upgrade Electron to the latest 44.x now, and run the audit nightly regardless of commits.

**What holds**
- **Audit.** `pnpm audit --prod` is clean. The full audit's four advisories are all fast-uri, reached only through electron-builder's ajv at build time.
- **Patches.** The Puck patch is neutral for security. The happy-dom override clears its CVE and is test-only.
- **What ships.** The packaged app ships only better-sqlite3, electron-log and uqr as runtime dependencies. Install scripts are blocked except two dev tools. Every lockfile entry comes from the registry with an integrity hash.
- **The exported runtime** is hand-written classic scripts with no imports.
- **Licences.** The licence gate holds.

## All findings

| # | Severity | Finding | Area | Verifier's test |
| --- | --- | --- | --- | --- |
| S1 | medium | Code in another person's site file reaches visitors with no trust step | Export | `customcode-1`, `export-2` |
| S2 | medium | Publish secrets keyed only by IDs from the site file (4.3/4.4 design) | Publish | `publish-1` |
| S3 | medium | Advanced `data-*` attributes impersonate the consent banner | Export | `export-1` |
| S4 | medium | Crafted `.wforge` runs view SQL before the schema check | Files | `files-1` |
| S5 | medium | `file://` renderer with `GrantFileProtocolExtraPrivileges` on | Packaging | `packaging-1` |
| S6 | low | Preview runs a crafted site's scripts in the user's browser | Servers | `servers-2` |
| S7 | low | `isAppUrl` ignores the host of `file:` URLs | IPC | `ipc-1` |
| S8 | low | Canvas iframe not sandboxed, contrary to §3/§9 | Custom Code | `customcode-2` |
| S9 | low | Phone preview secret: any adapter, no timeout, no rotation | Servers | `servers-1` |
| S10 | low | Bundle download misses hex IPv4-mapped IPv6 | Downloads | `downloads-1` |
| S11 | low | Font downloads: unbounded buffering, unchecked redirects | Downloads | `downloads-2` |
| S12 | low | Image decode limit only at import | Files | `files-2` |
| S13 | low | Publish manifest in the public web root | Publish | `publish-2` |
| S14 | low | JSON-LD escaping misses `<!--` | Export | `export-3` |
| S15 | low | Fuses never checked by a test | Packaging | `packaging-2` |
| S16 | low | No Renovate/Dependabot; Electron behind | Deps | none (configuration) |
| S17 | low | electron-log's raw IPC channel | IPC | `ipc-2`, `deps-2` |
| S18 | low | AI can repoint payment and form destinations silently | AI | `ai-1` |
| S19 | low | AI can delete or move Custom Code | AI | `ai-2` |
| S20 | low | AI can push changes past the undo limit | AI | `ai-3` |
| S21 | low | AI requests forwarded without zod or a cap | AI | `ai-4` |
| S22 | info | `sanitizeCustomCode` keeps `url()` in SVG `fill`/`stroke`/`clip-path`; only the CSP stops the fetch (`site-components/src/custom-code.ts:24`) | Custom Code | `customcode-3` |
| S23 | info | Latent unsanitised rich-text fallback in Puck | Custom Code | none (unreachable) |
| S24 | info | Preview doesn't check `Host` | Servers | `servers-3` |
| S25 | info | GA4 granted on first view with the banner off (decided: cookies stay off, B4 amended) | Export | `export-4` |
| – | info | 4.9 requirements: transport and pairing; abuse limits and prompt injection; preview, Site Check and logs | AI | `ai-5`, `ai-6`; third not written |
