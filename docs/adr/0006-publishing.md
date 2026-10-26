# 0006. Publishing: publisher core, Netlify, credentials

- Status: Proposed. Started in spec/04 item 0.2 (Netlify, #12); item 0.3 (FTP/FTPS/SFTP, #13) added its part (decision 7). It is accepted once 0.2's live Netlify check is recorded
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
- Each secret is encrypted with Electron `safeStorage`, whose key the OS keeps (Windows DPAPI, macOS Keychain). The encrypted bytes (base64) go in one file, `<userData>/credentials.json`, keyed by project ID + publish profile (`credentialKey`).
- The file is written atomically (temp file + rename, owner-only permissions where supported), and saves are serialised.
- **Never in plain text:** if `isEncryptionAvailable()` is false, saving fails (`encryption-unavailable`) instead of falling back. On Linux, Electron may use a weak `basic_text` backend. Linux isn't a release target; if it becomes one, also refuse that backend.
- A damaged file, or a secret that can't be decrypted (another OS user or machine), counts as missing, and the user signs in again. Any other read error (file locked, no permission) fails the save instead, because saving over a file we couldn't read would lose every other profile's secrets.
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
- **FTPS first (B5).** `ftps` is explicit TLS (`AUTH TLS`) against the computer's trusted certificates. A certificate it doesn't trust fails as `untrusted-host` before signing in. Plain `ftp` is allowed; the app warns first (B5).
  - **Not covered:** many shared hosts present a certificate for the host's own name rather than the customer's domain. For a mismatch the person accepts, the Phase 4 UI can store the certificate's fingerprint, as SFTP does with host keys.
- **SFTP trusts a host key once.** The destination stores the server's key fingerprint as OpenSSH shows it (`SHA256:…`).
  - `readSftpHostKey` reads the key without signing in, for the person to compare and trust the first time.
  - After that, `ssh2`'s `hostVerifier` refuses any other key before the password is sent (`untrusted-host`).
- **`ssh2` directly, not `ssh2-sftp-client`.**
  - Research 08 named `ssh2-sftp-client`. Its types lag three major versions, and `ssh2` itself has every SFTP call needed, plus the `Server` the tests use.
  - `ssh2` pulls in `tweetnacl` (Unlicense, a public-domain dedication; a reviewed exception in `tools/src/check-licences.ts`) to decrypt passphrase-protected private keys.
  - **No native module ships.** `ssh2` has an optional native crypto binding and an optional `cpu-features` build. pnpm doesn't run their build scripts (they aren't allowed), and electron-builder's `npmRebuild` is off, so `ssh2` runs on its JavaScript fallback in tests and in the app. Nothing can then be built for the wrong ABI.
    - Today `ssh2` isn't in the app at all: nothing in the main process imports the publishers yet.
    - 4.3, which wires SFTP in, adds an `e2e:packaged` check that the packaged app publishes over SFTP.
- **Errors by kind, never the reply.**
  - `fileTransferError` maps FTP reply codes, SSH sign-in levels, SFTP status codes, socket and DNS codes, and TLS certificate codes to `PublishError` codes, with `untrusted-host` added for both protocols.
  - The host's reply can echo the user name or a path, so it stays in `cause` only.
- **Tested** against local servers in `packages/publish` (`ftp.test.ts`, `sftp.test.ts`):
  - a small FTP server of the tests' own (`ftp-server.test-helper.ts`, on Node's `net` and `tls`: the commands `basic-ftp` sends, with `AUTH TLS` and `PROT P`) for FTP and FTPS, with a self-signed certificate `openssl` makes when the tests load (the repository keeps no keys; without `openssl` the tests run over plain FTP and the certificate test skips). Not `ftp-srv`: it is unmaintained, and its `ip` dependency has an unpatched high advisory;
  - `ssh2`'s `Server` over a temporary folder for SFTP.

  They cover a second publish sending only the changed file, removals that leave other people's files alone, cancel mid-publish, a wrong password, a missing folder, an unreachable host, and an untrusted certificate or host key.
- **Not yet run against real hosts.** The live checks with cPanel or Plesk FTP and an OpenSSH host are for the Phase 4 E2E (local FTP and SFTP servers in CI, 4.3).
- **`safeStorage` round trip:** `e2e/app/credentials.spec.ts` encrypts a test secret in one run and decrypts it in the next, on Windows (DPAPI) and macOS (Keychain), in CI.

## Consequences
- `packages/publish` is the shared core for 0.3 (FTP/FTPS/SFTP use `diffManifest`, `uploadOrder` and `manifestSchema` for `.webforge-publish.json`) and for the Phase 4 publish UI.
- **To finish this ADR:**
  1. run the live Netlify check with a throwaway site and token, and record the re-deploy, restore and forms results above;
  2. register Webforge's Netlify OAuth application and try the ticket sign-in once;
  3. ~~add 0.3's FTP/FTPS/SFTP decisions and the `safeStorage` round trip on Windows and macOS~~: done, decision 7.
- The desktop modules (`credential-store.ts`, `netlify-auth.ts`) have no IPC yet. The publish UI (Phase 4) adds typed channels that never return a token to the renderer.
- Research 08's "OAuth … with a loopback redirect" is superseded by decision 4. Update the research note in the Phase 0 wrap-up (0.6).
