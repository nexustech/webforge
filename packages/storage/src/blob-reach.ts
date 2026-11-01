import type Database from "better-sqlite3";
import { z } from "zod";
import { ProjectFileError } from "./errors.js";

// Which blobs the working copy and the versions reach, read through any connection to a project:
// the main process's store, or the storage writer's (ADR 0013), which cleans the file up as a site
// closes.

const jsonValueSchema = z.json();

/** A JSON value as stored in a document. */
export type JsonValue = z.infer<typeof jsonValueSchema>;

const utf8 = new TextDecoder("utf-8", { fatal: true });

const HASH = /^[0-9a-f]{64}$/;

/**
 * A version's documents in `readDocuments` order. An array, so any id (even "__proto__") works.
 * Keys a newer Webforge may add are ignored, so its versions still read.
 */
const manifestSchema = z.object({
  documents: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.string().min(1),
      hash: z.string().regex(HASH),
    }),
  ),
});

/** A version's documents: each one's id, kind and blob. */
export type Manifest = z.infer<typeof manifestSchema>;

/** A version's manifest, parsed and checked. */
export function parseManifest(manifest: string): Manifest {
  try {
    return manifestSchema.parse(JSON.parse(manifest));
  } catch (error) {
    throw new ProjectFileError("corrupt", "A version's manifest is invalid", { cause: error });
  }
}

/** A document's JSON text, parsed and checked. */
export function parseDocument(text: string): JsonValue {
  try {
    return jsonValueSchema.parse(JSON.parse(text));
  } catch (error) {
    throw new ProjectFileError("corrupt", "A document is not valid JSON", { cause: error });
  }
}

/** A document's blob as text, unparsed. */
export function decodeDocument(data: Uint8Array | undefined): string {
  if (data === undefined) {
    throw new ProjectFileError("corrupt", "A document refers to a missing blob");
  }
  try {
    return utf8.decode(data);
  } catch (error) {
    throw new ProjectFileError("corrupt", "A document is not valid JSON", { cause: error });
  }
}

/**
 * Adds every string in `value` that looks like a blob hash to `into`. Deliberately generous: a
 * document only has to mention a hash anywhere (media metadata, a future field) to keep its blob,
 * so garbage collection can only ever keep too much, never remove a blob something uses.
 */
function collectHashes(value: unknown, into: Set<string>): void {
  // Iterative: a document nested very deeply (a crafted file) can't overflow the stack (R14).
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const item = pending.pop();
    if (typeof item === "string") {
      if (HASH.test(item)) into.add(item);
    } else if (Array.isArray(item)) {
      for (const each of item) pending.push(each);
    } else if (typeof item === "object" && item !== null) {
      for (const each of Object.values(item)) pending.push(each);
    }
  }
}

/** A hash as a JSON string, in a document's text. */
const QUOTED_HASH = /"([0-9a-f]{64})"/g;

/**
 * Adds every hash the JSON text `json` names to `into`, as {@link collectHashes} does for its
 * parsed value, but from the text: garbage collection reads every document the working copy and
 * the versions store, and scanning their text takes about half the time of parsing them (#661).
 * The scan is more generous than the walk, never less: it also counts a hash used as a key. Only a
 * `\u` escape can hide a hash from it, and `JSON.stringify` never writes one for a hash's letters
 * and digits, so a document with one (a crafted file) is walked as well.
 */
function collectHashesFromJson(json: string, into: Set<string>): void {
  for (const [, hash] of json.matchAll(QUOTED_HASH)) {
    if (hash !== undefined) into.add(hash);
  }
  if (json.includes("\\u")) collectHashes(parseDocument(json), into);
}

/**
 * The blobs `documents` reach: every hash their content names, such as a Media item's original or
 * a bundled file (3.9). Garbage collection keeps these, and a site package carries them (A26).
 */
export function reachableBlobs(documents: Iterable<{ readonly content: unknown }>): Set<string> {
  const reached = new Set<string>();
  for (const { content } of documents) collectHashes(content, reached);
  return reached;
}

/** Whether the file's `versions` has format 2's columns (a format 1 file opened read-only hasn't). */
export function hasVersionFacts(db: Database.Database): boolean {
  return (
    db
      .prepare("SELECT 1 FROM pragma_table_info('versions') WHERE name = 'thumbnail_hash'")
      .get() !== undefined
  );
}

/**
 * What the working copy and each version reach, read once per document's blob: a document
 * unchanged since a version is shared with it, so its text is read and scanned once.
 */
