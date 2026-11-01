import { randomUUID } from "node:crypto";
import { existsSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  DEFAULT_EXPORT_CHOICES,
  type ExportChoices,
  exportChoicesSchema,
  migrateSite,
  pageDocumentId,
  type SiteDoc,
  type SiteDocumentChange,
  siteCheckIgnoredSchema,
  siteDocuments,
  siteFromDocuments,
} from "@webforge/model";
import Database from "better-sqlite3";
import { z } from "zod";
import {
  collectGarbage,
  decodeDocument,
  type GarbageReport,
  type JsonValue,
  type Manifest,
  parseDocument,
  parseManifest,
  type VersionSpace,
  versionSpace,
} from "./blob-reach.js";
import { configureWrites, connect, INSERT_BLOB, sha256, UPSERT_ASSET } from "./connection.js";
import { checkContent, stampContent, stamped } from "./content-check.js";
import { ProjectFileError, ReadOnlyProjectError } from "./errors.js";
import {
  APPLICATION_ID,
  FORMAT_VERSION,
  SCHEMA,
  SCHEMA_MIGRATIONS,
  SCHEMAS,
  V1_REASON,
  V1_SITE_FORMAT,
} from "./schema.js";

/** One document of the working copy, e.g. a page, the header or the theme. */
export type StoredDocument = {
  /** Stable id, e.g. `page:home` or `layout:header`. */
  readonly id: string;
  /** What the document is, e.g. `page`, `layout` or `theme`. */
  readonly kind: string;
  readonly content: JsonValue;
};

/**
 * A change to the working copy, of a kind `@webforge/model` defines. One
 * {@link ProjectStore.commit} applies a list of them atomically. Put content is stored as JSON;
 * `undefined` properties are dropped, as `JSON.stringify` does.
 */
export type DocumentChange = SiteDocumentChange;

/** A binary blob, such as an image, stored once under the SHA-256 hash of its bytes. */
export type StoredBlob = {
  readonly mime: string;
  readonly data: Uint8Array;
};

/** Who took a version: the user (`manual`) or Webforge (`auto`). */
export type VersionKind = "manual" | "auto";

/**
 * Why a version was saved (storage format 2, for 4.6): the person saved it (`manual`), or Webforge
 * did, once a day, before a restore, before a change to every page, or as the site went live.
 * Only `manual` ones are the person's: pruning never deletes them.
 */
export const VERSION_REASONS = [
  "manual",
  "daily",
  "before-restore",
  "before-site-wide",
  "on-publish",
] as const;

/** See {@link VERSION_REASONS}. */
export type VersionReason = (typeof VERSION_REASONS)[number];

/** Who saves a version for `reason`. */
const kindOf = (reason: VersionReason): VersionKind => (reason === "manual" ? "manual" : "auto");

/**
 * Where a version was published, and what the live check found then (ADR 0018 §3): the last time,
 * when it has been republished.
 */
export const versionPublishSchema = z.strictObject({
  /** The site's publish destination (ADR 0018 §2). */
  destinationId: z.string().min(1).max(100),
  /** ISO 8601 timestamp (UTC). */
  publishedAt: z.iso.datetime(),
  /** The live check's answer (`@webforge/publish`'s `Verification`). */
  check: z.enum(["live", "different", "unreachable", "unchecked"]),
  /** The publisher's own name for what went live, such as Netlify's deploy id. */
  deploy: z.string().min(1).max(200).optional(),
});

/** See {@link versionPublishSchema}. */
export type VersionPublish = z.infer<typeof versionPublishSchema>;

/**
 * The editor's mode for a site (M3, 1.10): Design changes the layout, Content edits text and
 * images only. Remembered per site, but UI state: not part of the site, never versioned or undone.
 */
export type SiteEditorMode = "design" | "content";

const siteEditorModeSchema = z.enum(["design", "content"]);

