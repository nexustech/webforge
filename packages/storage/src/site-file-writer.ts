import type Database from "better-sqlite3";
import { collectGarbage, type GarbageReport } from "./blob-reach.js";
import { configureWrites, connect, INSERT_BLOB, sha256, UPSERT_ASSET } from "./connection.js";
import { stamped } from "./content-check.js";
import { ProjectFileError } from "./errors.js";
import type { NewAsset } from "./project-store.js";
import { APPLICATION_ID } from "./schema.js";

/**
 * Space the file must have free before {@link SiteFileWriter.cleanUp} gives it back to the disk:
 * at least this many bytes, and this share of the file. VACUUM rewrites the whole file, which a
 * sync folder then uploads again (ADR 0003), so it waits until that pays.
 */
const VACUUM_MIN_FREE_BYTES = 4 * 1024 * 1024;
const VACUUM_MIN_FREE_SHARE = 0.25;

/**
 * The most a file may keep for {@link SiteFileWriter.cleanUp} to VACUUM it. A VACUUM can't be
 * stopped once it has started, not even by stopping the thread, and it takes about 45 ms a MB kept
 * on a fast disk (measured for #664), so this keeps it well inside the 5 s the main process gives
 * a clean-up. A larger file is left for Version History's Clean up (4.6), which says it's working.
 */
const VACUUM_MAX_KEPT_BYTES = 16 * 1024 * 1024;

/** What {@link SiteFileWriter.cleanUp} did: the blobs and assets it removed, and whether the file shrank. */
export type CleanUpReport = GarbageReport & { readonly vacuumed: boolean };

/**
 * A file's bytes for {@link SiteFileWriter.putBlobs}, with the hash they must have when the caller
 * knows it: bytes that hash otherwise are refused, and nothing is stored.
 */
export type NewBlob = {
  readonly data: Uint8Array;
  readonly mime: string;
  readonly hash?: string | undefined;
};

/** A Media item's asset for the first file {@link SiteFileWriter.putBlobs} stores. */
export type BlobAsset = Omit<NewAsset, "data" | "mime">;

/**
 * Writes a project's files through a connection of its own, for the storage writer thread (R13b,
 * ADR 0013): imports, pasted and downloaded files, which it hashes and writes off the main thread,
 * and the clean-up as a site closes. The main process's store waits its turn at the store gate
 * meanwhile. Nothing of these is written on the main thread, not even an asset row, whose commit
 * would wait for the disk there.
 *
 * The file must be one the main process has opened and checked already: this opens it as it is,
 * without checking it again.
 */
export class SiteFileWriter {
  readonly #db: Database.Database;

  private constructor(db: Database.Database) {
    this.#db = db;
  }

  /** Opens the project at `path` for writing. */
  static open(path: string): SiteFileWriter {
    const db = connect(path);
    try {
      if (db.pragma("application_id", { simple: true }) !== APPLICATION_ID) {
        throw new ProjectFileError("not-a-project", "The database is not a Webforge project");
      }
      configureWrites(db);
      return new SiteFileWriter(db);
    } catch (error) {
      db.close();
      throw error;
    }
  }

  /**
   * Stores an imported file's original bytes, unmodified (X2), and records it as a Media item's
   * asset, in one transaction that records the content fingerprint (#295), as
   * `ProjectStore.putAsset` does. Gives the bytes' hash: `hash`, when the caller has it already
   * (the storage writer hashes while it prepares an import, before it may write).
   */
  put(asset: NewAsset, hash: string = sha256(asset.data)): string {
    return stamped(this.#db, () => {
      this.#db.prepare(INSERT_BLOB).run(hash, asset.mime, asset.data.byteLength, asset.data);
      this.#upsertAsset(asset, hash);
      return hash;
    });
  }

  /**
   * Stores files' bytes, all or none, and gives their hashes in order: a pasted Media item's,
   * with its asset when `asset` says it's the site's first copy of it, or files the site's code
   * downloaded (3.9). Bytes the file has already are kept as they are. Throws, storing nothing,
   * when a file's bytes don't have the hash it expects: an asset would name bytes that aren't its
   * item's.
   */
  putBlobs(blobs: readonly NewBlob[], asset?: BlobAsset): string[] {
    return stamped(this.#db, () => {
      const insert = this.#db.prepare(INSERT_BLOB);
      const hashes = blobs.map(({ data, mime, hash: expected }) => {
        const hash = sha256(data);
        if (expected !== undefined && hash !== expected) {
          throw new Error("A file's bytes are not the ones expected");
        }
        insert.run(hash, mime, data.byteLength, data);
        return hash;
      });
      const [first] = blobs;
      const [hash] = hashes;
      if (asset !== undefined && first !== undefined && hash !== undefined) {
        this.#upsertAsset({ ...asset, mime: first.mime }, hash);
      }
      return hashes;
    });
  }

  /**
   * Cleans the file up as its site closes: garbage collection (see `ProjectStore.collectGarbage`),
   * then, when that removed something, a VACUUM once enough of the file is free and the file is
   * small enough to rewrite quickly ({@link VACUUM_MAX_KEPT_BYTES}), which gives the space back to
   * the disk. Run it only once no undo step can bring a reference back, with the file to itself:
   * the VACUUM rewrites the whole file. With nothing to remove it writes nothing, however much is
   * free, so a site opened and closed unedited stays as it was (#661).
   */
  cleanUp(): CleanUpReport {
    const removed = stamped(this.#db, () => collectGarbage(this.#db));
    const pageSize = Number(this.#db.pragma("page_size", { simple: true }));
    const free = Number(this.#db.pragma("freelist_count", { simple: true })) * pageSize;
    const size = Number(this.#db.pragma("page_count", { simple: true })) * pageSize;
    const vacuumed =
      removed.blobs + removed.assets > 0 &&
      free >= VACUUM_MIN_FREE_BYTES &&
      free >= size * VACUUM_MIN_FREE_SHARE &&
      size - free <= VACUUM_MAX_KEPT_BYTES;
    // VACUUM keeps the header's fingerprint and application id, and writes the rows as they are.
    if (vacuumed) this.#db.exec("VACUUM");
    return { ...removed, vacuumed };
  }

  #upsertAsset(asset: Omit<NewAsset, "data">, hash: string): void {
    this.#db
      .prepare(UPSERT_ASSET)
      .run(
        asset.mediaId,
        hash,
        asset.mime,
        asset.width ?? null,
        asset.height ?? null,
        asset.originalName,
      );
  }

  /** Closes the connection. */
  close(): void {
    this.#db.close();
  }
}