function readReach(db: Database.Database) {
  const readText = db.prepare("SELECT data FROM blobs WHERE hash = ?").pluck();
  const byDocument = new Map<string, Set<string>>();
  /** The blobs a document reaches: its own, and those it names. */
  const reachOf = (hash: string): Set<string> => {
    let reached = byDocument.get(hash);
    if (reached === undefined) {
      reached = new Set([hash]);
      const data = readText.get(hash);
      collectHashesFromJson(decodeDocument(data instanceof Uint8Array ? data : undefined), reached);
      byDocument.set(hash, reached);
    }
    return reached;
  };
  const union = (hashes: Iterable<string>): Set<string> => {
    const reached = new Set<string>();
    for (const hash of hashes) for (const each of reachOf(hash)) reached.add(each);
    return reached;
  };
  const working = union(db.prepare("SELECT blob_hash FROM documents").pluck().all().map(String));
  const facts = hasVersionFacts(db);
  const versions = db
    .prepare(
      `SELECT id, manifest, ${facts ? "thumbnail_hash" : "NULL"} AS thumbnail
       FROM versions ORDER BY rowid DESC`,
    )
    .all()
    .map((row) => {
      const { id, manifest, thumbnail } = z
        .object({ id: z.string(), manifest: z.string(), thumbnail: z.string().nullable() })
        .parse(row);
      const reached = union(parseManifest(manifest).documents.map(({ hash }) => hash));
      if (thumbnail !== null) reached.add(thumbnail);
      return { id, reached };
    });
  return { working, versions };
}

/** Each blob's size, by hash. */
function blobSizes(db: Database.Database): Map<string, number> {
  return new Map(
    db
      .prepare("SELECT hash, size FROM blobs")
      .all()
      .map((row) => {
        const { hash, size } = z.object({ hash: z.string(), size: z.number() }).parse(row);
        return [hash, size];
      }),
  );
}

/** What {@link collectGarbage} removed. */
export type GarbageReport = {
  readonly blobs: number;
  readonly bytes: number;
  readonly assets: number;
};

/**
 * Deletes blobs nothing refers to any more, and the assets that point at them (06: "garbage
 * collection"). A blob is kept when the working copy or any version stores a document in it, a
 * hash in such a document names it (media metadata), or it is a version's picture. Run it inside a
 * transaction that stamps the content fingerprint, as every write does.
 */
export function collectGarbage(db: Database.Database): GarbageReport {
  const { working, versions } = readReach(db);
  const referenced = new Set(working);
  for (const { reached } of versions) for (const hash of reached) referenced.add(hash);
  const unreferenced = [...blobSizes(db)].filter(([hash]) => !referenced.has(hash));
  // Assets first: their foreign key keeps a blob from being deleted while a row points at it.
  const { changes: assets } = db
    .prepare("DELETE FROM assets WHERE blob_hash IN (SELECT value FROM json_each(?))")
    .run(JSON.stringify(unreferenced.map(([hash]) => hash)));
  const removeBlob = db.prepare("DELETE FROM blobs WHERE hash = ?");
  let bytes = 0;
  for (const [hash, size] of unreferenced) {
    removeBlob.run(hash);
    bytes += size;
  }
  return { blobs: unreferenced.length, bytes, assets };
}

/** How much of the file the versions take (4.6). */
export type VersionSpace = {
  /** What the versions keep that the working copy doesn't: what deleting all of them would free. */
  readonly bytes: number;
  /** What each keeps that nothing else does, newest first: what deleting it alone would free. */
  readonly versions: readonly { readonly id: string; readonly bytes: number }[];
};

/**
 * How much of the file the versions take, counted from their blobs: a page saved unchanged in ten
 * versions is one blob, which none of them keeps alone. Space is freed once the site closes and
 * its file is cleaned up.
 */
export function versionSpace(db: Database.Database): VersionSpace {
  const { working, versions } = readReach(db);
  const sizes = blobSizes(db);
  /** How many versions keep each blob the working copy doesn't. */
  const keptBy = new Map<string, number>();
  for (const { reached } of versions) {
    for (const hash of reached) {
      if (!working.has(hash)) keptBy.set(hash, (keptBy.get(hash) ?? 0) + 1);
    }
  }
  const size = (hash: string) => sizes.get(hash) ?? 0;
  let bytes = 0;
  for (const hash of keptBy.keys()) bytes += size(hash);
  return {
    bytes,
    versions: versions.map(({ id, reached }) => {
      let own = 0;
      for (const hash of reached) if (keptBy.get(hash) === 1) own += size(hash);
      return { id, bytes: own };
    }),
  };
}
