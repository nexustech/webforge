/**
 * `PRAGMA application_id` of every `.wforge` file: "WFRG" in ASCII. It lets Webforge (and tools
 * such as `file`) tell a project apart from any other SQLite database before reading a table.
 */
export const APPLICATION_ID = 0x57_46_52_47;

/**
 * Version of the `.wforge` layout this build writes. Bumped with a migration and a fixture file on
 * every incompatible change (engineering standards §8). Version 1 stays provisional until Phase 1
 * ships the first fixture.
 */
export const FORMAT_VERSION = 1;

/**
 * The complete schema of format version {@link FORMAT_VERSION}. Opening a file compares its
 * `sqlite_schema` with this list, so a file with extra tables, triggers or views is rejected.
 */
export const SCHEMA: readonly string[] = [
  `CREATE TABLE meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
) STRICT, WITHOUT ROWID`,
  // A rowid table: blobs hold images of several MB, and WITHOUT ROWID tables are slow with large
  // rows (single-page commits took 41 ms instead of 9 ms next to 100 MB of images, ADR 0003).
  `CREATE TABLE blobs (
  hash TEXT PRIMARY KEY NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL
) STRICT`,
  `CREATE TABLE documents (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  blob_hash TEXT NOT NULL REFERENCES blobs (hash)
) STRICT, WITHOUT ROWID`,
  // Imported media: which blob holds each item's original, with what the import measured. Alt text,
  // focal point and crop live in the site document instead, so editing them is undoable.
  `CREATE TABLE assets (
  media_id TEXT PRIMARY KEY NOT NULL,
  blob_hash TEXT NOT NULL REFERENCES blobs (hash),
  mime TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  original_name TEXT NOT NULL
) STRICT, WITHOUT ROWID`,
  `CREATE TABLE versions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'auto')),
  created_at TEXT NOT NULL,
  format_version INTEGER NOT NULL,
  manifest TEXT NOT NULL
) STRICT`,
];
