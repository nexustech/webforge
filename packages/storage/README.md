# @webforge/storage

`.wforge` SQLite project store: JSON documents, content-addressed blobs and versions, on better-sqlite3. Decisions and measurements: [ADR 0003](../../docs/adr/0003-wforge-sqlite-storage.md).

## Public API
Import from `@webforge/storage` only.

- `ProjectStore.create(path, { name })` builds a new project under a temporary name and renames it into place; `ProjectStore.open(path)` validates an untrusted file first (application id, quick check, exact schema, metadata, format version) and throws `ProjectFileError` with a `code`.
- `commit(changes)` applies document puts and deletes in one transaction; `putBlob` / `readBlob` store binary data under its SHA-256 hash; `saveVersion` / `listVersions` / `readVersion` keep snapshots that share unchanged content.
- `putAsset({ mediaId, data, mime, width?, height?, originalName })` stores an imported original unmodified with its facts in the `assets` table; `readAsset` / `listAssets` read them back. Alt text, focal point and crop live in the site document, so they're undoable.
- `collectGarbage()` deletes blobs that neither the working copy nor any version refers to (a document's own blob, or any hash named inside a document), with their assets. Run it at open or close only, so Undo can still restore a deleted image during editing.
- The API is synchronous; it runs in the Electron main process.

## File format (version 1, provisional until the first fixture)
Tables `meta`, `blobs`, `documents`, `assets`, `versions` (`src/schema.ts`); `PRAGMA application_id` "WFRG"; rollback journal (`journal_mode=DELETE`, `synchronous=FULL`) so no side files exist between commits.

## Tests
`test/` holds integration tests against real temporary files, including a child writer process that is killed mid-write (`test/support/writer.ts`) and a sync-client-style copier.

## Boundaries
- Framework-free: no React, no Electron renderer APIs.
- Core package: coverage ≥ 90% lines / ≥ 85% branches.
