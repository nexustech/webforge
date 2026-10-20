import { createHash, randomUUID } from "node:crypto";
import { existsSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  migrateSite,
  pageDocumentId,
  type SiteDoc,
  siteDocuments,
  siteFromDocuments,
} from "@webforge/model";
import Database from "better-sqlite3";
import { z } from "zod";
import { ProjectFileError, ReadOnlyProjectError } from "./errors.js";
import { APPLICATION_ID, FORMAT_VERSION, SCHEMA, SCHEMA_MIGRATIONS, SCHEMAS } from "./schema.js";

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

/**
 * A change to the working copy. One {@link ProjectStore.commit} applies a list of them atomically.
 * Put content is stored as JSON; `undefined` properties are dropped, as `JSON.stringify` does.
 */
export type DocumentChange =
  | {
      readonly type: "put";
      readonly id: string;
      readonly kind: string;
      readonly content: unknown;
    }
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

/** What {@link ProjectStore.putAsset} stores: an imported file's original bytes and facts. */
export type NewAsset = {
  /** The id of the site's Media item (`MediaId`). */
  readonly mediaId: string;
  readonly data: Uint8Array;
  readonly mime: string;
  /** Pixel size, for images. */
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  /** The file's name on the user's computer, e.g. `shop.jpg`. Never a path. */
  readonly originalName: string;
};

/** An imported Media item's original, as recorded in the `assets` table. */
export type AssetInfo = {
  readonly mediaId: string;
  /** SHA-256 of the original; {@link ProjectStore.readBlob} returns the bytes. */
  readonly hash: string;
  readonly mime: string;
  readonly width: number | undefined;
  readonly height: number | undefined;
  readonly originalName: string;
};

/** What {@link ProjectStore.collectGarbage} removed. */
export type GarbageReport = {
  readonly blobs: number;
  readonly bytes: number;
  readonly assets: number;
};

/** Facts about an open project. */
export type ProjectInfo = {
  readonly projectId: string;
  /** Site name chosen when the project was created. */
  readonly name: string;
  readonly formatVersion: number;
  /** ISO 8601 timestamp (UTC). */
  readonly createdAt: string;
  /** Opened without write access: on request, or because a newer Webforge saved it. */
  readonly readOnly: boolean;
  /** Saved by a newer Webforge (format above {@link FORMAT_VERSION}); the user should update. */
  readonly newerFormat: boolean;
};

