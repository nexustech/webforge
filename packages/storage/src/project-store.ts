import { createHash, randomUUID } from "node:crypto";
import { existsSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import Database from "better-sqlite3";
import { z } from "zod";
import { ProjectFileError } from "./errors.js";
import { APPLICATION_ID, FORMAT_VERSION, SCHEMA } from "./schema.js";

const jsonValueSchema = z.json();

/** A JSON value as stored in a document. */
export type JsonValue = z.infer<typeof jsonValueSchema>;

/** One document of the working copy, e.g. a page, the header or the theme. */
export type StoredDocument = {
  /** Stable id, e.g. `page:home` or `layout:header`. */
  readonly id: string;
  /** What the document is, e.g. `page`, `layout` or `theme`. */
  readonly kind: string;
  readonly content: JsonValue;
};

/** A change to the working copy. One {@link ProjectStore.commit} applies a list of them atomically. */
export type DocumentChange =
  | ({ readonly type: "put" } & StoredDocument)
  | { readonly type: "delete"; readonly id: string };

/** A binary blob, such as an image, stored once under the SHA-256 hash of its bytes. */
export type StoredBlob = {
  readonly mime: string;
  readonly data: Uint8Array;
};

/** Who took a version: the user (`manual`) or Webforge (`auto`). */
export type VersionKind = "manual" | "auto";

/** A saved version of the project (snapshot of the working copy). */
export type VersionInfo = {
  readonly id: string;
  readonly name: string;
  readonly kind: VersionKind;
  /** ISO 8601 timestamp (UTC). */
  readonly createdAt: string;
};

/** Facts about an open project. */
export type ProjectInfo = {
  readonly projectId: string;
  /** Site name chosen when the project was created. */
  readonly name: string;
  readonly formatVersion: number;
  /** ISO 8601 timestamp (UTC). */
  readonly createdAt: string;
};

/** Options for {@link ProjectStore.create}. */
export type CreateProjectOptions = {
  /** Site name, e.g. "Rosa's Bakery". */
  readonly name: string;
};

const JSON_MIME = "application/json";
const utf8 = new TextDecoder("utf-8", { fatal: true });

const metaSchema = z.strictObject({
  format_version: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number),
  project_id: z.uuid(),
  name: z.string().min(1),
  created_at: z.iso.datetime(),
});

const manifestSchema = z.strictObject({
  documents: z.record(
    z.string().min(1),
    z.strictObject({ kind: z.string().min(1), hash: z.string().regex(/^[0-9a-f]{64}$/) }),
  ),
});

type Manifest = z.infer<typeof manifestSchema>;

const schemaRowSchema = z.object({
  type: z.string(),
  name: z.string(),
  tbl_name: z.string(),
  sql: z.string().nullable(),
});

const documentRowSchema = z.object({ id: z.string(), kind: z.string(), hash: z.string() });
const blobRowSchema = z.object({ mime: z.string(), data: z.instanceof(Uint8Array) });
const versionRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["manual", "auto"]),
  created_at: z.string(),
});

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** The `sqlite_schema` rows of a database, in a stable order, for comparison. */
function readSchema(db: Database.Database): string[] {
  return db
    .prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name")
    .all()
    .map((row) => JSON.stringify(schemaRowSchema.parse(row)));
}

let expectedSchema: readonly string[] | undefined;

/** What `sqlite_schema` of a valid project looks like, read from an in-memory database once. */
function getExpectedSchema(): readonly string[] {
  if (expectedSchema === undefined) {
    const db = new Database(":memory:");
    try {
      for (const statement of SCHEMA) {
        db.exec(statement);
      }
      expectedSchema = readSchema(db);
    } finally {
      db.close();
    }
  }
  return expectedSchema;
}

function sqliteErrorCode(error: unknown): string | undefined {
  return error instanceof Database.SqliteError ? error.code : undefined;
}

/** Turns SQLite's errors about the file itself into {@link ProjectFileError}s. */
function toProjectFileError(error: unknown): unknown {
  const code = sqliteErrorCode(error);
  if (code === "SQLITE_NOTADB") {
    return new ProjectFileError("not-a-project", "The file is not an SQLite database", {
      cause: error,
    });
  }
  if (code?.startsWith("SQLITE_CORRUPT") === true) {
    return new ProjectFileError("corrupt", "SQLite reports the database as corrupt", {
      cause: error,
    });
  }
  return error;
}

/**
 * Hardens a connection before anything is read from a possibly untrusted file
 * ([Defense against the dark arts](https://www.sqlite.org/security.html)). better-sqlite3 already
 * turns on `SQLITE_DBCONFIG_DEFENSIVE`, which blocks `writable_schema`, `journal_mode=OFF` and
 * other ways to corrupt the file from SQL.
 */
function hardenConnection(db: Database.Database): void {
  // Functions with side effects may not run from views or triggers stored in the file.
  db.pragma("trusted_schema = OFF");
  // Catch malformed b-tree cells early instead of reading past them.
  db.pragma("cell_size_check = ON");
  // Never memory-map the file: an I/O error would then crash the process instead of failing a call.
  db.pragma("mmap_size = 0");
}

