import { randomUUID } from "node:crypto";
import { renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { configureWrites, connect } from "./connection.js";
import { stampContent } from "./content-check.js";
import { APPLICATION_ID, FORMAT_VERSION, SCHEMA } from "./schema.js";
import type { CreateStepTimer } from "./store-types.js";

/** Each step run as it is, untimed. */
const untimed: CreateStepTimer = (_step, run) => run();

/** A temporary name beside `path`, hidden, for a file written there before it's renamed into place. */
const tempPathFor = (path: string) => join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);

/**
 * Writes `path` with `write`, under a temporary name beside it renamed into place once written, so
 * `path` never holds half a file: a backup (`ProjectStore.backupTo`).
 */
export async function writeInPlace(
  path: string,
  write: (tempPath: string) => Promise<unknown>,
): Promise<void> {
  const tempPath = tempPathFor(path);
  try {
    await write(tempPath);
    renameSync(tempPath, path);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

/**
 * Writes a new, empty project named `name` at `path`, replacing any file there (#986, out of
 * `ProjectStore.create`). It's built under a temporary name next to `path` and renamed into place,
 * so a crash never leaves a half-created project.
 */
export function createProjectFile(
  path: string,
  name: string,
  timed: CreateStepTimer = untimed,
): void {
  const tempPath = tempPathFor(path);
  try {
    const db = timed("make the file", () => {
      // In parts (#1625): opening creates the file; setting its id is its first write, with the
      // flush SQLite does by default; then how its later writes are made.
      const made = timed("make the file: open it", () => connect(tempPath, { create: true }));
      try {
        timed("make the file: its first write", () =>
          made.pragma(`application_id = ${APPLICATION_ID}`),
        );
        timed("make the file: how it writes", () => configureWrites(made));
      } catch (error) {
        made.close();
        throw error;
      }
      return made;
    });
    try {
      const meta = {
        format_version: String(FORMAT_VERSION),
        project_id: randomUUID(),
        name: name,
        created_at: new Date().toISOString(),
      };
      // The file's first commit: its schema, written with `synchronous = FULL` (#1560).
      timed("first commit", () =>
        db.transaction(() => {
          for (const statement of SCHEMA) {
            db.exec(statement);
          }
          const insert = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
          for (const [key, value] of Object.entries(meta)) {
            insert.run(key, value);
          }
          stampContent(db);
        })(),
      );
    } finally {
      db.close();
    }
    timed("move into place", () => renameSync(tempPath, path));
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}