/** Options for {@link ProjectStore.open}. */
export type OpenProjectOptions = {
  /** Open without write access, e.g. to look inside a backup. */
  readonly readOnly?: boolean;
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

/** A version's documents in `readDocuments` order. An array, so any id (even "__proto__") works. */
const manifestSchema = z.strictObject({
  documents: z.array(
    z.strictObject({
      id: z.string().min(1),
      kind: z.string().min(1),
      hash: z.string().regex(/^[0-9a-f]{64}$/),
    }),
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

const assetRowSchema = z.object({
  media_id: z.string(),
  blob_hash: z.string(),
  mime: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  original_name: z.string(),
});

const HASH = /^[0-9a-f]{64}$/;

function toAssetInfo(row: unknown): AssetInfo {
  const asset = assetRowSchema.parse(row);
  return {
    mediaId: asset.media_id,
    hash: asset.blob_hash,
    mime: asset.mime,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    originalName: asset.original_name,
  };
}

/**
 * Adds every string in `value` that looks like a blob hash to `into`. Deliberately generous: a
 * document only has to mention a hash anywhere (media metadata, a future field) to keep its blob,
 * so garbage collection can only ever keep too much, never remove a blob something uses.
 */
function collectHashes(value: JsonValue, into: Set<string>): void {
  if (typeof value === "string") {
    if (HASH.test(value)) into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectHashes(item, into);
  } else if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) collectHashes(item, into);
  }
}

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

const expectedSchemas = new Map<number, readonly string[]>();

/**
 * What `sqlite_schema` of a valid project of format `version` looks like, read from an in-memory
 * database once per version, or `undefined` for a format this build doesn't know.
 */
function getExpectedSchema(version: number): readonly string[] | undefined {
  const statements = SCHEMAS[version];
  if (statements === undefined) {
    return undefined;
  }
  let expected = expectedSchemas.get(version);
  if (expected === undefined) {
    const db = new Database(":memory:");
    try {
      for (const statement of statements) {
        db.exec(statement);
      }
      expected = readSchema(db);
      expectedSchemas.set(version, expected);
    } finally {
      db.close();
    }
  }
  return expected;
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

/** What {@link validateProject} learns about a file. */
type ValidatedProject = Omit<ProjectInfo, "readOnly">;

/**
 * Checks that `db` is a Webforge project this build can open, and returns its metadata. A file of
 * an older format must have exactly that format's tables; a newer one only needs the metadata,
 * since a newer Webforge may have added tables. It is then only ever opened read-only.
 */
function validateProject(db: Database.Database): ValidatedProject {
  if (db.pragma("application_id", { simple: true }) !== APPLICATION_ID) {
    throw new ProjectFileError("not-a-project", "The database is not a Webforge project");
  }
  const check = db.pragma("quick_check", { simple: true });
  if (check !== "ok") {
    throw new ProjectFileError("corrupt", "The project fails SQLite's integrity check");
  }
  let metaRows: Record<string, string>;
  try {
    metaRows = readMetaRows(db);
  } catch (error) {
    throw new ProjectFileError("unexpected-schema", "The project has no readable metadata", {
      cause: error,
    });
  }
  const version = metaSchema.shape.format_version.safeParse(metaRows.format_version);
  const newerFormat = version.success && version.data > FORMAT_VERSION;
  if (!newerFormat) {
    const expected = version.success ? getExpectedSchema(version.data) : undefined;
    const schema = readSchema(db);
    if (
      expected === undefined ||
      schema.length !== expected.length ||
      schema.some((row, index) => row !== expected[index])
    ) {
      throw new ProjectFileError(
        "unexpected-schema",
        "The project's tables do not match its format",
      );
    }
  }
  // A newer Webforge may also have added metadata keys.
  const meta = (newerFormat ? metaSchema.loose() : metaSchema).safeParse(metaRows);
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
    newerFormat,
  };
}

/**
 * Brings an older file's tables up to {@link FORMAT_VERSION}, one format at a time, in one
 * transaction: after a crash the file is either fully migrated or untouched.
 */
function migrateSchema(db: Database.Database, from: number): void {
  db.transaction(() => {
    for (let version = from; version < FORMAT_VERSION; version += 1) {
      const step = SCHEMA_MIGRATIONS[version];
      if (step === undefined) {
        throw new ProjectFileError("unexpected-schema", `No migration from format ${version}`);
      }
      for (const statement of step) {
        db.exec(statement);
      }
    }
    db.prepare("UPDATE meta SET value = ? WHERE key = 'format_version'").run(
      String(FORMAT_VERSION),
    );
  })();
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
  /** Prepared statements by SQL text, compiled once per connection. */
  readonly #statements = new Map<string, Database.Statement>();

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
   *
   * An older format is migrated to {@link FORMAT_VERSION} first (unless opened read-only). A file
   * from a newer Webforge opens read-only, with `info.newerFormat` set, instead of failing.
   */
  static open(path: string, options: OpenProjectOptions = {}): ProjectStore {
    if (!existsSync(path)) {
      throw new ProjectFileError("not-found", "The project file does not exist");
    }
    const readOnly = options.readOnly === true;
    const db = new Database(path, { fileMustExist: true, readonly: readOnly });
    try {
      hardenConnection(db);
      const validated = validateProject(db);
      if (validated.newerFormat && !readOnly) {
        db.close();
        return ProjectStore.open(path, { readOnly: true });
      }
      if (readOnly) {
        return new ProjectStore(db, { ...validated, readOnly });
      }
      configureWrites(db);
      if (validated.formatVersion < FORMAT_VERSION) {
        migrateSchema(db, validated.formatVersion);
        // The migration checked nothing new about the file; only its version changed.
        return new ProjectStore(db, { ...validated, formatVersion: FORMAT_VERSION, readOnly });
      }
      return new ProjectStore(db, { ...validated, readOnly });
    } catch (error) {
      if (db.open) db.close();
      throw toProjectFileError(error);
    }
  }

  /** Facts about this project. */
  get info(): ProjectInfo {
    return this.#info;
  }

  /** Every document of the working copy, sorted by id. */
  readDocuments(): StoredDocument[] {
    return this.#prepare("SELECT id, kind, blob_hash AS hash FROM documents ORDER BY id")
      .all()
      .map((row) => {
        const { id, kind, hash } = documentRowSchema.parse(row);
        return { id, kind, content: this.#readJsonBlob(hash) };
      });
  }

  /** Whether the working copy has no documents yet, as in a project just created. */
  isEmpty(): boolean {
    return this.#prepare("SELECT 1 FROM documents LIMIT 1").get() === undefined;
  }

  /** One document of the working copy, or `undefined` if there is none with this id. */
  readDocument(id: string): StoredDocument | undefined {
    const row = this.#prepare("SELECT id, kind, blob_hash AS hash FROM documents WHERE id = ?").get(
      id,
    );
    if (row === undefined) {
      return undefined;
    }
    const { kind, hash } = documentRowSchema.parse(row);
    return { id, kind, content: this.#readJsonBlob(hash) };
  }

  /**
   * The site in the working copy, migrated to the current site format and validated. A site saved
   * in an older format is written back in the new one straight away (unless the project is
   * read-only), so its documents never mix formats. Throws `SiteFormatError` from
   * `@webforge/model` for an invalid site or a newer site format.
   */
  readSite(): SiteDoc {
    const raw = siteFromDocuments(this.readDocuments());
    const site = migrateSite(raw);
    const storedVersion = (raw as { formatVersion?: unknown }).formatVersion;
    if (storedVersion !== site.formatVersion && !this.#info.readOnly) {
      this.saveSite(site);
    }
    return site;
  }

  /**
   * Writes a whole site in one transaction, e.g. a new or migrated one, and deletes the documents
   * of pages it no longer has. Saving edits uses {@link commit} with only the changed documents.
   */
  saveSite(site: SiteDoc): void {
    this.#assertWritable();
    const keep = new Set(site.pageOrder.map(pageDocumentId));
    const stalePages = this.#prepare("SELECT id FROM documents WHERE kind = 'page'")
      .pluck()
      .all()
      .map(String)
      .filter((id) => !keep.has(id));
    this.commit([
      ...siteDocuments(site).map((document) => ({ type: "put" as const, ...document })),
      ...stalePages.map((id) => ({ type: "delete" as const, id })),
    ]);
  }

  /**
   * Applies `changes` to the working copy in one transaction: after a crash the file holds either
   * all of them or none. When this returns, the changes are on disk.
   */
  commit(changes: readonly DocumentChange[]): void {
    this.#assertWritable();
    const upsert = this.#prepare(
      `INSERT INTO documents (id, kind, blob_hash) VALUES (?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, blob_hash = excluded.blob_hash`,
    );
    const remove = this.#prepare("DELETE FROM documents WHERE id = ?");
    this.#db.transaction(() => {
      for (const change of changes) {
        if (change.type === "put") {
          const json = JSON.stringify(change.content);
          if (json === undefined) {
            throw new TypeError(`Document "${change.id}" has no JSON content`);
          }
          const data = Buffer.from(json, "utf8");
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
    this.#assertWritable();
    return this.#db.transaction(() => this.#insertBlob(data, mime))();
  }

  /** The blob stored under `hash`, or `undefined` if there is none. */
  readBlob(hash: string): StoredBlob | undefined {
    const row = this.#prepare("SELECT mime, data FROM blobs WHERE hash = ?").get(hash);
    return row === undefined ? undefined : blobRowSchema.parse(row);
  }

  /**
   * Saves the working copy as a version. Versions share unchanged content with the working copy
   * and with each other, so saving one only writes a small manifest.
   */
  saveVersion(name: string, kind: VersionKind): VersionInfo {
    this.#assertWritable();
    const documents: Manifest["documents"] = this.#prepare(
      "SELECT id, kind, blob_hash AS hash FROM documents ORDER BY id",
    )
      .all()
      .map((row) => documentRowSchema.parse(row));
    const version: VersionInfo = {
      id: randomUUID(),
      name,
      kind,
      createdAt: new Date().toISOString(),
    };
    this.#prepare(
      `INSERT INTO versions (id, name, kind, created_at, format_version, manifest)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
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
    return this.#prepare("SELECT id, name, kind, created_at FROM versions ORDER BY rowid DESC")
      .all()
      .map((row) => {
        const { id, name, kind, created_at } = versionRowSchema.parse(row);
        return { id, name, kind, createdAt: created_at };
      });
  }

  /** The documents of a saved version sorted by id, or `undefined` if there is no such version. */
  readVersion(id: string): StoredDocument[] | undefined {
    const row = this.#prepare("SELECT manifest FROM versions WHERE id = ?").get(id);
    if (row === undefined) {
      return undefined;
    }
    const { manifest } = z.object({ manifest: z.string() }).parse(row);
    return this.#parseManifest(manifest).documents.map(({ id: documentId, kind, hash }) => ({
      id: documentId,
      kind,
      content: this.#readJsonBlob(hash),
    }));
  }

  /**
   * Stores an imported file's original bytes, unmodified (X2), and records it as a Media item's
   * asset, in one transaction. Importing the same bytes again reuses the blob; a new `mediaId`
   * row points at it. Replacing an item's file gives its `mediaId` a new blob.
   */
  putAsset(asset: NewAsset): AssetInfo {
    this.#assertWritable();
    return this.#db.transaction(() => {
      const hash = this.#insertBlob(asset.data, asset.mime);
      this.#prepare(
        `INSERT INTO assets (media_id, blob_hash, mime, width, height, original_name)
           VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (media_id) DO UPDATE SET blob_hash = excluded.blob_hash,
           mime = excluded.mime, width = excluded.width, height = excluded.height,
           original_name = excluded.original_name`,
      ).run(
        asset.mediaId,
        hash,
        asset.mime,
        asset.width ?? null,
        asset.height ?? null,
        asset.originalName,
      );
      return {
        mediaId: asset.mediaId,
        hash,
        mime: asset.mime,
        width: asset.width,
        height: asset.height,
        originalName: asset.originalName,
      };
    })();
  }

  /** The asset of a Media item, or `undefined` if none was imported under this id. */
  readAsset(mediaId: string): AssetInfo | undefined {
    const row = this.#prepare("SELECT * FROM assets WHERE media_id = ?").get(mediaId);
    return row === undefined ? undefined : toAssetInfo(row);
  }

  /** Every asset, sorted by media id. */
  listAssets(): AssetInfo[] {
    return this.#prepare("SELECT * FROM assets ORDER BY media_id").all().map(toAssetInfo);
  }

  /**
   * Deletes blobs nothing refers to any more, and the assets that point at them (06: "garbage
   * collection"). A blob is kept when the working copy or any version stores a document in it, or
   * a hash in such a document names it (media metadata).
   *
   * Run it only when no undo step can bring a reference back: when a site is opened, before any
   * editing, or when it is closed, after the last save. A deleted image stays restorable by Undo
   * until then. Freed pages are reused by later writes; the file does not shrink until a VACUUM.
   */
  collectGarbage(): GarbageReport {
    this.#assertWritable();
    return this.#db.transaction(() => {
      const documentHashes = new Set(
        this.#prepare("SELECT blob_hash FROM documents").pluck().all().map(String),
      );
      for (const row of this.#prepare("SELECT manifest FROM versions").pluck().all()) {
        for (const { hash } of this.#parseManifest(String(row)).documents) {
          documentHashes.add(hash);
        }
      }
      const referenced = new Set(documentHashes);
      for (const hash of documentHashes) {
        collectHashes(this.#readJsonBlob(hash), referenced);
      }

      const unreferenced = this.#prepare("SELECT hash, size FROM blobs")
        .all()
        .map((row) => z.object({ hash: z.string(), size: z.number() }).parse(row))
        .filter((blob) => !referenced.has(blob.hash));
      // Assets first: their foreign key keeps a blob from being deleted while a row points at it.
      const { changes: assets } = this.#prepare(
        "DELETE FROM assets WHERE blob_hash IN (SELECT value FROM json_each(?))",
      ).run(JSON.stringify(unreferenced.map((blob) => blob.hash)));
      const removeBlob = this.#prepare("DELETE FROM blobs WHERE hash = ?");
      let bytes = 0;
      for (const blob of unreferenced) {
        removeBlob.run(blob.hash);
        bytes += blob.size;
      }
      return { blobs: unreferenced.length, bytes, assets };
    })();
  }

  /**
   * Copies the project to `path` with SQLite's online backup API (06: "Backups"): a consistent
   * copy even while the site is being edited, written in steps so the main process stays
   * responsive. The copy is built under a temporary name and renamed into place, so `path` never
   * holds half a backup.
   */
  async backupTo(path: string): Promise<void> {
    const tempPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    try {
      await this.#db.backup(tempPath);
      renameSync(tempPath, path);
    } catch (error) {
      rmSync(tempPath, { force: true });
      throw error;
    }
  }

  /** Closes the file. With the rollback journal, no side files are left next to it. */
  close(): void {
    this.#db.close();
  }

  #assertWritable(): void {
    if (this.#info.readOnly) {
      throw new ReadOnlyProjectError();
    }
  }

  #prepare(sql: string): Database.Statement {
    let statement = this.#statements.get(sql);
    if (statement === undefined) {
      statement = this.#db.prepare(sql);
      this.#statements.set(sql, statement);
    }
    return statement;
  }

  #insertBlob(data: Uint8Array, mime: string): string {
    const hash = sha256(data);
    this.#prepare("INSERT OR IGNORE INTO blobs (hash, mime, size, data) VALUES (?, ?, ?, ?)").run(
      hash,
      mime,
      data.byteLength,
      data,
    );
    return hash;
  }

  #parseManifest(manifest: string): Manifest {
    try {
      return manifestSchema.parse(JSON.parse(manifest));
    } catch (error) {
      throw new ProjectFileError("corrupt", "A version's manifest is invalid", { cause: error });
    }
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
