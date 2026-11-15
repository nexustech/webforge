import Database from "better-sqlite3";
import { z } from "zod";
import { checkContent } from "./content-check.js";
import { ProjectFileError } from "./errors.js";
import { APPLICATION_ID, FORMAT_VERSION, SCHEMA_MIGRATIONS, SCHEMAS } from "./schema.js";

// Checking a project file before anything of it is read, and bringing an older format's tables up
// to date (#986, out of `project-store.ts`): every check runs before any SQL of the file's (S4).

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
  /** JSON, checked entry by entry when read (see `readPublishDestinations`), likewise. */
  publish_destinations: z.string().optional(),
  /** An ISO time, checked when read (see `readLastPublishedAt`), likewise. */
  last_published_at: z.string().optional(),
});

const schemaRowSchema = z.object({
  type: z.string(),
  name: z.string(),
  tbl_name: z.string(),
  sql: z.string().nullable(),
});

/**
 * `row`, read from the file, as `schema` takes it. A row the file holds in another shape (a version
 * whose kind isn't one, a blob that isn't bytes) is damage, reported as storage's own
 * {@link ProjectFileError} (#827, 5.6's fuzzing), as SQLite's own reports of damage are. Arguments
 * a caller passes are checked with `parse` as before: a wrong one is the caller's mistake.
 */
export function readRow<T>(schema: z.ZodType<T>, row: unknown): T {
  const parsed = schema.safeParse(row);
  if (!parsed.success) {
    throw new ProjectFileError("corrupt", "A row of the project isn't in the shape it should be", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/**
 * The file's `sqlite_schema`: its tables, indexes, views and triggers, each as one JSON line, in a
 * stable order for comparison. Reading it runs nothing stored in the file, so it is safe on any
 * file (S4). A row in another shape, its SQL stored as bytes say, is damage (#840).
 */
function readSchema(db: Database.Database): string[] {
  return db
    .prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name")
    .all()
    .map((row) => JSON.stringify(readRow(schemaRowSchema, row)));
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
    // These read only what SQLite parsed from `sqlite_schema`: none of the file's SQL runs. What
    // they report comes from the file too, so a row in another shape is damage (#840).
    const generated = readRow(
      z.array(z.object({ hidden: z.number() })),
      db.pragma(`table_xinfo(${name})`),
    ).some((column) => column.hidden >= 2);
    const computedIndex = readRow(
      z.array(z.object({ name: z.string(), partial: z.number() })),
      db.pragma(`index_list(${name})`),
    ).some(
      (index) =>
        index.partial !== 0 ||
        // The index's name is the file's: bound, never written into the SQL.
        readRow(
          z.array(z.object({ cid: z.number() })),
          db.prepare("SELECT cid FROM pragma_index_xinfo(?)").all(index.name),
        ).some((column) => column.cid === -2),
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
export function toProjectFileError(error: unknown): unknown {
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
  // A damaged header's schema format number, which SQLite reports as a plain error (5.6's fuzzing).
  if (
    code === "SQLITE_ERROR" &&
    error instanceof Error &&
    /unsupported file format/i.test(error.message)
  ) {
    return new ProjectFileError("corrupt", "SQLite can't read the database's schema format", {
      cause: error,
    });
  }
  return error;
}

function readMetaRows(db: Database.Database): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM meta").all();
  return Object.fromEntries(
    rows.map((row) => {
      const { key, value } = readRow(z.object({ key: z.string(), value: z.string() }), row);
      return [key, value];
    }),
  );
}

/** What {@link validateProject} learns about a file. */
export type ValidatedProject = {
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
  /** Saved by a newer Webforge (format above {@link FORMAT_VERSION}); the user should update. */
  readonly newerFormat: boolean;
};

/**
 * Checks that `db` is a Webforge project this build can open, and returns its metadata. A file of
 * an older format must have exactly that format's tables; a newer one only needs the metadata and
 * plain tables to read, with no views or triggers, since a newer Webforge may have added tables.
 * It is then only ever opened read-only. No SQL of the file's runs before its tables are checked.
 */
export function validateProject(db: Database.Database): ValidatedProject {
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
export function migrateSchema(db: Database.Database, from: number): void {
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
 * Makes every method of an open store report a damaged file as {@link ProjectFileError}, as `open` does
 * (#807, 5.6's fuzzing). SQLite finds most damage only when a read reaches the damaged page, long
 * after the file opened: a version's manifest, a blob, an asset. Each method is wrapped once, here,
 * so one added later is covered too (`ProjectStore`'s own, #986). Any other error is thrown as it was.
 */
export function reportDamageAsProjectFileError(store: { readonly prototype: object }): void {
  for (const name of Object.getOwnPropertyNames(store.prototype)) {
    const descriptor = Object.getOwnPropertyDescriptor(store.prototype, name);
    const method: unknown = descriptor?.value;
    if (name === "constructor" || typeof method !== "function") continue;
    Object.defineProperty(store.prototype, name, {
      ...descriptor,
      value: function (this: unknown, ...args: unknown[]): unknown {
        try {
          const result: unknown = method.apply(this, args);
          return result instanceof Promise
            ? result.catch((error: unknown) => {
                throw toProjectFileError(error);
              })
            : result;
        } catch (error) {
          throw toProjectFileError(error);
        }
      },
    });
  }
}
