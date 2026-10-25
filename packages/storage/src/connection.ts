import { createHash } from "node:crypto";
import Database from "better-sqlite3";

/**
 * Hardens a connection before anything is read from a possibly untrusted file
 * ([Defense against the dark arts](https://www.sqlite.org/security.html)). better-sqlite3 already
 * turns on `SQLITE_DBCONFIG_DEFENSIVE`, which blocks `writable_schema`, `journal_mode=OFF` and
 * other ways to corrupt the file from SQL.
 */
export function hardenConnection(db: Database.Database): void {
  // Functions with side effects may not run from views or triggers stored in the file.
  db.pragma("trusted_schema = OFF");
  // Catch malformed b-tree cells early instead of reading past them.
  db.pragma("cell_size_check = ON");
  // Never memory-map the file: an I/O error would then crash the process instead of failing a call.
  db.pragma("mmap_size = 0");
  // A document or asset can't name a blob the file doesn't have. better-sqlite3 turns this on by
  // default; set here so a change of default can't turn it off (R14, a test checks).
  db.pragma("foreign_keys = ON");
}

/**
 * Settings for every write. The rollback journal (`DELETE`) leaves no side files once a commit
 * has finished, so copying the `.wforge` alone (cloud sync, e-mail, USB stick) always gets every
 * committed change; WAL would leave recent commits in a `-wal` file (ADR 0003). `FULL` syncs the
 * journal and the database before a commit returns, so a returned commit survives a crash.
 */
export function configureWrites(db: Database.Database): void {
  db.pragma("journal_mode = DELETE");
  db.pragma("synchronous = FULL");
}

/**
 * Opens a connection to the project file at `path`, hardened before anything is read. Every
 * connection to a project opens here: the store's, a backup's, the storage writer's (R13b, ADR
 * 0013), so none is opened with other settings. One that writes then gets {@link configureWrites}.
 * `create` makes a new file, for a project being created.
 */
export function connect(
  path: string,
  options: { readonly readOnly?: boolean; readonly create?: boolean } = {},
): Database.Database {
  const db = new Database(path, {
    fileMustExist: options.create !== true,
    readonly: options.readOnly === true,
  });
  try {
    hardenConnection(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

/** The SHA-256 of `data`, as blobs are named. */
export function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Stores `data` under its hash unless a blob has it already. */
export const INSERT_BLOB =
  "INSERT OR IGNORE INTO blobs (hash, mime, size, data) VALUES (?, ?, ?, ?)";
