# Webforge Security Review 2

**Date:** 8 Nov 2026 · **Commit:** `main` at `3850aed1` · **Refs:** #81 (5.6), [the first review](2026-10-30-security-review.md) (S1–S25)

The second review comes before the beta. Since the first one, nearly everything the beta ships has merged:
- publishing to FTP, FTPS and SFTP, with saved sign-ins (4.3–4.5);
- Version History, with republishing (4.6);
- the MCP server and the Claude Desktop bridge (4.9);
- AI apps' settings, pages, briefs and plans (4.11, 4.12a);
- the Help window (5.4b), the licences screen (5.3) and onboarding (5.4a).

**No critical, high or new medium finding.** Every finding of the first review that was fixed is still fixed, and each fix was checked in the code, not only its issue. Three lines are still open as planned: S5, S7 and S8 (#652), and S15 and S17 (#655). The new findings are 7 low and 8 info.
- **Fixed in this review's PR:** five, S26, S31, S34, S36 and S37. S26's fix amends AIB-6, as the product owner decided (7 Nov 2026).
- **Filed as issues:** the rest, in the Phase 5 milestone: #794–#797, plus a widened #652. #793 (S26) was filed, then fixed here.

**What stands out:**
- **The AI layer's Allow questions hold.** No command reaches a site-wide or destination change without the person's answer.
  - S18, S19 and S21's fixes hold in the newer code: plans, briefs, settings and `requestMedia`.
  - The weak spot is the safety net instead: an app on its own could push its "Before ‹app›'s changes" version out of Version History (S26, fixed here).
- **The MCP transport is sound against a browser and another account.** It binds `127.0.0.1`, refuses any `Origin`, checks `Host` exactly, and uses 256-bit keys compared in constant time.
  - What's left concerns a same-user process squatting the port (S27, S29) or flooding it (S28). ADR 0021 already accepts the developer-tool case, and these narrow it.
- **Publishing's secrets go only where they were typed for.** S2's fingerprint holds for FTP, FTPS and SFTP, and for republishing.
  - Netlify's sign-in isn't tied to its site yet (S32). It's latent until 4.4b saves one.

**Method.**
- Five reviewers each read one area, read-only, against the first review's threat model:
  1. the first review's S1–S25, each checked in the code;
  2. the MCP listener and the bridge;
  3. the AI command layer;
  4. the IPC surface and the new windows;
  5. Electron, Fuses, CSP, publishing's secrets and logging.
- Each finding was then checked in the code before it was counted. A finding two reviewers found separately is counted once (S26).
- Separately:
  - `pnpm audit`, for dependencies;
  - a new fuzzing test of damaged and crafted `.wforge` files, `packages/storage/test/damaged-file.test.ts`: 300 runs of 1–16 random bytes changed, and 100 truncations, each opened and read in full. Every run must either read or fail with storage's own error.
    - On CI it found one that didn't: a header whose schema format number was changed to 5 failed with SQLite's raw "unsupported file format". The person would have seen an unexpected error rather than "damaged". Fixed here: storage reports it as a damaged site, with a regression test. 4,000 runs and 1,000 truncations then passed locally.

Severity is as in the first review. **Medium:** reachable by an attacker who gets the user to open a file or paste content, with real harm. **Low:** defence in depth, or code not wired up yet. **Info:** a spec gap, robustness, or a decision.

## Issues opened (8 Nov 2026)
| Issue | Findings |
|---|---|
| #793 AI apps can push their own safety version out of Version History (fixed by this review's PR) | S26 |
| #794 MCP listener: revoke direct apps' keys when the port moves, cap unauthenticated requests, drop the proof file | S27, S28, S29 |
| #795 A plan's Allow question: destination changes first, and always reachable buttons | S30 |
| #796 Netlify: tie the sign-in to the Netlify site, and save tokens only through PublishSecrets (before 4.4b) | S32, S38 |
| #797 Help window: a Content Security Policy of its own | S35 |
| #652, comment: serve the Help window from `app://` too, and check its host | S33 |

## The first review's findings today
| S | Issue | State on `main` |
|---|---|---|
| S1, S6 | #649 | Fixed and checked. Main filters every build to the code the owner trusts: export, preview, a version's preview and publish, whose worker checks again. A paste in Simple mode drops Custom Code. The file's `allowedExternalUrls` count only once confirmed. |
| S2 | #71, #72 | Fixed and checked. The keychain record holds the fingerprint of protocol, host, port, user and SFTP host key with the secret. Trust isn't in the `.wforge`. Netlify's site isn't bound: S32. |
| S3, S25 | #650 | Fixed and checked. consent.js reads only the last `body > [data-wf-consent]`; `data-wf-*` and `data-measurement-id` are reserved and removed on open. Analytics storage stays denied with the banner off. |
| S4, S12 | #651 | Fixed and checked. `sqlite_schema` is read first, and plain tables only, for every format. Every decode sniffs the header first. The new fuzzing test agrees. |
| S5, S7, S8 | #652 | **Open.** The editor and now the Help window are `file://` pages, `GrantFileProtocolExtraPrivileges` is on, `isAppUrl` ignores a `file:` URL's host, and spec/01 still says the canvas is sandboxed. Widened to the Help window: S33. **Fixed since** (#652, ADR 0023). |
| S9, S24 | #653 | Fixed and checked. Note: the phone listener's idle timer re-arms while a page stays open on a device, which is "no page open" as decided, not a hard cap. |
| S10, S11 | #654 | Fixed and checked. |
| S13, S14 | #657 | Fixed and checked (S13 by the help note, as the review allowed). |
| S15, S17 | #655 | **Open.** No test reads the packaged fuse wire; `electron-log/main` still registers its IPC channel (unreachable: no `ipcRenderer` is exposed). |
| S16 | #656 | Partly. The audit runs nightly and fails on moderate production advisories. Renovate isn't installed (deferred by the product owner), so updates are made by hand. |
| S18, S19, S21 | #658 | Fixed and checked, in plans and briefs too. S18's list of sensitive fields had a gap: S31, fixed here. |
| S20 | #171 | Fixed, but an app could push its safety version out: S26, fixed here. |
| S22, S23 | #659 | Fixed and checked. |

## New findings

### AI apps: the command layer and the MCP server
| S | Finding | Where | Severity | Scenario | Fix |
|---|---|---|---|---|---|
| S26 | **An app can push its own "Before ‹app›'s changes" version out of Version History.** Each connection saves another before its first command, and main saves one before every plan, before the plan is checked. | `main/mcp-service.ts:101-133`, `main/mcp-limits.ts:227-235` | low | About 200 small edits push the old site past the undo limit. Then about 20 reconnections, or invalid `plan {}` calls 5 minutes apart, push the version out of the 20 kept. The site as it was is gone; only the person's own versions survive. | **Fixed here** (#793, AIB-6 amended). One per app per opening of the site, keyed by app and session id, so reconnecting adds none. None from main before a plan: the person's **Allow** saves the plan's one version (*Before ‹app›'s changes: ‹title›*), so a plan refused as invalid saves nothing. App versions are still pruned like the others. Tests in `mcp-service.test.ts`, `command-host.test.ts`, `version-actions.test.ts`. |
| S27 | **When the remembered port is taken, the port moves and every key stays valid.** The warning lasts one run, in the dialog only. | `main/mcp-service.ts:152-168`, `ai-apps.ts:23-31` | low | A port squatter collects a developer tool's Bearer key while Webforge is closed, then finds the new port and uses the key. | #794. Revoke direct apps' keys on a move, and keep the warning until seen. |
| S28 | **Unauthenticated requests are uncapped,** and each re-reads the apps file in the same queue as real authentication. | `main/mcp-listener.ts:163-216`, `ai-apps.ts:163-210`, `json-store.ts` | low | Any local program flooding `/mcp/proof` makes paired apps' authentication time out. | #794. Cache, cap in flight, counters, and server timeouts. |
| S29 | **The server proof stays in the `.mcpb` file** after Claude Desktop has it. | `main/claude-extension.ts:71-73,130-135` | low | A same-user process reads it and answers the bridge's challenge while Webforge is closed. | #794. Delete the file once opened; say so in ADR 0021. |
| S30 | **A plan's single Allow question can bury a destination change,** and the dialog has no maximum height. | `commands/src/plan-command.ts:258-285`, `editor-ui/src/components/ui/dialog.tsx:12-13` | low | A prompt-injected plan with long titles hides "Payment link: from … to …" mid-wall or below the screen. | #795. |
| S31 | **A Pricing plan's button link wasn't marked sensitive** (S18's list), and a link field's change named no address. | `site-components/src/catalogue/pricing.tsx`, `commands/src/commands.ts` | low | An app repoints a plan's "buy" button to its own checkout with no question. | **Fixed here.** The link is sensitive, and a link field's addresses are named. Test in `api.test.ts`. |
| S36 | **Only "address in use" counted as a taken port.** | `main/mcp-service.ts:68-71` | info | On Windows with Hyper-V, WSL or Docker, a reserved port fails with `EACCES` and AI apps never listens. | **Fixed here.** `EACCES` draws another port. Test in `mcp-service.test.ts`. |
| S37 | **A field named `constructor` made `updateFields` throw** instead of answering `invalid`. | `commands/src/commands.ts:104` | info | The app hears `busy` and retries. There's no security effect. | **Fixed here** with `Object.hasOwn`. Test in `api.test.ts`. |

**What holds:**
- **The transport:**
  - It binds `127.0.0.1`, and only while AI apps is on (off by default).
  - It refuses any `Origin`, checks `Host` exactly, and sends no CORS headers.
  - Keys are 256 bits, stored as SHA-256 in the keychain, compared in constant time, accepted only as Bearer, and revoked after 5 minutes unused.
  - A wrong key backs off; a right one never waits.
  - The key is checked before the body is read, and bodies are capped.
- **Sessions:** each is bound to its app, at most 4, ended after 10 minutes idle.
- **The bridge:** checks the server with a fresh nonce and an HMAC that covers the address, compared in constant time, before it sends the key. Its files are 0700/0600, and the key isn't in the manifest.
- **Requests:** checked with zod in main and capped. Rate limits apply, one command in flight per app, and every tool's description warns that site text is untrusted.
- **The Allow questions:** every plan asks, with a summary. Site-wide changes, payment and form destinations, and Site Settings changes ask too.
- **Briefs:** the person must click Create, and an app can read only its own.
- **`requestMedia`:** goes through the person's own Add files dialog, with no path or URL from the app.
- **Reach:** no tool reaches other sites, the file system, credentials, publishing or Custom Code, and nothing logs content.

### The IPC surface and the new windows
| S | Finding | Where | Severity | Scenario | Fix |
|---|---|---|---|---|---|
| S33 | **The Help window inherits S5 and S7:** it's a second `file://` page, and `isHelpPageUrl` relies on `isAppUrl`. | `main/help-window.ts:76-83,112-114`, `main/help-ipc.ts:21`, `main/app.ts:172` | low | As S7: a `file://host/…` navigation would pass the Help sender check. Unreachable today, since help pages are drawn without raw HTML. | #652 widened (comment). **Fixed since** (#652): Help loads from `webforge-app://editor/help.html`, and `isHelpPageUrl` compares hosts through `isAppUrl`. Tests in `help-window.test.ts`. |
| S34 | **Help opened plain `http://` links as well as `https://`.** | `shared/ipc/help.ts:49`, `renderer/help/help-navigation.ts:19` | info | A future page's `http://` link opens over plain text, and the channel accepted loopback addresses. | **Fixed here.** `https` only in the channel and the link routing, and `pnpm help-check` refuses `http://` links. Tests in `help-library.test.ts` and `pages.test.ts`. |
| S35 | **The Help page gets the editor's whole CSP** (`webforge-media:`, `webforge-font:`, `connect-src 'self'`). | `renderer/help.html:7`, `shared/content-security-policy.ts` | info | A script in the Help page could read the open site's Media. Help's content is trusted. | #797. |

**What holds:**
- **Every channel** is registered through `registerIpcHandler`: sender check first, then zod on the request and the response, with errors logged by kind only. There's no `ipcMain` call outside it.
- **The Help window:** gets only `help:open-external`; the editor's channels exclude it.
- **The preloads:**
  - Neither exposes `ipcRenderer`, and both drop the event.
  - Every main-to-renderer event is checked with `safeParse`, Help's included.
  - Help's preload exposes three things.
- **Help pages:** drawn from Markdown tokens with no raw HTML. Only `.md` links and anchors stay in the window, and a link opening a new window is denied.
- **Licences (5.3):** a fixed file checked by zod, and a fixed path for Chromium's.
- **Preferences:**
  - A strict, bounded schema, re-parsed after each merge.
  - No path, URL or trust state in it.
  - Written atomically.
- **`openExternal` and `openPath`:** every call uses a fixed map, an address main built, or a destination main's own dialog chose. The renderer never names a file.

### Electron, Fuses, CSP, publishing and logging
| S | Finding | Where | Severity | Scenario | Fix |
|---|---|---|---|---|---|
| S32 | **A Netlify sign-in isn't tied to the Netlify site.** The fingerprint is just `netlify`, and the publisher has no other-site guard. | `main/publish-secrets.ts:43-45`, `publish/src/publisher-for.ts:105-111` | low (latent) | S2's attacker changes `siteId` in the shared file, and the next publish overwrites another of the owner's Netlify sites. Not reachable until 4.4b saves a Netlify sign-in. | #796, before 4.4b. **Fixed since** (#796): the fingerprint holds the Netlify site's id, so another site, or none, asks for the sign-in again. Its address isn't part of it: the live check asks for that with no sign-in. Tests in `publish-secrets.test.ts` and `netlify-auth.test.ts`. |
| S38 | **Legacy `netlify-auth.ts` saves the raw token outside the S2 record.** Only its test imports it. | `main/netlify-auth.ts:40,48` | info | If 4.4b wired it up as it is, the fingerprint would be skipped (it fails closed). | #796. **Fixed since** (#796): it saves through `PublishSecrets.save`, for the destination, and a dependency-cruiser rule keeps the keychain's store to `app.ts`, `publish-secrets.ts` and `ai-apps.ts`. |
| S39 | **The first review's "refuses Linux's `basic_text` keyring" isn't in the code.** | `main/credential-store.ts:110` | info | None today: only Windows and macOS are built. | Correction recorded here. Add `getSelectedStorageBackend() !== "basic_text"` before any Linux build. |

**What holds:**
- **Window settings:** both windows use `createSecureWebPreferences`, and `app.enableSandbox()` is called. There's no WebContentsView or other session.
- **Every webContents:** new windows are denied; navigation, frame navigation and redirects are guarded; webview attachment is blocked.
- **Permissions:** every request and check is denied. There's no certificate-error or login handler, so Electron's defaults reject.
- **`webforge-media:` and `webforge-font:`:** they match the raw URL with strict patterns, so no path traversal. They serve only what they should, with nosniff and the decode or hash check.
- **CSP:** both pages are filled at build time; `default-src 'none'`, `script-src 'self'`, no `unsafe-eval`, no wildcards. `style-src 'unsafe-inline'` is as documented.
- **The Fuses** are spec/01 §3's list, apart from S5's.
- **Publishing:**
  - One keychain record holds fingerprint, sign-in and trust, and a change gives "changed" and no secret.
  - Republishing (4.6b) takes the same path.
  - The secret goes to the worker for one job.
  - FTPS verifies certificates and refuses a server without TLS before the password.
  - SFTP pins the host key from the keychain.
- **Logging:**
  - `logFailure` writes name and code only, with other values redacted, and there's no `console.*` in main, the worker, the preloads or the publishers.
  - Crash reports keep name and frames only, paths redacted, never uploaded.

### Dependencies
| S | Finding | Severity | State |
|---|---|---|---|
| S40 | `pnpm audit` finds two moderate advisories, `glob` (GHSA-g3hv-75wg-m249) and `minimatch`. Both are reached only through Storybook and electron-builder at build time, so they don't ship. | info | No action. Production dependencies have no known advisory, and CI's audit fails on moderate in production and on high anywhere. |

## Checklist (5.6's scope)
| Item | Result |
|---|---|
| Electron hardening: Fuses, CSP, navigation handlers, sandbox | Holds, except S5 and S7 (#652, now including the Help window) and S15 (#655). |
| IPC schema validation | Holds: every channel, both directions, both preloads. |
| Untrusted `.wforge` fuzzing | Holds: the new fuzzing test (its one finding fixed here), plus the crafted-file tests from S4. |
| Secrets and logging | Holds. S32 and S38 are before 4.4b (#796), and fixed since. |
| Dependency audit | Holds: S40 is build-time only. |
| MCP server: pairing, `Origin` and `Host` checks, tool scope, no content in logs (F-AI-1) | Holds: S26 fixed here, S27–S30 filed (#794, #795). |