/** A saved version of the project (snapshot of the working copy). */
export type VersionInfo = {
  readonly id: string;
  readonly name: string;
  /** Who saved it, which follows from why. */
  readonly kind: VersionKind;
  readonly reason: VersionReason;
  /** ISO 8601 timestamp (UTC). */
  readonly createdAt: string;
  /** The site format its documents were saved in: {@link ProjectStore.readVersionSite} migrates. */
  readonly siteFormat: number;
  /** The SHA-256 of its picture, a blob, if it has one. */
  readonly thumbnailHash: string | undefined;
  readonly publishedTo: VersionPublish | undefined;
};

/** What {@link ProjectStore.addVersion} takes: a version as another project has it. */
export type NewVersion = Pick<VersionInfo, "id" | "name" | "reason" | "createdAt">;

/**
 * The working copy's documents as a version holds them, each one's id, kind and blob, from
 * {@link ProjectStore.readManifest}: what a publish builds is saved once it has gone live, from
 * the documents it read when it started (ADR 0018 §3).
 */
export type VersionManifest = Manifest["documents"];

/** What {@link ProjectStore.saveVersion} saves, besides a name and a reason. */
export type SaveVersionOptions = {
  /** Its documents, as {@link ProjectStore.readManifest} read them; the working copy's by default. */
  readonly documents?: VersionManifest;
  /** The SHA-256 of a blob holding its picture. */
  readonly thumbnailHash?: string;
  readonly publishedTo?: VersionPublish;
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

/** Facts about an open project. */
export type ProjectInfo = {
  readonly projectId: string;
  /** Site name chosen when the project was created. */
  readonly name: string;
  /**
   * The storage format the file is in: an older one stays as it is until the first write, which
   * brings it to {@link FORMAT_VERSION}.
   */
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

const metaSchema = z.strictObject({
  format_version: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number),
  project_id: z.uuid(),
  name: z.string().min(1),
  created_at: z.iso.datetime(),
  /** Checked when read (see `readEditorMode`), so a bad value never stops the file opening. */
  editor_mode: z.string().optional(),
  /** JSON, checked when read (see `readExportChoices`), likewise. */
  export_choices: z.string().optional(),
  /** JSON, checked when read (see `readSiteCheckIgnored`), likewise. */
  site_check_ignored: z.string().optional(),
});

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
  reason: z.string(),
  created_at: z.string(),
  site_format: z.number(),
  thumbnail_hash: z.string().nullable(),
  published_to: z.string().nullable(),
});

/** A version's row as {@link VERSION_COLUMNS} reads it. */
function toVersionInfo(row: unknown): VersionInfo {
  const version = versionRowSchema.parse(row);
  // A newer Webforge may save for a reason this one doesn't know: who saved it is still known.
  const reason = z.enum(VERSION_REASONS).safeParse(version.reason);
  return {
    id: version.id,
    name: version.name,
    kind: version.kind,
    reason: reason.success ? reason.data : version.kind === "manual" ? "manual" : "daily",
    createdAt: version.created_at,
    siteFormat: version.site_format,
    thumbnailHash: version.thumbnail_hash ?? undefined,
    publishedTo: publishOf(version.published_to),
  };
}

