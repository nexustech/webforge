# 0018. Publishing: the worker publishes a version, destinations beside the site

- Status: Accepted
- Date: 2026-10-31
- Related: #662, [architecture review 2](../reviews/2026-10-30-architecture-review-2.md) (A2, A3, A4, A6, A7), [security review](../reviews/2026-10-30-security-review.md) (S2), [ADR 0006](0006-publishing.md), [ADR 0012](0012-site-format-migrations.md), [ADR 0016](0016-site-check-in-the-renderer.md), [architecture §3, §5, §7](../../spec/01-architecture.md#3-process-model), 4.4 (#72), 4.5 (#73), 4.6 (#74), #664, #666

## Context
4.4 (destinations), 4.5 (the publish flow) and 4.6 (Version History) each need four decisions nobody has written down. Each is cheap to make now and costly to change once the first of those items merges. On `main` at `b6d23c8`:
- **Where a build lives.** `publishSite` (`publish/src/run.ts`) takes a `BuildOutput`, every built file in memory. That build exists only in the export utility process, which writes it to disk and has no `publish` job (`shared/export-worker-protocol.ts`). Secrets stay in main (ADR 0006 §5).
- **Where destinations live.** They are declared in the site document (`siteSettingsSchema.publish`, `model/src/settings.ts`), which is undoable and copied into every version. The list is always empty, and nothing reads it. 4.3 added the file-transfer settings the destination form returns (`fileTransferDestinationSchema`, `model/src/file-transfer.ts`, with `url` and `signIn`), but nothing stores them yet.
- **What a version captures.** `saveVersion` copies the committed `documents` rows, which trail the editor by autosave's delay (up to 30 s, plus an open text session). Exports build from a snapshot the renderer sends (`siteContentFor`, `renderer/export/export-request.ts`). `readVersion` returns documents as stored, not migrated, and nothing builds a stored version.
- **Where the Must-fix gate runs.** Only the renderer's export command runs Site Check before a build. The export IPC and the worker build whatever they're given. That's enough for an export of the open site, but not for republishing a stored version that may never have passed the publish check (X5).

## Decision

### 1. Publishing runs as a job in the export worker (A2)
- **A `publish` job** in the export worker's protocol, checked with zod as the others are. It carries:
  - the site to build, as a `SiteDoc` (decision 3);
  - the destination's settings (decision 2) and its sign-in;
  - the project's and the destination's ids, for manifest v2 (ADR 0006 §7);
  - whether the person agreed to replace another site's folder (`replaceOtherSite`);
  - the fonts and downloaded families, as an export's job does.
