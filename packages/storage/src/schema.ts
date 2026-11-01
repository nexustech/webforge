/**
 * `PRAGMA application_id` of every `.wforge` file: "WFRG" in ASCII. It lets Webforge (and tools
 * such as `file`) tell a project apart from any other SQLite database before reading a table.
 */
export const APPLICATION_ID = 0x57_46_52_47;

/**
 * Version of the `.wforge` layout this build writes. Bumped with a migration and a fixture file on
 * every incompatible change (engineering standards §8); the fixtures are
 * `packages/test-utils/fixtures/wforge/v<n>.wforge`.
 */
export const FORMAT_VERSION = 2;

/**
 * The complete schema of format 1. Opening a file compares its `sqlite_schema` with its format's
 * list, so a file with extra tables, triggers or views is rejected.
 */
const SCHEMA_V1: readonly string[] = [
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

/** Format 1's tables other than `versions`, which format 2 keeps as they were. */
const UNCHANGED_IN_V2 = SCHEMA_V1.filter((statement) => !statement.includes("TABLE versions"));

/**
 * Format 2 (#664): a version says why it was saved, which site format its documents are in, its
 * picture and where it was published, for Version History (4.6) and publishing (4.5). Format 1's
 * columns stay, the new ones after them, so an older Webforge can still list the versions of a
 * file it opens read-only.
 */
const VERSIONS_V2 = `CREATE TABLE versions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'auto')),
  created_at TEXT NOT NULL,
  format_version INTEGER NOT NULL,
  manifest TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('manual', 'daily', 'before-restore', 'before-site-wide', 'on-publish')
    AND (reason = 'manual') = (kind = 'manual')
  ),
  site_format INTEGER NOT NULL,
  thumbnail_hash TEXT REFERENCES blobs (hash),
  published_to TEXT
) STRICT`;

const SCHEMA_V2: readonly string[] = [...UNCHANGED_IN_V2, VERSIONS_V2];

/**
 * The site format of a format 1 version, read from its `site` document, for `versions` (as
 * `versions_v1` while it moves): 1 when the document doesn't say. Each JSON function runs only on
 * text `json_valid` has passed, inside `CASE`, the one place SQLite promises the order.
 */
export const V1_SITE_FORMAT = `COALESCE((
  SELECT CASE WHEN json_valid(CAST(blobs.data AS TEXT)) THEN
    CASE WHEN json_type(CAST(blobs.data AS TEXT), '$.formatVersion') = 'integer'
      THEN json_extract(CAST(blobs.data AS TEXT), '$.formatVersion') END
  END
  FROM json_each(versions_v1.manifest, '$.documents') AS entry
  JOIN blobs ON blobs.hash = json_extract(entry.value, '$.hash')
  WHERE json_extract(entry.value, '$.id') = 'site'
), 1)`;

/** Why a format 1 version was saved: format 1 knew only by whom. */
export const V1_REASON = "CASE kind WHEN 'manual' THEN 'manual' ELSE 'daily' END";

/**
 * The schema of every format this build opens, so an older file is checked against its own
 * format before it is migrated. Entries are never removed. `meta` is the same in every format:
 * it says which format a file is in, so it is checked before that is known (S4).
 */
export const SCHEMAS: Readonly<Record<number, readonly string[]>> = { 1: SCHEMA_V1, 2: SCHEMA_V2 };

/** The schema new projects get. */
export const SCHEMA: readonly string[] = SCHEMA_V2;

/**
 * SQL that turns format `n` into `n + 1`, keyed by `n`. A format bump adds the new schema to
 * {@link SCHEMAS}, its step here and a fixture file in `packages/test-utils/fixtures/wforge/`.
 */
export const SCHEMA_MIGRATIONS: Readonly<Record<number, readonly string[]>> = {
  // A table's columns can only be added at its end as ALTER TABLE writes them, which isn't the
  // text format 2's schema compares with. So `versions` is made anew and its rows copied, rowids
  // and all: they keep their order (oldest first).
  1: [
    "ALTER TABLE versions RENAME TO versions_v1",
    VERSIONS_V2,
    `INSERT INTO versions (rowid, id, name, kind, created_at, format_version, manifest, reason,
      site_format)
    SELECT rowid, id, name, kind, created_at, format_version, manifest, ${V1_REASON},
      ${V1_SITE_FORMAT}
    FROM versions_v1 ORDER BY rowid`,
    "DROP TABLE versions_v1",
  ],
};