/**
 * Settings for every write. The rollback journal (`DELETE`) leaves no side files once a commit
 * has finished, so copying the `.wforge` alone (cloud sync, e-mail, USB stick) always gets every
 * committed change; WAL would leave recent commits in a `-wal` file (ADR 0003). `FULL` syncs the
 * journal and the database before a commit returns, so a returned commit survives a crash.
 */
function configureWrites(db: Database.Database): void {
  db.pragma("journal_mode = DELETE");
  db.pragma("synchronous = FULL");
}

function readMetaRows(db: Database.Database): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM meta").all();
  return Object.fromEntries(
    rows.map((row) => {
      const { key, value } = z.object({ key: z.string(), value: z.string() }).parse(row);
      return [key, value];
    }),
  );
}

/** Checks that `db` is a Webforge project this build can open, and returns its metadata. */
function validateProject(db: Database.Database): ProjectInfo {
  if (db.pragma("application_id", { simple: true }) !== APPLICATION_ID) {
    throw new ProjectFileError("not-a-project", "The database is not a Webforge project");
  }
  const check = db.pragma("quick_check", { simple: true });
  if (check !== "ok") {
    throw new ProjectFileError("corrupt", "The project fails SQLite's integrity check");
  }
  // Read the format version before comparing schemas: a newer format has a different schema, and
  // the user should be told to update rather than that the file is broken.
  let metaRows: Record<string, string>;
  try {
    metaRows = readMetaRows(db);
  } catch (error) {
    throw new ProjectFileError("unexpected-schema", "The project has no readable metadata", {
      cause: error,
    });
  }
  const formatVersion = metaSchema.shape.format_version.safeParse(metaRows.format_version);
  if (formatVersion.success && formatVersion.data > FORMAT_VERSION) {
    throw new ProjectFileError(
      "newer-format",
      `The project uses format version ${formatVersion.data}; this build reads up to ${FORMAT_VERSION}`,
    );
  }
  const schema = readSchema(db);
  const expected = getExpectedSchema();
  if (schema.length !== expected.length || schema.some((row, index) => row !== expected[index])) {
    throw new ProjectFileError("unexpected-schema", "The project's tables do not match its format");
  }
  const meta = metaSchema.safeParse(metaRows);
  if (!meta.success) {
    throw new ProjectFileError("unexpected-schema", "The project's metadata is invalid", {
      cause: meta.error,
    });
  }
  return {
    projectId: meta.data.project_id,
    name: meta.data.name,
    formatVersion: meta.data.format_version,
    createdAt: meta.data.created_at,
  };
}

/**
 * A `.wforge` project file: an SQLite database holding the working copy as JSON documents,
 * content-addressed blobs and saved versions (research/stack/06, ADR 0003).
 *
 * The API is synchronous, like better-sqlite3: each call is one short transaction in the main
 * process. A store owns its file until {@link close} is called.
 */
export class ProjectStore {
  readonly #db: Database.Database;
  readonly #info: ProjectInfo;

  private constructor(db: Database.Database, info: ProjectInfo) {
    this.#db = db;
    this.#info = info;
  }

  /**
   * Creates a new, empty project at `path`, replacing any file there, and opens it. The file is
   * built under a temporary name next to `path` and renamed into place, so a crash never leaves
   * a half-created project.
   */
  static create(path: string, options: CreateProjectOptions): ProjectStore {
    const tempPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    try {
      const db = new Database(tempPath);
      try {
        db.pragma(`application_id = ${APPLICATION_ID}`);
        configureWrites(db);
        const meta = {
          format_version: String(FORMAT_VERSION),
          project_id: randomUUID(),
          name: options.name,
          created_at: new Date().toISOString(),
        };
        db.transaction(() => {
          for (const statement of SCHEMA) {
            db.exec(statement);
          }
          const insert = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
          for (const [key, value] of Object.entries(meta)) {
            insert.run(key, value);
          }
        })();
      } finally {
        db.close();
      }
      renameSync(tempPath, path);
    } catch (error) {
      rmSync(tempPath, { force: true });
      throw error;
    }
    return ProjectStore.open(path);
  }

  /**
   * Opens an existing project. The file is treated as untrusted: it must carry the Webforge
   * application id, pass SQLite's quick check, have exactly the tables of its format version and
   * valid metadata. Otherwise this throws a {@link ProjectFileError} and leaves the file untouched.
   */
  static open(path: string): ProjectStore {
    if (!existsSync(path)) {
      throw new ProjectFileError("not-found", "The project file does not exist");
    }
    const db = new Database(path, { fileMustExist: true });
    try {
      hardenConnection(db);
      const info = validateProject(db);
      configureWrites(db);
      return new ProjectStore(db, info);
    } catch (error) {
      db.close();
      throw toProjectFileError(error);
    }
  }

  /** Facts about this project. */
  get info(): ProjectInfo {
    return this.#info;
  }