- **The secret is passed for that one job.**
  - Main reads it from the credential store, under `publish/<projectId>/<destinationId>` (#666), only after the S2 fingerprint check (4.4).
  - The worker holds it for the job and drops it when the job ends. It never logs it, and neither the outcome nor an error carries it (ADR 0006 §1).
  - The worker is the app's own Node process, as main is, and neither the renderer nor the canvas can reach it. A secret held there for one job is no more exposed than one held in main.
- **What the worker does:**
  - builds with `mode: "publish"`;
  - runs `publishSite` on the build in memory;
  - streams `PublishRunEvent`s back as `progress`, which gains a publish variant;
  - ends with a `published` outcome: the live check's result and the publisher's `version`, such as Netlify's deploy id. Main records both.
- **Cancel reuses `cancel`.** It stops the build, or the upload as `publishSite` does, leaving the previous site usable.
- **Short calls stay in main:** Test connection, reading a host key and Netlify sign-in (4.3, ADR 0006 §4). They build nothing and finish in seconds. So `basic-ftp` and `ssh2` load in both processes.
- **Alternatives:**
  - *Main runs `publishSite`*, the obvious route since the secrets are there. Every built file would be cloned into main, undoing R15's memory work, and main's event loop, which also serves IPC and autosave, would sit on the upload path.
  - *The worker streams files to main, and main uploads them.* The same bytes cross the port, main is still on the upload path, and a cancel has two places to reach.
  - *A third utility process for publishing.* The build would still cross a port into it, and it is one more process to start, stop and test. The export worker already holds the build.

### 2. Destinations live in the site file, outside the site document (A3)
- **Stored in the `meta` table** under `publish_destinations`, as JSON, through `ProjectStore.readPublishDestinations` and `writePublishDestinations`. This is the pattern of `export_choices` and `site_check_ignored`.
  - **Not undoable and not versioned.** Autosave and history never touch the list, and restoring a version leaves it as it is.
  - **Main writes it** when the person saves or removes a destination (4.4), and when a first Netlify publish creates or picks a site (`siteId`).
  - **Each entry is checked when read.** An entry that fails its schema is left out, so one damaged entry doesn't lose the others.
- **One stored shape** in `@webforge/model` replaces `publishDestinationSchema`:
  - every destination has an `id` (uuid), a `name`, and a `kind` with that kind's settings;
  - **file transfer:** 4.3's `fileTransferDestinationSchema`, which already holds `url` (the address the live check asks for) and how it signs in (`signIn`);
  - **Netlify:** `{ siteId?, url? }`, signed in with a token.

  One mapper, `publisherFor(destination, secret, trust)`, gives `ftpPublisher`, `sftpPublisher` or the Netlify publisher with its settings. It is the only place that knows each publisher's fields.
- **Secrets and trust stay on this computer.**
  - Secrets go in the keychain-encrypted credential store, keyed `publish/<projectId>/<destinationId>` (#666).
  - The S2 fingerprint and trust state go in userData beside them: protocol, host, port, user, the SFTP host key, and that plain FTP's warning was seen (ADR 0006 §7).
  - Removing a destination deletes its secret, fingerprint and trust.
- **`publish` leaves `siteSettingsSchema`** through a trivial ADR 0012 step in the next site format, which drops it. It has always been `[]`.
- **A copy starts with none.** The site package's `project` block (4.7) doesn't carry destinations, so a site opened from a ZIP or from a version (4.6) has no destinations. Such a site gets a new project id, so its secrets wouldn't match anyway. And a copy can't publish over the original's folder without the person adding the destination again, where manifest v2's question then applies.
- **Alternatives:**
  - *In the site document (today).* Every change becomes an undo step. Undoing past a first Netlify publish drops its `siteId`, so the next publish creates a second site. Restoring a version brings back an old list: its secrets are orphaned, or a republish goes somewhere stale.
  - *In userData, by project id.* The list wouldn't travel with the site file to another computer. And every hand-made copy of a `.wforge`, which keeps its project id, would share one list.
  - *A table of its own.* This needs a schema change and its own migration for what is a short list. The `meta` key gives the same with the existing pattern.

### 3. A version is what the person sees, and builds are made from versions (A4)
- **Before any automatic version** (on publish, before a restore, before a site-wide action), the renderer ends the text session and awaits `autosave.flush()`. It then calls main with its session id (A7). The version is then the site as the person sees it, not as it stood up to 30 s earlier.
- **Publishing builds what it records:**
  1. Main saves the "Published …" version from the store.
  2. It reads the version back with `ProjectStore.readVersionSite(id)`, which migrates as `readSite` does (#664).
  3. It runs the gate on that `SiteDoc` (decision 4) and sends it in the worker's `publish` job (decision 1).

  What went live is the version recorded, by construction.
- **Republish (4.6) is the same flow** with an existing version's id, and nothing new is saved. The renderer never opens the version.
- **The worker makes the snapshot.** `siteContentFor` moves from the renderer to `@webforge/site-components`, beside `mediaUsedBy` and `documentsLinkedBy`, which it is built from. It needs no React and no Node, so the renderer (export, preview) and the worker (publish) call the same function. Main still never imports site components.
- **Main serves only that site's bytes.** The worker asks for each image and document by hash as the build reaches it (R15). Main answers only for hashes among the `media` of the `SiteDoc` it sent.
- **Alternatives:**
  - *The renderer sends a snapshot, and main saves a version beside it.* The two can differ, and republishing a stored version would need it opened in the editor first, which 4.6's scope rules out.
  - *Version the committed rows without flushing.* The version misses up to 30 s of edits: the very edits "before restore" exists to keep.

### 4. Main runs the publish gate on what it builds (A6; amends ADR 0016)
- **`publishGate(site, target)`** in `@webforge/site-check` runs `checkSite(…, "publish")`. It adds what only the destination knows, such as Netlify Forms without a Netlify destination, and returns the *Must fix* findings.
- **Main runs it** in the publish and republish handlers, on the `SiteDoc` it is about to build, before asking the worker. With any *Must fix*, the handler refuses with `must-fix` and the count. A stored version with an external script therefore can't be republished (X5).
  - `site-check` is framework-free and reads the catalogue as data, so main can import it (`main-no-react` holds).
- **The renderer still checks first,** for the panel: the person sees *Must fix* with jump-to-fix before anything is sent (ADR 0016). Main's check is the one that can't be bypassed.
- **Exports stay as they are.** They build the open site, which the renderer has just checked.
- **Alternatives:**
  - *The renderer only (ADR 0016 as written).* A republished version is never in the renderer.
  - *The worker, after the build.* The worker would need the rules and the catalogue as well, and a refusal would come only after the build had been paid for.

## Consequences
- **4.4 (#72)** stores destinations in `meta`, adds `publisherFor`, and drops `publish` from `siteSettingsSchema` with an ADR 0012 step. It keeps secrets, the S2 fingerprint and trust in userData, under #666's keys.
- **4.5 (#73)** adds the `publish` job, its progress and outcome. It adds the flush-then-call flow and the main handler: save the version, read it back, gate, build and publish in the worker. The IPC carries the session id and an operation id (#663, #665).
- **4.6 (#74)** republishes through 4.5's handler with an existing version id.
- **#664** adds `readVersionSite`. Storage format 2's `published_to` records where a version went.
- **Prep work:** `siteContentFor` moves to `@webforge/site-components`, and `publishGate` is added, both with 4.5.
- **Accepted limits:**
  - A secret crosses one MessagePort, inside the app, once per publish.
  - The worker loads the publishers, and so does main for its short calls.
- **Superseded:** architecture §3 put publishing in main, and §5 put destinations in Site Settings; both are corrected. ADR 0006's Consequences said destinations go in "what the `.wforge` file stores". That still holds, as `meta`, outside the site document.