/** What a version's `published_to` says, if it says it: a fact to show, never one to fail on. */
function publishOf(text: string | null): VersionPublish | undefined {
  if (text === null) return undefined;
  try {
    const parsed = versionPublishSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The columns a version is read from: by name, so a newer format's added ones are never read. A
 * format 1 file, opened read-only, says why and in which site format as its migration would.
 */
const VERSION_COLUMNS = (format: number) =>
  format >= 2
    ? "id, name, kind, reason, created_at, site_format, thumbnail_hash, published_to"
    : `id, name, kind, ${V1_REASON} AS reason, created_at, ${V1_SITE_FORMAT} AS site_format,
       NULL AS thumbnail_hash, NULL AS published_to`;

/** The site format `documents`' `site` document records, or 1 when it records none. */
function siteFormatOf(
  documents: Iterable<{ readonly id: string; readonly content: unknown }>,
): number {
  for (const { id, content } of documents) {
    if (id !== "site") continue;
    const site = z.object({ formatVersion: z.int().positive() }).safeParse(content);
    return site.success ? site.data.formatVersion : 1;
  }
  return 1;
}

const assetRowSchema = z.object({
  media_id: z.string(),
  blob_hash: z.string(),
  mime: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  original_name: z.string(),
});

/** The columns an asset is read from: by name, so a newer format's added ones are never read. */
const ASSET_COLUMNS = "media_id, blob_hash, mime, width, height, original_name";

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

/** The `sqlite_schema` rows of a database, in a stable order, for comparison. */
/**
 * The file's `sqlite_schema`: its tables, indexes, views and triggers, each as one JSON line.
 * Reading it runs nothing stored in the file, so it is safe on any file (S4).
 */
function readSchema(db: Database.Database): string[] {
  return db
    .prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name")
    .all()
    .map((row) => JSON.stringify(schemaRowSchema.parse(row)));
}

/** The tables every format has, whose rows the store reads: never a view, whatever the format. */
const READ_TABLES = ["meta", "documents", "blobs", "assets", "versions"] as const;

/**
 * Checks `schema` (from {@link readSchema}) before anything runs on the file's own tables (S4): a
 * view or trigger would run the file's SQL, which can loop for ever. `meta`, which says which
 * format the file is in, must be exactly the table every format defines. The other tables the
 * store reads must be plain tables, with no generated columns and no index on an expression or
 * with a condition, whose SQL would run as they are read; a file of a newer format may have no
 * views or triggers either. An older or the current format's whole schema is compared once `meta`
 * is read.
 */
function checkTablesBeforeReading(db: Database.Database, schema: readonly string[]): void {
  const parse = (line: string) => schemaRowSchema.parse(JSON.parse(line));
  const rows = schema.map(parse);
  // Names are unique in `sqlite_schema`, so there is one `meta` line at most in each.
  const meta = schema[rows.findIndex((row) => row.name === "meta")];
  const expectedMeta = getExpectedSchema(FORMAT_VERSION)?.find(
    (line) => parse(line).name === "meta",
  );
  const refuse = (message: string) => {
    throw new ProjectFileError("unexpected-schema", message);
  };
  if (meta === undefined || meta !== expectedMeta) {
    refuse("The project's metadata table is not the one every format has");
  }
  for (const name of READ_TABLES) {
    const row = rows.find((each) => each.name === name);
    if (row === undefined || row.type !== "table" || !/^CREATE TABLE /.test(row.sql ?? "")) {
      refuse(`The project's ${name} is not a plain table`);
    }
    // These read only what SQLite parsed from `sqlite_schema`: none of the file's SQL runs.
    const generated = z
      .array(z.object({ hidden: z.number() }))
      .parse(db.pragma(`table_xinfo(${name})`))
      .some((column) => column.hidden >= 2);
    const computedIndex = z
      .array(z.object({ name: z.string(), partial: z.number() }))
      .parse(db.pragma(`index_list(${name})`))
      .some(
        (index) =>
          index.partial !== 0 ||
          // The index's name is the file's: bound, never written into the SQL.
          z
            .array(z.object({ cid: z.number() }))
            .parse(db.prepare("SELECT cid FROM pragma_index_xinfo(?)").all(index.name))
            .some((column) => column.cid === -2),
      );
    if (generated || computedIndex) {
      refuse(`The project's ${name} has columns or indexes of its own SQL`);
    }
  }
  if (rows.some((row) => row.type === "view" || row.type === "trigger")) {
    refuse("The project has views or triggers");
  }
}

/** Whether `schema` is exactly what format `version` has. */
function isSchemaOf(schema: readonly string[], version: number): boolean {
  const expected = getExpectedSchema(version);
  return (
    expected !== undefined &&
    schema.length === expected.length &&
    schema.every((row, index) => row === expected[index])
  );
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
 * an older format must have exactly that format's tables; a newer one only needs the metadata and
 * plain tables to read, with no views or triggers, since a newer Webforge may have added tables.
 * It is then only ever opened read-only. No SQL of the file's runs before its tables are checked.
 */
function validateProject(db: Database.Database): ValidatedProject {
  if (db.pragma("application_id", { simple: true }) !== APPLICATION_ID) {
    throw new ProjectFileError("not-a-project", "The database is not a Webforge project");
  }
  // Its tables first, from SQLite's own record of them: nothing of the file's runs (S4).
  const schema = readSchema(db);
  checkTablesBeforeReading(db, schema);
  // quick_check runs the tables' CHECK constraints, so only a schema this build writes, all of
  // whose SQL is its own, is checked so. A file of a newer format opens read-only, and only its
  // tables' named columns are read.
  if (Object.keys(SCHEMAS).some((version) => isSchemaOf(schema, Number(version)))) {
    const check = db.pragma("quick_check", { simple: true });
    if (check !== "ok") {
      throw new ProjectFileError("corrupt", "The project fails SQLite's integrity check");
    }
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
    if (!version.success || !isSchemaOf(schema, version.data)) {
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
  // A torn copy can pass quick_check (#295). A newer format's tables are its own to check.
  if (!newerFormat) {
    checkContent(db);
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
 * Brings an older file's tables up to {@link FORMAT_VERSION}, one format at a time, inside the
 * transaction of the first write to it (see `ProjectStore.#write`): after a crash the file is
 * either fully migrated, with that write, or untouched.
 */
function migrateSchema(db: Database.Database, from: number): void {
  for (let version = from; version < FORMAT_VERSION; version += 1) {
    const step = SCHEMA_MIGRATIONS[version];
    if (step === undefined) {
      throw new ProjectFileError("unexpected-schema", `No migration from format ${version}`);
    }
    for (const statement of step) {
      db.exec(statement);
    }
  }
  db.prepare("UPDATE meta SET value = ? WHERE key = 'format_version'").run(String(FORMAT_VERSION));
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
  #info: ProjectInfo;
  /** Prepared statements by SQL text, compiled once per connection. */
  readonly #statements = new Map<string, Database.Statement>();
  /**
   * An older format's site as {@link readSite} migrated it, not written yet: reading never changes
   * the file (R14), so a site opened and closed unedited stays as it was. The first write saves it.
   */
  #unsavedMigration: SiteDoc | undefined;

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
      const db = connect(tempPath, { create: true });
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
          stampContent(db);
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
   * An older format is read as it is, and migrated to {@link FORMAT_VERSION} by the first write
   * (never when opened read-only), so a file opened and closed unedited stays as it was (R14). A
   * file from a newer Webforge opens read-only, with `info.newerFormat` set, instead of failing.
   */
  static open(path: string, options: OpenProjectOptions = {}): ProjectStore {
    if (!existsSync(path)) {
      throw new ProjectFileError("not-found", "The project file does not exist");
    }
    const readOnly = options.readOnly === true;
    const db = connect(path, { readOnly });
    try {
      const validated = validateProject(db);
      if (validated.newerFormat && !readOnly) {
        db.close();
        return ProjectStore.open(path, { readOnly: true });
      }
      if (readOnly) {
        return new ProjectStore(db, { ...validated, readOnly });
      }
      configureWrites(db);
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
   * The site in the working copy, migrated to the current site format and validated. Reading never
   * writes: a site saved in an older format stays as it is on disk until the next commit, which
   * writes the migrated site with its changes, so opening and closing an old site leaves its file
   * unchanged and its documents never mix formats. Throws `SiteFormatError` from
   * `@webforge/model` for an invalid site or a newer site format.
   */
  readSite(): SiteDoc {
    const raw = siteFromDocuments(this.readDocuments());
    const site = migrateSite(raw);
    const storedVersion = (raw as { formatVersion?: unknown }).formatVersion;
    // Migrated in memory only: the next commit writes it, with its changes (see #unsavedMigration).
    this.#unsavedMigration =
      storedVersion !== site.formatVersion && !this.#info.readOnly ? site : undefined;
    return site;
  }

  /**
   * Writes a whole site in one transaction, e.g. a new or migrated one, and deletes the documents
   * of pages it no longer has. Saving edits uses {@link commit} with only the changed documents.
   */
  saveSite(site: SiteDoc): void {
    this.#assertWritable();
    // A whole site replaces whatever migration was waiting to be written.
    this.#unsavedMigration = undefined;
    this.commit(this.#siteChanges(site));
  }

  /** The changes that make the working copy `site`: its documents, without pages it no longer has. */
  #siteChanges(site: SiteDoc): DocumentChange[] {
    const keep = new Set(site.pageOrder.map(pageDocumentId));
    const stalePages = this.#prepare("SELECT id FROM documents WHERE kind = 'page'")
      .pluck()
      .all()
      .map(String)
      .filter((id) => !keep.has(id));
    return [
      ...siteDocuments(site).map((document) => ({ type: "put" as const, ...document })),
      ...stalePages.map((id) => ({ type: "delete" as const, id })),
    ];
  }

  /**
   * Applies `changes` to the working copy in one transaction: after a crash the file holds either
   * all of them or none. When this returns, the changes are on disk. The first commit after
   * {@link readSite} migrated an older format writes the migrated site too, in the same
   * transaction, so the file never holds documents of two formats.
   */
  commit(changes: readonly DocumentChange[]): void {
    const migrated = this.#unsavedMigration;
    if (migrated !== undefined) {
      this.#commit([...this.#siteChanges(migrated), ...changes]);
      this.#unsavedMigration = undefined;
      return;
    }
    this.#commit(changes);
  }

  #commit(changes: readonly DocumentChange[]): void {
    const upsert = this.#prepare(
      `INSERT INTO documents (id, kind, blob_hash) VALUES (?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, blob_hash = excluded.blob_hash`,
    );
    const remove = this.#prepare("DELETE FROM documents WHERE id = ?");
    this.#write(() => {
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
    });
  }

  /**
   * Stores binary data, such as an image, and returns its SHA-256 hash. Storing the same bytes
   * again reuses the existing blob.
   */
  putBlob(data: Uint8Array, mime: string): string {
    return this.#write(() => this.#insertBlob(data, mime));
  }

  /** Whether a blob is stored under `hash`, without reading it. */
  hasBlob(hash: string): boolean {
    return this.#prepare("SELECT 1 FROM blobs WHERE hash = ?").get(hash) !== undefined;
  }

  /** The blob stored under `hash`, or `undefined` if there is none. */
  readBlob(hash: string): StoredBlob | undefined {
    const row = this.#prepare("SELECT mime, data FROM blobs WHERE hash = ?").get(hash);
    return row === undefined ? undefined : blobRowSchema.parse(row);
  }

  /**
   * The working copy's documents as a version would hold them: each one's id, kind and blob,
   * sorted by id. {@link saveVersion} saves them later, as long as the site stays open: garbage
   * collection runs only as it closes, so their blobs stay in the file until then.
   */
  readManifest(): VersionManifest {
    return this.#prepare("SELECT id, kind, blob_hash AS hash FROM documents ORDER BY id")
      .all()
      .map((row) => documentRowSchema.parse(row));
  }

  /**
   * Saves the working copy as a version, or the documents {@link readManifest} read earlier.
   * Versions share unchanged content with the working copy and with each other, so saving one
   * only writes a small manifest. Throws when a document's blob has gone from the file.
   */
  saveVersion(name: string, reason: VersionReason, options: SaveVersionOptions = {}): VersionInfo {
    const documents = options.documents ?? this.readManifest();
    if (documents.some(({ hash }) => !this.hasBlob(hash))) {
      throw new Error("A document of the version is no longer in the file");
    }
    const site = documents.find(({ id }) => id === "site");
    const version: VersionInfo = {
      id: randomUUID(),
      name,
      kind: kindOf(reason),
      reason,
      createdAt: new Date().toISOString(),
      siteFormat: siteFormatOf(
        site === undefined ? [] : [{ id: site.id, content: this.#readJsonBlob(site.hash) }],
      ),
      thumbnailHash: options.thumbnailHash,
      publishedTo: options.publishedTo,
    };
    this.#write(() => this.#insertVersion(version, documents));
    return version;
  }

  /**
   * Adds a saved version as it was in another project, with its own id, name, reason and time and
   * its documents: a version brought in from a site's ZIP (4.7). It goes after the versions this
   * project has, so add them oldest first.
   */
  addVersion(
    version: NewVersion,
    documents: readonly { readonly id: string; readonly kind: string; readonly content: unknown }[],
  ): void {
    this.#write(() => {
      // Sorted by id, as readManifest lists them.
      const manifest: VersionManifest = [...documents]
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(({ id, kind, content }) => ({
          id,
          kind,
          hash: this.#insertBlob(Buffer.from(JSON.stringify(content), "utf8"), JSON_MIME),
        }));
      this.#insertVersion(
        {
          ...version,
          kind: kindOf(version.reason),
          siteFormat: siteFormatOf(documents),
          thumbnailHash: undefined,
          publishedTo: undefined,
        },
        manifest,
      );
    });
  }

  #insertVersion(version: VersionInfo, documents: VersionManifest): void {
    this.#prepare(
      `INSERT INTO versions (id, name, kind, created_at, format_version, manifest, reason,
         site_format, thumbnail_hash, published_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      version.id,
      version.name,
      version.kind,
      version.createdAt,
      FORMAT_VERSION,
      JSON.stringify({ documents }),
      version.reason,
      version.siteFormat,
      version.thumbnailHash ?? null,
      version.publishedTo === undefined
        ? null
        : JSON.stringify(versionPublishSchema.parse(version.publishedTo)),
    );
  }

  /**
   * Records where version `id` was published and what the live check found (ADR 0018 §3), as a
   * republish of it finishes. Gives whether there is such a version.
   */
  recordPublish(id: string, publishedTo: VersionPublish): boolean {
    const text = JSON.stringify(versionPublishSchema.parse(publishedTo));
    return this.#write(
      () =>
        this.#prepare("UPDATE versions SET published_to = ? WHERE id = ?").run(text, id).changes >
        0,
    );
  }

  /**
   * Deletes version `id`, and gives whether there was one. The space it alone kept is freed once
   * the site closes and its file is cleaned up.
   */
  deleteVersion(id: string): boolean {
    return this.#write(
      () => this.#prepare("DELETE FROM versions WHERE id = ?").run(id).changes > 0,
    );
  }

  /**
   * Deletes all but the newest `keep` of the versions Webforge saved (P3), and gives how many it
   * deleted. The person's own versions are never deleted.
   */
  pruneAutoVersions(keep: number): number {
    const kept = z.int().nonnegative().parse(keep);
    return this.#write(
      () =>
        this.#prepare(
          `DELETE FROM versions WHERE kind = 'auto' AND rowid NOT IN (
             SELECT rowid FROM versions WHERE kind = 'auto' ORDER BY rowid DESC LIMIT ?
           )`,
        ).run(kept).changes,
    );
  }

  /** How much of the file the versions take, all of them and each alone (4.6). */
  versionSpace(): VersionSpace {
    return versionSpace(this.#db);
  }

  /** Saved versions, newest first. */
  listVersions(): VersionInfo[] {
    return this.#prepare(
      `SELECT ${VERSION_COLUMNS(this.#info.formatVersion)} FROM versions AS versions_v1
       ORDER BY rowid DESC`,
    )
      .all()
      .map(toVersionInfo);
  }

  /** The documents of a saved version sorted by id, or `undefined` if there is no such version. */
  readVersion(id: string): StoredDocument[] | undefined {
    const row = this.#prepare("SELECT manifest FROM versions WHERE id = ?").get(id);
    if (row === undefined) {
      return undefined;
    }
    const { manifest } = z.object({ manifest: z.string() }).parse(row);
    return parseManifest(manifest).documents.map(({ id: documentId, kind, hash }) => ({
      id: documentId,
      kind,
      content: this.#readJsonBlob(hash),
    }));
  }

  /**
   * The site saved as version `id`, migrated to the current site format and validated as
   * {@link readSite}'s is, or `undefined` if there is no such version: what Restore and Republish
   * (4.6) take. Throws `SiteFormatError` from `@webforge/model` for an invalid site or a newer
   * site format.
   */
  readVersionSite(id: string): SiteDoc | undefined {
    const documents = this.readVersion(id);
    return documents === undefined ? undefined : migrateSite(siteFromDocuments(documents));
  }

  /**
   * Stores an imported file's original bytes, unmodified (X2), and records it as a Media item's
   * asset, in one transaction. Importing the same bytes again reuses the blob; a new `mediaId`
   * row points at it. Replacing an item's file gives its `mediaId` a new blob.
   */
  putAsset(asset: NewAsset): AssetInfo {
    return this.#write(() => {
      const hash = this.#insertBlob(asset.data, asset.mime);
      this.#prepare(UPSERT_ASSET).run(
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
    });
  }

  /** The asset of a Media item, or `undefined` if none was imported under this id. */
  readAsset(mediaId: string): AssetInfo | undefined {
    const row = this.#prepare(`SELECT ${ASSET_COLUMNS} FROM assets WHERE media_id = ?`).get(
      mediaId,
    );
    return row === undefined ? undefined : toAssetInfo(row);
  }

  /** Every asset, sorted by media id. */
  listAssets(): AssetInfo[] {
    return this.#prepare(`SELECT ${ASSET_COLUMNS} FROM assets ORDER BY media_id`)
      .all()
      .map(toAssetInfo);
  }

  /**
   * Deletes blobs nothing refers to any more, and the assets that point at them (06: "garbage
   * collection"). A blob is kept when the working copy or any version stores a document in it, a
   * hash in such a document names it (media metadata), or it is a version's picture.
   *
   * Run it only when no undo step can bring a reference back: when a site is opened, before any
   * editing, or when it is closed, after the last save. A deleted image stays restorable by Undo
   * until then. Freed pages are reused by later writes; the file does not shrink until a VACUUM.
   * The app cleans a site's file up as it closes, on the storage writer's connection
   * (`SiteFileWriter.cleanUp`, ADR 0013).
   *
   * With nothing to remove it writes nothing (see `#write`): the file's bytes and modified time
   * stay as they were, so a site opened and closed unchanged isn't synced or backed up again.
   */
  collectGarbage(): GarbageReport {
    return this.#write(() => collectGarbage(this.#db));
  }

  /**
   * Copies the project to `path` with SQLite's online backup API (06: "Backups"): a consistent
   * copy even while the site is being edited, written in steps so the main process stays
   * responsive. The copy is built under a temporary name and renamed into place, so `path` never
   * holds half a backup.
   *
   * The copy is read through a connection of its own, so this store can be closed (another site
   * opened, the app quit) while a backup is still running.
   */
  async backupTo(path: string): Promise<void> {
    const tempPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    const source = connect(this.#db.name, { readOnly: true });
    try {
      await source.backup(tempPath);
      renameSync(tempPath, path);
    } catch (error) {
      rmSync(tempPath, { force: true });
      throw error;
    } finally {
      source.close();
    }
  }

  /** The editor's mode for this site; Design until someone switches it. */
  readEditorMode(): SiteEditorMode {
    const row = this.#prepare("SELECT value FROM meta WHERE key = 'editor_mode'").get() as
      | { value: unknown }
      | undefined;
    const mode = siteEditorModeSchema.safeParse(row?.value);
    return mode.success ? mode.data : "design";
  }

  /** Remembers the editor's mode for this site. */
  writeEditorMode(mode: SiteEditorMode): void {
    this.#write(() => {
      this.#prepare(
        `INSERT INTO meta (key, value) VALUES ('editor_mode', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      ).run(siteEditorModeSchema.parse(mode));
    });
  }

  /** What the person last chose when exporting this site; the defaults until then. */
  readExportChoices(): ExportChoices {
    const row = this.#prepare("SELECT value FROM meta WHERE key = 'export_choices'").get() as
      | { value: unknown }
      | undefined;
    let stored: unknown;
    try {
      stored = typeof row?.value === "string" ? JSON.parse(row.value) : undefined;
    } catch {
      stored = undefined;
    }
    const choices = exportChoicesSchema.safeParse(stored);
    return choices.success ? choices.data : DEFAULT_EXPORT_CHOICES;
  }

  /** Remembers what the person chose when exporting this site. */
  writeExportChoices(choices: ExportChoices): void {
    const value = JSON.stringify(exportChoicesSchema.parse(choices));
    this.#write(() => {
      this.#prepare(
        `INSERT INTO meta (key, value) VALUES ('export_choices', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      ).run(value);
    });
  }

  /** What the person ignored in Site Check (3.6), by finding; nothing until then. */
  readSiteCheckIgnored(): string[] {
    const row = this.#prepare("SELECT value FROM meta WHERE key = 'site_check_ignored'").get() as
      | { value: unknown }
      | undefined;
    let stored: unknown;
    try {
      stored = typeof row?.value === "string" ? JSON.parse(row.value) : undefined;
    } catch {
      stored = undefined;
    }
    const ignored = siteCheckIgnoredSchema.safeParse(stored);
    return ignored.success ? ignored.data : [];
  }

  /** Remembers what the person ignored in Site Check, replacing what was remembered. */
  writeSiteCheckIgnored(ignored: readonly string[]): void {
    const value = JSON.stringify(siteCheckIgnoredSchema.parse(ignored));
    this.#write(() => {
      this.#prepare(
        `INSERT INTO meta (key, value) VALUES ('site_check_ignored', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      ).run(value);
    });
  }

  /** Closes the file. With the rollback journal, no side files are left next to it. */
  close(): void {
    this.#db.close();
  }

  /**
   * Runs `change` as one write: refused on a read-only project, in one transaction, which records
   * the content fingerprint (#295) before it commits, if it changed a row (`stamped`). Every write
   * goes through here, so none can leave a fingerprint that no longer matches its rows and make a
   * healthy file open as corrupt; `test/write-paths.test.ts` keeps it that way.
   *
   * The first write to a file of an older format migrates its tables first, in the same
   * transaction, as the first commit writes a migrated site (ADR 0012, decision 5).
   */
  #write<T>(change: () => T): T {
    this.#assertWritable();
    const from = this.#info.formatVersion;
    const result = stamped(this.#db, () => {
      if (from < FORMAT_VERSION) migrateSchema(this.#db, from);
      return change();
    });
    if (from < FORMAT_VERSION) this.#info = { ...this.#info, formatVersion: FORMAT_VERSION };
    return result;
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
    this.#prepare(INSERT_BLOB).run(hash, mime, data.byteLength, data);
    return hash;
  }

  #readJsonBlob(hash: string): JsonValue {
    return parseDocument(this.#readJsonText(hash));
  }

  /** A document's blob as text, unparsed. */
  #readJsonText(hash: string): string {
    return decodeDocument(this.readBlob(hash)?.data);
  }
}
