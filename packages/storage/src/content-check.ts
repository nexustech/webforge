import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";
import { hasVersionFacts } from "./blob-reach.js";
import { ProjectFileError } from "./errors.js";

// A .wforge copied while Webforge writes to it (a sync client, e-mail, a USB stick; ADR 0003) can
// hold some of a commit's pages and not others: the rollback journal that would undo half a
// commit stays behind. SQLite's quick_check only sees the b-trees, which can be whole on both
// sides of the tear (#295). So every commit also records what it left, and opening checks it.

/**
 * The rows a fingerprint covers, in a fixed order: every document's and asset's row, and which
 * versions there are. A version's row is only ever added or removed, never changed, so its id is
 * enough; hashing every manifest (each lists every document) would slow down every save.
 */
const FINGERPRINT_ROWS = `
  SELECT 'document', id, kind, blob_hash, NULL, NULL, NULL FROM documents
  UNION ALL
  SELECT 'asset', media_id, mime, blob_hash, width, height, original_name FROM assets
  UNION ALL
  SELECT 'version', id, NULL, NULL, NULL, NULL, NULL FROM versions
  ORDER BY 1, 2`;

/**
 * The working copy's fingerprint: 32 bits of the SHA-256 of {@link FINGERPRINT_ROWS}. Never 0, which marks a file written before fingerprints (format 1 files from
 * before #295), whose content isn't checked against one.
 */
function contentFingerprint(db: Database.Database): number {
  const rows = db.prepare(FINGERPRINT_ROWS).raw().all();
  const value = createHash("sha256").update(JSON.stringify(rows)).digest().readInt32LE(0);
  return value === 0 ? 1 : value;
}

/**
 * Records the fingerprint in the database header (`user_version`, page 1, which every write
 * transaction rewrites anyway). Call it inside every transaction that changes documents, assets
 * or versions, so the header and the rows always come from the same commit.
 */
export function stampContent(db: Database.Database): void {
  db.pragma(`user_version = ${contentFingerprint(db)}`);
}

/**
 * Runs `change` in one transaction on `db`, which records the content fingerprint before it
 * commits, if it changed a row: every write to a project goes through here, on any connection. A
 * change that alters no row (garbage collection with nothing to remove, a blob stored again)
 * leaves the fingerprint as it was and isn't stamped: the transaction then only read, so the
 * file's bytes and modified time stay as they were, and a sync folder or a backup sees no change
 * nobody made (#661).
 */
export function stamped<T>(db: Database.Database, change: () => T): T {
  const totalChanges = db.prepare("SELECT total_changes()").pluck();
  return db.transaction(() => {
    const before = Number(totalChanges.get());
    const result = change();
    if (Number(totalChanges.get()) !== before) stampContent(db);
    return result;
  })();
}

const corrupt = (message: string) => new ProjectFileError("corrupt", message);

const documentBlobsSchema = z.array(z.tuple([z.string(), z.instanceof(Uint8Array)]));

/**
 * Checks that a project's content is whole, after SQLite's own check (#295). Throws a `corrupt`
 * {@link ProjectFileError}, as a failed quick_check does, so the app offers the backups:
 * - the header's fingerprint must match the rows, else the copy holds parts of two commits;
 * - every document, asset and version must refer to a blob the file has;
 * - every document's blob must be the bytes its hash names (an image is checked when it is read).
 */
export function checkContent(db: Database.Database): void {
  const recorded = Number(db.pragma("user_version", { simple: true }));
  if (recorded !== 0 && recorded !== contentFingerprint(db)) {
    throw corrupt("The project holds parts of two commits (a copy taken while it was written)");
  }
  const missing = db
    .prepare(
      `SELECT count(*) FROM (
         SELECT blob_hash AS hash FROM documents UNION ALL SELECT blob_hash FROM assets
       ) LEFT JOIN blobs USING (hash) WHERE blobs.hash IS NULL`,
    )
    .pluck()
    .get();
  if (missing !== 0) {
    throw corrupt("A document or asset refers to a missing blob");
  }
  // One query for every version: looking each manifest's hashes up one by one from JavaScript
  // took 2.4 s for 300 versions of 40 pages, this takes about 30 ms (test/open-time.test.ts).
  const badManifests = db
    .prepare(
      `SELECT count(*) FROM versions
       WHERE NOT json_valid(manifest) OR json_type(manifest, '$.documents') IS NOT 'array'`,
    )
    .pluck()
    .get();
  if (badManifests !== 0) {
    throw corrupt("A version's manifest is not a list of documents");
  }
  // Only once every manifest is valid JSON: json_each fails on one that isn't.
  const missingInVersions = db
    .prepare(
      `SELECT count(*) FROM versions, json_each(versions.manifest, '$.documents') AS entry
       LEFT JOIN blobs ON blobs.hash = json_extract(entry.value, '$.hash')
       WHERE blobs.hash IS NULL`,
    )
    .pluck()
    .get();
  if (missingInVersions !== 0) {
    throw corrupt("A version refers to a missing blob");
  }
  const missingPictures = hasVersionFacts(db)
    ? db
        .prepare(
          `SELECT count(*) FROM versions LEFT JOIN blobs ON blobs.hash = versions.thumbnail_hash
           WHERE versions.thumbnail_hash IS NOT NULL AND blobs.hash IS NULL`,
        )
        .pluck()
        .get()
    : 0;
  if (missingPictures !== 0) {
    throw corrupt("A version's picture is missing");
  }
  const documentBlobs = documentBlobsSchema.parse(
    db
      .prepare(
        "SELECT blobs.hash, blobs.data FROM documents JOIN blobs ON blobs.hash = documents.blob_hash",
      )
      .raw()
      .all(),
  );
  for (const [hash, data] of documentBlobs) {
    if (createHash("sha256").update(data).digest("hex") !== hash) {
      throw corrupt("A document's content is not what its hash names");
    }
  }
}
