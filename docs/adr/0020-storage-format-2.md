# 0020. Storage format 2: what a version records, and the first schema migration

- Status: Accepted
- Date: 2026-11-01
- Related: #664, second architecture review A5 ([2026-10-30](../reviews/2026-10-30-architecture-review-2.md)), [ADR 0003](0003-wforge-sqlite-storage.md), [ADR 0012](0012-site-format-migrations.md), [ADR 0013](0013-store-gate.md), [ADR 0018](0018-publishing-from-a-version.md)

## Context
Version History (4.6) and publishing (4.5) need a version to say more than its name and who saved it:
- why it was saved, so pruning keeps the person's own versions and the last 20 automatic ones (P3);
- which site format its documents are in;
- its picture;
- where it was published, and what the live check found (ADR 0018 §3).

Format 1's `versions` table holds none of this. Its `format_version` always holds storage format 1. `SCHEMA_MIGRATIONS` was empty, so no file had ever been migrated, and opening checks a file's schema exactly, as text.

## Decision
1. **Format 2 adds four columns to `versions`, after format 1's, which all stay:**
   - `reason`: `manual`, `daily`, `before-restore`, `before-site-wide` or `on-publish`. A `CHECK` ties it to `kind`: only `manual` versions are the person's.
   - `site_format`: the site format the version's documents were saved in, as its `site` document records it. `readVersionSite` migrates from it, as `readSite` does.
   - `thumbnail_hash`: a blob, referenced by a foreign key. Garbage collection keeps it, and opening refuses a file whose version names a picture it doesn't have (#295).
   - `published_to`: JSON, `{ destinationId, publishedAt, check, deploy? }`, checked when read. A record that doesn't parse reads as never published, and never stops a file opening. A republish replaces it: it is the last publish.

   Keeping `kind` and `format_version` means an older Webforge, which opens a format 2 file read-only, still lists its versions: it reads its columns by name.
2. **The migration remakes `versions`.** `ALTER TABLE ADD COLUMN` writes the new columns into the stored `CREATE TABLE` in its own way, which isn't the text format 2's schema is checked against. So the step renames the table, creates format 2's, copies the rows with their rowids (they keep their order) and drops the old one.
   - A format 1 version's reason is `manual` for a manual one, else `daily`: format 1 knew only who saved it.
   - Its site format is read from its `site` document in SQL, each JSON function guarded inside `CASE`, the one place SQLite promises the order. A document that doesn't say gives 1.
3. **A file migrates with its first write, not when it opens.** `ProjectStore.#write` runs the steps inside the transaction of the first write, as the first commit writes a migrated site (ADR 0012, decision 5). So a file opened and closed unedited stays byte for byte as it was (R14), and a crash leaves it either migrated with that write or untouched. Until then the store reads format 1's columns, saying what the migration would.
4. **`saveVersion` takes the documents a publish read** (`readManifest`), so the "Published …" version is what went live (ADR 0018 §3). It refuses documents whose blobs have gone. They can't go while the site is open: garbage collection runs only as it closes.
5. **The store gains what 4.6 needs:** `deleteVersion`, `pruneAutoVersions(keep)` (never a manual version, nor the newest `on-publish` one, which the live site came from), `versionSpace()` (what all versions keep, and what each keeps alone), `recordPublish` and `readVersionSite`.
6. **A version's manifest takes keys it doesn't know,** so a newer Webforge can add one without making its versions unreadable here.
7. **A site's ZIP carries each version's reason** (ZIP version 2, 4.7). A version 1 ZIP's versions get theirs as the migration gives them. A copy carries no picture and no publish record: it is published anew (ADR 0018 §2).

## Consequences
- 4.6 can record, list, prune and restore versions without a format change. `restoreSite` in the model makes the site a version's, document by document, as one undo step.
- An older Webforge never cleans up a format 2 file, which it can only open read-only, so it can't drop a version's picture it doesn't know of.
- Every format bump from now on follows this one: the schema in `SCHEMAS`, its step, a fixture (`v2.wforge`, made once by `test/support/make-v2-fixture.ts`) and a test that migrates the one before.
- `versionSpace` reads every document the versions hold. That's fine for Version History's panel, and 4.6 can move it to the writer if a large site makes it slow.