  /** Every document of the working copy, sorted by id. */
  readDocuments(): StoredDocument[] {
    return this.#db
      .prepare("SELECT id, kind, blob_hash AS hash FROM documents ORDER BY id")
      .all()
      .map((row) => {
        const { id, kind, hash } = documentRowSchema.parse(row);
        return { id, kind, content: this.#readJsonBlob(hash) };
      });
  }

  /** One document of the working copy, or `undefined` if there is none with this id. */
  readDocument(id: string): StoredDocument | undefined {
    const row = this.#db
      .prepare("SELECT id, kind, blob_hash AS hash FROM documents WHERE id = ?")
      .get(id);
    if (row === undefined) {
      return undefined;
    }
    const { kind, hash } = documentRowSchema.parse(row);
    return { id, kind, content: this.#readJsonBlob(hash) };
  }

  /**
   * Applies `changes` to the working copy in one transaction: after a crash the file holds either
   * all of them or none. When this returns, the changes are on disk.
   */
  commit(changes: readonly DocumentChange[]): void {
    const upsert = this.#db.prepare(
      `INSERT INTO documents (id, kind, blob_hash) VALUES (?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, blob_hash = excluded.blob_hash`,
    );
    const remove = this.#db.prepare("DELETE FROM documents WHERE id = ?");
    this.#db.transaction(() => {
      for (const change of changes) {
        if (change.type === "put") {
          const data = Buffer.from(JSON.stringify(change.content), "utf8");
          upsert.run(change.id, change.kind, this.#insertBlob(data, JSON_MIME));
        } else {
          remove.run(change.id);
        }
      }
    })();
  }

  /**
   * Stores binary data, such as an image, and returns its SHA-256 hash. Storing the same bytes
   * again reuses the existing blob.
   */
  putBlob(data: Uint8Array, mime: string): string {
    return this.#db.transaction(() => this.#insertBlob(data, mime))();
  }

  /** The blob stored under `hash`, or `undefined` if there is none. */
  readBlob(hash: string): StoredBlob | undefined {
    const row = this.#db.prepare("SELECT mime, data FROM blobs WHERE hash = ?").get(hash);
    return row === undefined ? undefined : blobRowSchema.parse(row);
  }

  /**
   * Saves the working copy as a version. Versions share unchanged content with the working copy
   * and with each other, so saving one only writes a small manifest.
   */
  saveVersion(name: string, kind: VersionKind): VersionInfo {
    const documents: Manifest["documents"] = {};
    for (const row of this.#db.prepare("SELECT id, kind, blob_hash AS hash FROM documents").all()) {
      const document = documentRowSchema.parse(row);
      documents[document.id] = { kind: document.kind, hash: document.hash };
    }
    const version: VersionInfo = {
      id: randomUUID(),
      name,
      kind,
      createdAt: new Date().toISOString(),
    };
    this.#db
      .prepare(
        `INSERT INTO versions (id, name, kind, created_at, format_version, manifest)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        version.id,
        version.name,
        version.kind,
        version.createdAt,
        FORMAT_VERSION,
        JSON.stringify({ documents }),
      );
    return version;
  }

  /** Saved versions, newest first. */
  listVersions(): VersionInfo[] {
    return this.#db
      .prepare("SELECT id, name, kind, created_at FROM versions ORDER BY rowid DESC")
      .all()
      .map((row) => {
        const { id, name, kind, created_at } = versionRowSchema.parse(row);
        return { id, name, kind, createdAt: created_at };
      });
  }

  /** The documents of a saved version sorted by id, or `undefined` if there is no such version. */
  readVersion(id: string): StoredDocument[] | undefined {
    const row = this.#db.prepare("SELECT manifest FROM versions WHERE id = ?").get(id);
    if (row === undefined) {
      return undefined;
    }
    const { manifest } = z.object({ manifest: z.string() }).parse(row);
    let parsed: Manifest;
    try {
      parsed = manifestSchema.parse(JSON.parse(manifest));
    } catch (error) {
      throw new ProjectFileError("corrupt", "A version's manifest is invalid", { cause: error });
    }
    return (
      Object.entries(parsed.documents)
        // Manifest keys are unique, so two ids never compare equal.
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([documentId, { kind, hash }]) => ({
          id: documentId,
          kind,
          content: this.#readJsonBlob(hash),
        }))
    );
  }

  /** Closes the file. With the rollback journal, no side files are left next to it. */
  close(): void {
    this.#db.close();
  }

  #insertBlob(data: Uint8Array, mime: string): string {
    const hash = sha256(data);
    this.#db
      .prepare("INSERT OR IGNORE INTO blobs (hash, mime, size, data) VALUES (?, ?, ?, ?)")
      .run(hash, mime, data.byteLength, data);
    return hash;
  }

  #readJsonBlob(hash: string): JsonValue {
    const blob = this.readBlob(hash);
    if (blob === undefined) {
      throw new ProjectFileError("corrupt", "A document refers to a missing blob");
    }
    try {
      return jsonValueSchema.parse(JSON.parse(utf8.decode(blob.data)));
    } catch (error) {
      throw new ProjectFileError("corrupt", "A document is not valid JSON", { cause: error });
    }
  }
}
