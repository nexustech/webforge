import type Database from "better-sqlite3";
import { configureWrites, connect, INSERT_BLOB, sha256, UPSERT_ASSET } from "./connection.js";
import { stampContent } from "./content-check.js";
import { ProjectFileError } from "./errors.js";
import type { NewAsset } from "./project-store.js";
import { APPLICATION_ID } from "./schema.js";

/**
 * Writes imports into a project through a connection of its own, for the storage writer thread
 * (R13b, ADR 0013): a large import's bytes are hashed and written there, off the main thread, while
 * the main process's store waits its turn at the store gate. Nothing of an import is written on
 * the main thread, not even the asset row, whose commit would wait for the disk there.
 *
 * The file must be one the main process has opened and checked already: this opens it as it is,
 * without checking it again.
 */
export class AssetWriter {
  readonly #db: Database.Database;

  private constructor(db: Database.Database) {
    this.#db = db;
  }

  /** Opens the project at `path` for writing imports. */
  static open(path: string): AssetWriter {
    const db = connect(path);
    try {
      if (db.pragma("application_id", { simple: true }) !== APPLICATION_ID) {
        throw new ProjectFileError("not-a-project", "The database is not a Webforge project");
      }
      configureWrites(db);
      return new AssetWriter(db);
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
    return this.#db.transaction(() => {
      this.#db.prepare(INSERT_BLOB).run(hash, asset.mime, asset.data.byteLength, asset.data);
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
      stampContent(this.#db);
      return hash;
    })();
  }

  /** Closes the connection. */
  close(): void {
    this.#db.close();
  }
}
