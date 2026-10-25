import type Database from "better-sqlite3";
import { configureWrites, connect, INSERT_BLOB, sha256 } from "./connection.js";
import { ProjectFileError } from "./errors.js";
import { APPLICATION_ID } from "./schema.js";

/**
 * Writes blobs into a project through a connection of its own, for the storage writer thread
 * (R13b, ADR 0013): a large import's bytes are hashed and written there, off the main thread, while
 * the main process's store waits its turn at the store gate. It writes blobs only, which the
 * content fingerprint doesn't cover (#295), so there is nothing to stamp; the store records the
 * asset that names the blob afterwards ({@link ProjectStore.addAsset}).
 *
 * The file must be one the main process has opened and checked already: this opens it as it is,
 * without checking it again.
 */
export class BlobWriter {
  readonly #db: Database.Database;

  private constructor(db: Database.Database) {
    this.#db = db;
  }

  /** Opens the project at `path` for writing blobs. */
  static open(path: string): BlobWriter {
    const db = connect(path);
    try {
      if (db.pragma("application_id", { simple: true }) !== APPLICATION_ID) {
        throw new ProjectFileError("not-a-project", "The database is not a Webforge project");
      }
      configureWrites(db);
      return new BlobWriter(db);
    } catch (error) {
      db.close();
      throw error;
    }
  }

  /**
   * Stores `data` as a blob unless the file has one with its hash, and gives the hash. One
   * transaction, synced like every commit, so a returned blob survives a crash.
   */
  put(data: Uint8Array, mime: string): string {
    const hash = sha256(data);
    this.#db.prepare(INSERT_BLOB).run(hash, mime, data.byteLength, data);
    return hash;
  }

  /** Closes the connection. */
  close(): void {
    this.#db.close();
  }
}
