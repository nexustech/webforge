# 0003. `.wforge` storage on better-sqlite3: packaging, journal mode and untrusted files

- Status: Accepted (Phase 0 storage spike)
- Date: 2026-10-19
- Related: P1–P5 ([project file format](../../research/stack/06-project-file-format.md)), [architecture §5–6, §9](../../spec/01-architecture.md), [MVP spec §6 Phase 0](../../spec/02-mvp-spec.md#6-milestones), [engineering standards](../../spec/03-engineering-standards.md)

## Context
A Webforge site is one `.wforge` file, an SQLite database (P1). The driver is better-sqlite3 (decided). It is the app's only native module, so the spike had to answer these questions:

- Does it load in the Electron 44 main process, both in development and in a packaged, fused build?
- What does packaging need?
- Which journal mode survives cloud-synced folders?
- How do we open files we did not write?

The spike adds a minimal `ProjectStore` in `packages/storage` and wires it through typed IPC.

## Decision

### 1. better-sqlite3 13 needs no rebuild
- **Prebuilds ship with the package.** better-sqlite3 13.0.3 is a Node-API addon (`node-addon-api`). It bundles prebuilt binaries for win32, darwin, linux and linuxmusl (x64 + arm64) in `prebuilds/`, and has **no install script**.
- **Node-API binaries are ABI-stable**, so the same file loads in Node 24 (Vitest) and Electron 44 (Node 24.22, `process.versions.napi` 10). Verified: SQLite 3.53.4 under plain Node, under the Electron binary, in the E2E-tested dev build, and in the packaged Windows app.
- **No extra tooling:**
  - **No `@electron/rebuild`.** It would also rebuild in place in the shared pnpm store, breaking the Node copy that unit tests use.
  - **No `allowBuilds` entry**, and no new licence exceptions (MIT).
  - **Fallback:** `@electron/rebuild` (MIT) stays the option if a future release drops prebuilds or we need a custom SQLite build. better-sqlite3's `nativeBinding` option can then point the main process at a separate Electron-ABI binary, so the Node copy is left alone.
- **Pinned via the catalog:** `better-sqlite3` and `@types/better-sqlite3` live in `pnpm-workspace.yaml`. `@webforge/storage` and `apps/desktop` use the same version.

### 2. Packaging (`apps/desktop`)
- **External, not bundled.** better-sqlite3 is a `dependencies` entry of `apps/desktop`, so electron-vite keeps `import Database from "better-sqlite3"` external. `@webforge/storage` itself stays a dev dependency, bundled from source. knip ignores the dependency with a comment.
- **electron-builder (`electron-builder.yml`):**
  - Packs the dependency from `node_modules`; pnpm is detected and works.
  - `asarUnpack: "**/*.node"`. electron-builder unpacks the whole better-sqlite3 folder because it contains a native file; the main bundle loads it transparently from `app.asar.unpacked`.
  - `npmRebuild: false`: nothing to rebuild.
  - File filters drop SQLite's C sources, `node-addon-api` and the other platforms' prebuilds. Only `prebuilds/${platform}-${arch}.node` ships; `app.asar` is under 1 MB.
  - `electronFuses.resetAdHocDarwinSignature: true`: flipping fuses invalidates the macOS signature, and unsigned arm64 code does not launch. It only affects `.app` bundles, and real signing (Phase 0 installer item) happens after it.
  - `fileAssociations` registers `.wforge` (P1). The main process opens a `.wforge` passed on the command line at start-up. Single-instance hand-off for a second double-click is still to do.
- **Verified on Windows.** `pnpm e2e:packaged` runs `electron-builder --dir`, then `e2e/packaged/packaged-app.spec.ts`. The test:
  1. Starts the fused `Webforge.exe` with a `.wforge` argument.
  2. Connects over the Chrome DevTools Protocol. Playwright's Electron launcher can't attach, because the `EnableNodeCliInspectArguments` fuse is off.
  3. Checks that the main process opened the file.
- **macOS can't be built or run from Windows.** The new CI job `Packaged app` runs the same script on `windows-latest` and `macos-latest` (arm64, matching the arm64-only target). Its first run on this PR passed on macOS: the unsigned arm64 app, re-signed ad hoc, launched and opened a `.wforge` with the darwin-arm64 prebuild. The DMG itself is not built in CI yet.

### 3. Rollback journal (`journal_mode=DELETE`, `synchronous=FULL`), not WAL
- **Every commit lands in the `.wforge` itself.** Copying only the `.wforge` while Webforge is open gets all committed work. That is what a sync client, an e-mail attachment or a USB stick sees (F1).
  - With WAL, recent commits live in `-wal` until a checkpoint. A test copies the main file after 10 commits: the DELETE copy has 10 rows, the WAL copy has 0.
- **No side files between commits.** WAL keeps `-wal` and `-shm` next to the file for the whole session. Sync clients upload, lock or delete those independently: forum reports include OneDrive deleting a WAL file, and SQLite documents mismatched or missing side files as a classic corruption cause ([How to corrupt](https://www.sqlite.org/howtocorrupt.html) §1.2, §1.4). WAL also requires all connections on one host, which sync breaks.
- **Durability.** `synchronous=FULL` makes a returned commit durable. `ProjectStore.open` switches a file that some tool left in WAL mode back to DELETE.

**Measured on Windows 11** (dev machine, Node 24, rowid `blobs` table):

| Scenario | Result |
|---|---|
| Single-page commit (~12 KB JSON) in a 100 MB project | median 7.9 ms, p95 ≈ 11 ms (budget 50 ms) |
| Raw SQLite commit: DELETE/FULL vs WAL/NORMAL | DELETE 8.8 ms vs WAL 0.2 ms |
| Put 50 images (100 MB) | 1.5–1.8 s |
| 20 edits + 20 versions | 0.3 s, file +0.3 MB (content shared) |
| Open with `quick_check` | 210 ms at 100 MB, 7 ms when small |

- **The cost of DELETE.** WAL commits much faster (0.2 ms vs 8.8 ms raw), but commits run at most every 2 s (P2), so the cost is well within budget.
- **Use rowid tables for big rows.** `blobs` was `WITHOUT ROWID` first. Next to 100 MB of images, a single-page commit took 41 ms instead of 8 ms. SQLite advises against WITHOUT ROWID for large rows.

### 4. Cloud-synced folders: what happens, and what we do
- **Crash safety.** `test/crash-and-sync.test.ts` starts a real writer process that commits in a loop, and kills it with SIGKILL/TerminateProcess at five points.
  - The file always opens; no commit the writer saw return is lost; at most the in-flight one is.
  - Both documents of a commit land together.
  - Some kills leave a non-hot `-journal` (killed before its header was written). SQLite ignores it, and the next commit deletes it.
- **Copy during a write.** The same writer runs while the test copies the file 60 times, as a sync client would.
  - A copy taken mid-commit can be torn. In a 3 s scratch run, 52–55 of about 230 copies (~24%) were.
  - Every torn copy failed `ProjectStore.open` with `corrupt`; none opened with half a commit. In the real app commits are milliseconds every few seconds, so the window is far smaller, and sync clients re-upload once the file stops changing.
- **Product consequences** (for Phase 1):
  - Detect OneDrive/Dropbox/iCloud folders and show the gentle warning planned in research 06.
  - Recommend "Always keep on this device" for OneDrive Files On-Demand.
  - Two machines editing the same file produce the sync client's conflict copies; we do not merge.
  - A file in a cloud-synced folder may arrive torn; treat `corrupt` as "open a backup or a version".
  - Phase 1 backups (online backup API, research 06) are the recovery path.
- **Not done:** a real OneDrive/Dropbox account was not used. It would upload test files to someone's cloud. Manual check before beta: create a site in a OneDrive folder, edit, close, reopen, then open it on a second machine.

### 5. Untrusted files
`ProjectStore.open` treats every file as untrusted ([SQLite security](https://www.sqlite.org/security.html)):
- **Connection settings:**
  - **Defensive mode** (`SQLITE_DBCONFIG_DEFENSIVE`) is on by default in better-sqlite3 (`src/objects/database.cpp`); a test guards against an upgrade changing that.
  - `trusted_schema=OFF`, `cell_size_check=ON`, `mmap_size=0`.
  - `foreign_keys=ON` (R14): better-sqlite3 turns it on by default, but `hardenConnection` sets it too, so a change of default can't turn it off. A test checks it.
  - Extensions are never loaded.
- **Checks, before anything is written** (failures leave the file untouched):

  | Check | On failure |
  |---|---|
  | `PRAGMA application_id` = `0x57465247` ("WFRG") | `not-a-project` |
  | `PRAGMA quick_check` | `corrupt` |
  | `meta.format_version` | `newer-format` if newer |
  | `sqlite_schema` equals the expected schema exactly (extra triggers, views, tables or indexes fail) | `unexpected-schema` |
  | zod-validated metadata and version manifests; JSON blobs parsed with `z.json()` | `unexpected-schema` / `corrupt` |
  | **Content (#295, 24 Oct 2026):** the header's `user_version` holds a fingerprint of every document's and asset's row and the version ids, written in the same transaction as any change to them; it must match the rows. Every document, asset and version refers to a blob the file has, and each document blob is the bytes its hash names. `user_version` 0 (files from before) skips the fingerprint only | `corrupt` |

  **Cost:** opening a project of 40 large pages and 300 versions takes about 70 ms, `quick_check` included (`packages/storage/test/open-time.test.ts`). Every write goes through `ProjectStore`'s one write helper, which records the fingerprint in the same transaction, and `test/write-paths.test.ts` fails if a new method writes without it.

  **The format stays at 1, so a build from before #303 must not write a fingerprinted file.** Such a build changes the rows without updating `user_version`, so the next build that opens the file reads it as `corrupt`. That only concerns development builds from before 24 Oct 2026: no release predates the fingerprint, so the format doesn't need a bump at release. If a build without the fingerprint ever reaches users first, bump the format with the release that adds it, so older builds open such files read-only.

  **Why the content check:** a copy of the `.wforge` alone, taken while a commit writes it, can hold some of the commit's pages and the old version of the rest, since the rollback journal that would undo it isn't copied. `quick_check` only sees the b-trees, which can be whole on both sides (macOS CI, #295). `packages/storage/test/torn-copy.test.ts` builds every such copy from two real commits, page by page.

- **Over IPC.** Errors are a typed `ProjectFileError` with a code. The IPC returns `{ status: "failed", reason }`, and logs only the code, never paths or content. The renderer never sends a path: native dialogs run in the main process.

### 6. Storage API shape
- **Synchronous, like better-sqlite3.** `create`, `open`, `commit(changes)` (one transaction), `putBlob`/`readBlob` (SHA-256 content addressing), `saveVersion`/`listVersions`/`readVersion` (manifests of document hashes) and `close`. Each call is one short transaction in the main process. Architecture §6 sketches a Promise API; it can wrap this later, or move into a `utilityProcess` if commits outgrow the budget.
- **Format version 1 is provisional** until Phase 1 adds the first fixture (`packages/test-utils/fixtures/`).

### 7. Reading an older site format never writes (R14, 24 Oct 2026)
- **What happens:** `readSite` migrates a site saved in an older site format in memory only. The first `commit` writes the whole migrated site, then that commit's own changes, in one transaction. `saveSite` replaces the pending migration with the site it writes.
- **Why:**
  - Opening and closing a site without editing leaves its file byte for byte as it was, so a sync client doesn't upload it again and an older build can still open it.
  - The file never holds documents of two formats: the migrated site and the first edit land together, or neither does.
- **Before:** `readSite` wrote the migrated site straight away, as a side effect of reading.
- **Tests:** `packages/storage/test/site-and-safety.test.ts`.
- **The migration rule:** [ADR 0012](0012-site-format-migrations.md).

## Consequences
- The native-module risk is low: no rebuild step and no per-Electron-upgrade work while better-sqlite3 ships Node-API prebuilds. Watch for that on upgrades.
- `pnpm e2e:packaged` and the `Packaged app` CI job (Windows + macOS) catch packaging regressions. They add about a minute per OS to CI.
- **Open time grows with file size** because of `quick_check` (≈2 s per GB). If big projects make this noticeable:
  - check only the small tables on open (`PRAGMA quick_check(table)`);
  - verify blob hashes lazily on read.
- **Follow-ups (Phase 1):**
  - garbage collection of unreferenced blobs
  - an `assets` table
  - restore and export
  - migrations
  - online backups
  - single-instance file hand-off
  - the sync-folder warning
  - a real OneDrive/Dropbox check
  - a format-v1 fixture
