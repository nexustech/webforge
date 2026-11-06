# 0006. Publishing: publisher core, Netlify, credentials

- Status: Proposed. Started in spec/04 item 0.2 (Netlify, #12); item 0.3 (FTP/FTPS/SFTP, #13) added its part (decision 7), and item 4.1 (#69) the publish run and its check of the live site (decision 8). It is accepted once 0.2's live Netlify check is recorded
- Date: 2026-10-20
- Related: [research 08](../../research/stack/08-publishing.md) (B1, B5, B6), [architecture §6, §7, §9](../../spec/01-architecture.md#6-key-interfaces), `packages/publish`, `apps/desktop/src/main/credential-store.ts`, `apps/desktop/src/main/netlify-auth.ts`

## Context
Research 08 chose three MVP publish targets: Folder/ZIP, FTP/FTPS/SFTP and Netlify (B1). Every target follows one flow:
1. build;
2. diff against what was published;
3. upload assets → pages → `index.html` last;
4. clean up;
5. verify;
6. record.

Credentials never go in the `.wforge` file. Item 0.2 checks the Netlify half: digest deploys, re-deploying only what changed, restore, Netlify Forms on API deploys, and sign-in from a desktop app.

## Decision

### 1. One publisher interface, credentials outside the destination
- `Publisher<D>` (architecture §6) has `test(dest)` and `publish(build, dest, signal)`, which yields `PublishEvent`s (`preparing`, `uploading`, `published`).
- `D` holds what the `.wforge` file stores, e.g. `{ siteId }`. The token or password is given to the publisher when it is created, so it can't leak into project data.
- Failures are `PublishError`s with a code the app translates: `unauthorized`, `not-found`, `rate-limited`, `rejected`, `network`, `cancelled`, `failed`. Messages name the request, never a credential or site content.

### 2. Manifests and order
- A manifest maps each site path to its SHA-1 digest (Netlify's digest; good enough to detect changes, not used for security).
- `diffManifest` returns the uploads (new or changed), the unchanged files, and the removals. It only removes files the previous manifest lists, so files someone else put on a host stay (08).
- `manifestSchema` validates manifests read back from a server. A path with `..`, a leading `/`, `\`, `:` or control characters is rejected, so a tampered manifest can't make clean-up delete outside the site folder.
- `uploadOrder`: assets → pages → `index.html`. Removals run in reverse, pages before assets.

### 3. Netlify: our own small REST client, not `@netlify/api`
- Webforge uses about ten endpoints. A typed client over `fetch` validates every response with zod (standards: zod at every network boundary), lets us control retries and error codes, and keeps the token out of messages. The generated SDK would give us none of that for free.
- **Digest deploy:**
  1. `POST /sites/:id/deploys` with `{ files: { "/path": sha1 } }`;
  2. upload each digest in `required` once (`PUT /deploys/:id/files/:path`, in upload order);
  3. poll `GET /deploys/:id` until `ready`.

  A Netlify deploy is a complete, atomic version of the site. So `removed` is always 0, and a cancelled or failed publish leaves the live site untouched.
- **Rollback:** `POST /sites/:id/deploys/:deploy/restore` (`restoreDeploy`). Netlify keeps every deploy, so there's nothing for us to store.
- **Retries:**
  - **429:** waits for `Retry-After` or `X-RateLimit-Reset` (at most 60 s) and retries up to 3 times. Netlify allows 500 requests per minute, and a first publish of an image-heavy site can pass that.
  - **Network errors and 5xx on GET and PUT:** retried with backoff. Netlify documents retrying an upload as safe.
  - **POST after a 5xx:** not retried, because it may have created a deploy or site.
- **Limit:** the deploy is created synchronously, and Netlify ends requests after 30 s. A digest list for a few thousand files is far below that. If very large sites ever hit it, switch to `async: true` and poll for `required`.

### 4. Netlify sign-in: OAuth ticket, not a loopback redirect
**Approved by the product owner on 2026-10-20**, in place of the loopback redirect in the approved Phase 0 plan. Accepted trade-offs: after approving, the user sees Netlify's generic "authorized" page rather than a Webforge page, and the flow uses a documented API that mainly netlify-cli uses.

Research 08 and the plan proposed OAuth with a loopback redirect on a random port. We use **Netlify's OAuth ticket flow** instead, the one netlify-cli uses:
1. `POST /oauth/tickets?client_id=…`;
2. the user approves at `app.netlify.com/authorize?response_type=ticket&ticket=…` in their own browser;
3. Webforge polls `GET /oauth/tickets/:id` and exchanges the approved ticket (`POST …/exchange`) for an access token.

Why:
- **No redirect URI to register.** OAuth providers usually require an exact redirect URI, which conflicts with a random loopback port. A fixed port can be taken by another program.
- **Nothing listening.** No local HTTP server waits for a callback, so there is no port to attack or squat.
- **Same safety otherwise.** No client secret ships in the app; sign-in happens in the user's own browser, not a webview; tokens are scoped to the user.

**Fallback:** a pasted personal access token, checked with `GET /user` before it is saved. `canSignIn()` is false until Webforge's OAuth client ID is set up. The product owner registers the OAuth application at app.netlify.com/applications; the ticket flow uses no redirect URI.

### 5. Credentials: `safeStorage`-encrypted, in user data
- Each secret is encrypted with Electron `safeStorage`, whose key the OS keeps (Windows DPAPI, macOS Keychain). The encrypted bytes (base64) go in one file, `<userData>/credentials.json`, under a namespaced key (#666): `publish/<projectId>/<destinationId>` for a destination (`publishCredentialKey`), `mcp/<appId>` for an AI app (`mcpCredentialKey`).
- The file is written through `createJsonStore` (#666), as the app's other files in userData are: atomically (temp file + rename, tried again while the file is briefly locked; owner-only permissions where supported), and one save at a time.
- **Never in plain text:** if `isEncryptionAvailable()` is false, saving fails (`encryption-unavailable`) instead of falling back. On Linux, Electron may use a weak `basic_text` backend. Linux isn't a release target; if it becomes one, also refuse that backend.
- A damaged file, or a secret that can't be decrypted (another OS user or machine), counts as missing, and the user signs in again. A damaged file is moved aside as `credentials.damaged-<time>.json` before the next save, never written over (#666). Any other read error (file locked, no permission) fails the save instead, because saving over a file we couldn't read would lose every other destination's secrets.
- A destination's record (4.4a) holds its sign-in, its trust (SFTP host key, plain FTP's warning seen) and the S2 fingerprint of where it was typed for, encrypted together, so neither an edited site file nor an edited trust can pair the secret with another host.
- Tokens stay in the main process. The renderer only learns whether a profile is signed in (Phase 4 IPC).

### 6. Netlify Forms on API deploys
Research 08 flagged this as unverified. `listForms` (`GET /sites/:id/forms`) and the live check (`packages/publish/src/netlify.live.test.ts`) deploy a page with a `data-netlify="true"` form and report whether Netlify registered it. **Result: pending the live run.** If Netlify doesn't detect forms on API deploys, Netlify profiles fall back to the Formspree, Web3Forms and FormSubmit presets (B6), and the Form setting doesn't offer "Netlify Forms".

### 7. FTP, FTPS and SFTP: one publish flow over a remote folder (0.3)
- **One flow, two adapters.** `publishToFolder` does what every file-transfer host needs:
  - read `.webforge-publish.json`, diff it against the build, upload assets → pages → `index.html`, then remove what the site dropped, pages first;
  - write the new manifest;
  - work through a small `RemoteFolder` (read, write, remove).

  `ftpPublisher` (FTPS and FTP, `basic-ftp`) and `sftpPublisher` (`ssh2`) only give it a folder, so the logic is tested once, in memory.
- **No half-written files.** Each file goes to a hidden `.<name>.webforge-upload` beside its place, then replaces it:
  - FTP renames over the file, or removes it first on a server that won't;
  - SFTP uses OpenSSH's `posix-rename`, or removes the file and renames it on a plain SFTP v3 server.
- **Cancelling.**
  - Cancelling closes the connection and stops before the next file. A file cut off mid-transfer is only its upload file, and the home page goes last, so the live site keeps working.
  - Before the first upload, the manifest lists the files the host never had, with a digest that matches nothing. If a publish stops part-way and the site drops one of them before the next, that publish still removes it, and one that may have been cut off is sent again.
  - Once every upload is done, the manifest lists the new files plus those still to be removed, so a publish cancelled during clean-up still removes them next time.
  - A missing or damaged manifest counts as a first publish: everything is uploaded and nothing removed.
- **The manifest names its site (version 2, 4.3, architecture review 2 A8).**
  - Version 2 records the project and the destination that published (`site: {projectId, destinationId}`) and when (`publishedAt`).
  - Version 1, which listed only the files, is still read. It names no site, so it could be any site's, and it gets the same question as another project's (below). Only the 0.3 spike wrote it; once the person agrees, the folder's manifest becomes this site's version 2.
  - A folder whose manifest names another project, or none, stops the publish with `other-site` before anything is written: a draft copy or another site pointed at `/public_html` would otherwise replace the live site, which FTP can't roll back. The publish goes ahead only once the person agrees to replace it (`replaceOtherSite`, which 4.5 asks for). Another destination of the same project is the same site.
  - **Its limit:** sites are told apart by `projectId` only. A copied `.wforge` keeps its project's id, so a copy published to the original's folder reads as the same site and replaces it without the question. 4.6's *open as new site* and 4.7's import give the copy a new id; a file copied by hand doesn't.
  - Netlify keeps no manifest of its own (its deploys say which site they belong to), so it needs nothing.
  - Test connection takes no site: it publishes nothing.
- **FTPS first (B5).** `ftps` is explicit TLS (`AUTH TLS`) against the computer's trusted certificates. A certificate it doesn't trust fails as `untrusted-host` before signing in. Plain `ftp` is allowed; the app warns first (B5).
  - **A host without FTPS (4.3):** one that refuses `AUTH TLS` fails as `no-encryption`, before the password is sent, so Test connection can offer SFTP or plain FTP. `connect` does what `basic-ftp`'s `access` does, step by step, to tell that refusal apart.
  - **Plain FTP's warning (4.3)** shows once per destination, and Save waits for it. That the person accepted it is kept with what this computer trusts about the destination (below), not in the site's file.
  - **Not covered:** many shared hosts present a certificate for the host's own name rather than the customer's domain. For a mismatch the person accepts, the Phase 4 UI can store the certificate's fingerprint, as SFTP does with host keys.
- **SFTP trusts a host key once.** The destination stores the server's key fingerprint as OpenSSH shows it (`SHA256:…`).
  - `readSftpHostKey` reads the key without signing in, for the person to compare and trust the first time.
  - After that, `ssh2`'s `hostVerifier` refuses any other key before the password is sent (`untrusted-host`).
  - **In the destination form (4.3)** the key is read and shown when the person first tests the connection, and trusted only when they say so; a key that changed later is shown as changed, to trust only knowingly. A trusted key belongs to its host and port: another of either is another connection, untrusted.
- **Trust stays on this computer (4.3, security review S2).** The SFTP host key and that plain FTP's warning was seen (`fileTransferTrustSchema`) are never part of the destination's settings in the `.wforge`, whose schema refuses them. Otherwise an edited copy of the site could point at another host and bring that host's key with it, or skip the warning. The destination form takes and returns them apart from the settings and the sign-in, and 4.4 keeps them in userData beside the encrypted secret. There is no FTPS certificate pin yet: a certificate the computer doesn't trust is refused (`untrusted-host`), and a pin, if 4.4 adds one, goes in the same place.
- **SFTP signs in with a password or a private key (4.3).** The key is the text of its file (OpenSSH, PEM or PuTTY) with its passphrase, if it has one.
  - `readPrivateKey` checks the passphrase opens it before connecting, so a wrong one is `bad-key` and the host never sees a failed try.
  - `describePrivateKey` tells the form whether a chosen file is a key and needs a passphrase. It reads encryption from each format's own marker, not from `ssh2`'s error wording, which a version bump could change: the OpenSSH key's cipher name, the PEM key's `Proc-Type: 4,ENCRYPTED` header, the PuTTY key's `Encryption` line. A PKCS#8 key (`BEGIN PRIVATE KEY`, `BEGIN ENCRYPTED PRIVATE KEY`), which `ssh2` can't read, is `unsupported`, and the form asks for it in the OpenSSH format.
  - **The key never reaches the renderer.** The main process reads the file the person picks (at most 16 KB) and holds the key in memory under a random handle (the last 16 chosen). The form gets the file's name, whether it needs a passphrase and the handle, and Test connection takes the handle with the passphrase; a handle main no longer holds is `bad-key`. 4.4 moves a destination's key from there to the keychain, in main.
- **`ssh2` directly, not `ssh2-sftp-client`.**
  - Research 08 named `ssh2-sftp-client`. Its types lag three major versions, and `ssh2` itself has every SFTP call needed, plus the `Server` the tests use.
  - `ssh2` pulls in `tweetnacl` (Unlicense, a public-domain dedication; a reviewed exception in `tools/src/check-licences.ts`) to decrypt passphrase-protected private keys.
  - **No native module ships.** `ssh2` has an optional native crypto binding and an optional `cpu-features` build. pnpm doesn't run their build scripts (they aren't allowed), and electron-builder's `npmRebuild` is off, so `ssh2` runs on its JavaScript fallback in tests and in the app. Nothing can then be built for the wrong ABI.
    - Since 4.3 the main process imports the publishers. `ssh2` is one of the app's own dependencies, so electron-vite leaves it unbundled, as it does `better-sqlite3`: bundling it failed on its optional native requires.
    - The main process is an ES module, and `ssh2` is CommonJS, so `sftp.ts` takes it through its default export: Node's loader gives no named exports for it, which Vitest's transform had hidden.
    - electron-builder ships its JavaScript, `poly1305.js` (the JavaScript it runs instead of the binding) included, and leaves out the binding's sources (`binding.gyp`, `src`), `cpu-features` and `nan`. `ssh2` requires its bindings inside `try`, and runs without them. electron-builder unpacks `ssh2`'s files beside app.asar, as it does a package it takes for native; they are JavaScript all the same.
    - `e2e:packaged` checks the packaged app reads an SFTP host's key and tests a connection with it, against an SFTP server the test starts, and that no `.node` file or binding source of `ssh2`'s, and no `cpu-features`, ships. The full publish run in the app comes with 4.5's flow.
- **Errors by kind, never the reply.**
  - `fileTransferError` maps FTP reply codes, SSH sign-in levels, SFTP status codes, socket and DNS codes, and TLS certificate codes to `PublishError` codes, with `untrusted-host` added for both protocols.
  - The host's reply can echo the user name or a path, so it stays in `cause` only.
- **Tested** against local servers in `packages/publish` (`ftp.test.ts`, `sftp.test.ts`):
  - a small FTP server of the tests' own (`ftp-server.test-helper.ts`, on Node's `net` and `tls`: the commands `basic-ftp` sends, with `AUTH TLS` and `PROT P`) for FTP and FTPS, with a self-signed certificate `openssl` makes when the tests load (the repository keeps no keys; without `openssl` the tests run over plain FTP and the certificate test skips). Not `ftp-srv`: it is unmaintained, and its `ip` dependency has an unpatched high advisory;
  - `ssh2`'s `Server` over a temporary folder for SFTP.

  They cover a second publish sending only the changed file, removals that leave other people's files alone, cancel mid-publish, a wrong password, a missing folder, an unreachable host, and an untrusted certificate or host key.
- **Against real servers (4.3).** CI's *File transfer servers* job (Linux) starts pure-ftpd over FTPS and OpenSSH's SFTP (`atmoz/sftp`) in containers, pinned by digest, and runs `servers.live.test.ts` against them. It publishes twice, the second time only the changed file, with the server's own certificate trusted, and over SFTP with a password and with a private key and its passphrase. It also checks that an untrusted certificate, a wrong password or passphrase and a changed host key are refused. Without the servers the tests skip. Real cPanel or Plesk hosts are still checked by hand.
- **`safeStorage` round trip:** `e2e/app/credentials.spec.ts` encrypts a test secret in one run and decrypts it in the next, on Windows (DPAPI) and macOS (Keychain), in CI.

### 8. The publish run and the live check (4.1)
`publishSite` (`packages/publish/src/run.ts`) runs any publisher and then checks the new version is the one served, research 08's step 5. The publisher's events pass through unchanged, and after `published` the run adds `verifying` and `verified`.
- **Netlify: through its API** (`Publisher.verify`). The deploy just made, named in `published.version`, is `live` once it is `ready` and the site's `published_deploy`.
  - Nothing is fetched from the site, so Netlify's own rewriting of pages can't mislead the check. It drops `data-netlify` from forms and adds a hidden `form-name` input.
  - A CDN still on the old deploy can't mislead it either.
- **FTP, FTPS and SFTP: the address** (`verifyPublished`). It asks the `https:` address for the home page.
  - **The page as built, byte for byte, is `live` at once.**
  - **A page that names the build's hashed stylesheet** (`assets/css/site.<hash>.css`, in every home page) is this site rewritten by its host, which may add a snippet. It is asked for again until the attempts run out, then counts as `live`.
    - The hash follows the styles, not the words. So an earlier version with the same styles still in a cache reads the same, and the attempts give that cache time to move on.
    - No new build marker goes into the page (X4).
  - **Past caches:** a `webforge-check` query named after the page's digest. Up to 5 attempts, 2 s apart.
  - **Bounds:** each answer has 15 s, or it counts as `unreachable`. It is read up to twice the page's size (1 MB at least), and past that it counts as `different`. Nothing of the page is kept or logged.
- **What it can find:**
  - `live`;
  - `different`: another version, another site, or another deploy published since;
  - `unreachable`, with the HTTP status when there was one;
  - `unchecked`: no `https:` address (an FTP destination without its web address), no home page, or cancelled.

  The check never throws. The publish is done whatever it finds, and 4.5 words each result.
- **Cancelling:** while uploading, it ends the run as the publisher's own cancel does, with the previous site usable and nothing checked. While checking, it ends only the check (`unchecked`).
- **Tests:**
  - `run.test.ts` puts the Netlify, FTPS and SFTP publishers through the run on the tests' own servers: Netlify's API check, and the address answered from what the FTP and SFTP servers hold. Each publish is checked as `live`. A publish cancelled at its first upload leaves the old home page, and the stylesheet it names, in place.
  - `verify.test.ts` covers a page rewritten as Netlify and hosts do, an answer that never comes, and one that runs on.
- **Not here:** building with the publish-strict checks, the progress and result UI, and recording a version are 4.5 and 4.6. Destinations and their credentials are 4.4.

### 9 and 10. Where publishing runs, and where destinations live
Recorded in [ADR 0018](0018-publishing-from-a-version.md), with what a publish builds and where its gate runs:
- **Where publishing runs:** `publishSite` runs in the export worker, as a `publish` job, with the secret main passes for that one job (§1).
- **Where destinations live:** in the site file's `meta` table, outside the undoable, versioned site document, in one shape with `url` and a mapper to each publisher (§2).

## Consequences
- `packages/publish` is the shared core for 0.3 (FTP/FTPS/SFTP use `diffManifest`, `uploadOrder` and `manifestSchema` for `.webforge-publish.json`) and for the Phase 4 publish UI.
- **To finish this ADR:**
  1. run the live Netlify check with a throwaway site and token, and record the re-deploy, restore and forms results above;
  2. register Webforge's Netlify OAuth application and try the ticket sign-in once;
  3. ~~add 0.3's FTP/FTPS/SFTP decisions and the `safeStorage` round trip on Windows and macOS~~: done, decision 7.
- The desktop modules (`credential-store.ts`, `netlify-auth.ts`) have no IPC yet. The publish UI (Phase 4) adds typed channels that never return a token to the renderer.
- Research 08's "OAuth … with a loopback redirect" is superseded by decision 4. Update the research note in the Phase 0 wrap-up (0.6).
