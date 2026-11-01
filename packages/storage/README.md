# @webforge/storage

`.wforge` SQLite project store: JSON documents, content-addressed blobs and versions, on better-sqlite3. Decisions and measurements: [ADR 0003](../../docs/adr/0003-wforge-sqlite-storage.md).

## Public API
Import from `@webforge/storage` only.

- `ProjectStore.create(path, { name })` builds a new project under a temporary name and renames it into place; `ProjectStore.open(path, { readOnly? })` validates an untrusted file first (application id, quick check, the exact schema of its format, metadata, and that its content is whole: the commit fingerprint in `user_version`, every blob referred to present, document blobs matching their hashes; #295) and throws `ProjectFileError` with a `code`. Every write that changes documents, assets or versions stamps the fingerprint in the same transaction (`src/content-check.ts`).
- `readEditorMode()` / `writeEditorMode(mode)`: the editor's Design or Content mode for the site (M3, 1.10), kept as the `editor_mode` key of `meta`. It is UI state, not part of the site: never versioned. An unknown value reads as Design and never stops a file opening.
  - An older format is checked against its own schema (`SCHEMAS`), read as it is, and migrated by the first write, in its transaction (`SCHEMA_MIGRATIONS`, [ADR 0020](../../docs/adr/0020-storage-format-2.md)): a file opened and closed unedited stays as it was.
  - A file from a newer Webforge opens read-only with `info.newerFormat`, so the app can show it and ask the user to update. Writes to a read-only store throw `ReadOnlyProjectError`.
- `readSite()` assembles the site documents, migrates them with `migrateSite` from `@webforge/model` and validates them (throws `SiteFormatError`). A site in an older site format is migrated in memory only; the next commit writes it, in the same transaction as its changes (ADR 0003 §7). `saveSite(site)` writes a whole site and drops removed pages' documents.
- `backupTo(path)` makes a consistent copy with SQLite's online backup API, renamed into place when complete.
- `detectSyncFolder(path)` names the OneDrive, Dropbox, iCloud or Google Drive folder a site is in, for the sync-folder warning.
- `commit(changes)` applies document puts and deletes in one transaction; `putBlob` / `readBlob` store binary data under its SHA-256 hash; `saveVersion(name, reason, { documents?, thumbnailHash?, publishedTo? })` / `listVersions` / `readVersion` / `readVersionSite` keep snapshots that share unchanged content; `readManifest` reads the documents a publish saves once it has gone live (ADR 0018 §3); `recordPublish`, `deleteVersion`, `pruneAutoVersions(keep)` and `versionSpace()` serve Version History (4.6).
- `putAsset({ mediaId, data, mime, width?, height?, originalName })` stores an imported original unmodified with its facts in the `assets` table; `readAsset` / `listAssets` read them back. Alt text, focal point and crop live in the site document, so they're undoable.
- `collectGarbage()` deletes blobs that neither the working copy nor any version refers to (a document's own blob, or any hash named inside a document), with their assets. That rule is part of the file format: an older Webforge collects a file whose site documents are in a newer site format, so a newer one must keep naming blobs by their hash as a JSON string, or change the file format. A version's picture is kept too. The desktop app cleans a file up when its site closes, after the last save, never while it is edited, so Undo can still restore a deleted image: `SiteFileWriter.cleanUp()` on the storage writer's thread collects garbage, then VACUUMs once enough of the file is free (ADR 0013, addendum).
- The API is synchronous; it runs in the Electron main process.

## File format (version 2)
Each format's fixture is `packages/test-utils/fixtures/wforge/v<n>.wforge`, made once by `test/support/make-v<n>-fixture.ts` and never regenerated; every release must open every one. Format 2 adds a version's reason, site format, picture and publish record ([ADR 0020](../../docs/adr/0020-storage-format-2.md)).

Tables `meta`, `blobs`, `documents`, `assets`, `versions` (`src/schema.ts`); `PRAGMA application_id` "WFRG"; rollback journal (`journal_mode=DELETE`, `synchronous=FULL`) so no side files exist between commits.

## Tests
`test/` holds integration tests against real temporary files, including a child writer process that is killed mid-write (`test/support/writer.ts`) and a sync-client-style copier.

## Boundaries
- Framework-free: no React, no Electron renderer APIs.
- Core package: coverage ≥ 90% lines / ≥ 85% branches.
