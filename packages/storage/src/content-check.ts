import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { z } from "zod";
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

const corrupt = (message: string) => new ProjectFileError("corrupt", message);

const manifestHashesSchema = z.object({
  documents: z.array(z.object({ hash: z.string() })),
});

const documentBlobsSchema = z.array(z.tuple([z.string(), z.instanceof(Uint8Array)]));

/** `text` as JSON, or `undefined` if it isn't JSON. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

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
  const has = db.prepare("SELECT 1 FROM blobs WHERE hash = ?").pluck();
  for (const manifest of db.prepare("SELECT manifest FROM versions").pluck().all()) {
    const parsed = manifestHashesSchema.safeParse(parseJson(String(manifest)));
    if (!parsed.success || parsed.data.documents.some(({ hash }) => has.get(hash) === undefined)) {
      throw corrupt("A version refers to a missing blob");
    }
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
