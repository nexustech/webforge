import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";

// Pretends this build writes format 2, which adds a table to format 1, so the open-time migration
// path runs before any real format 2 exists.
vi.mock("../src/schema.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/schema.js")>();
  const v1 = actual.SCHEMAS[1] ?? [];
  const added = "CREATE TABLE added_in_v2 (\n  x INTEGER\n) STRICT";
  return {
    ...actual,
    FORMAT_VERSION: 2,
    SCHEMA: [...v1, added],
    SCHEMAS: { 1: v1, 2: [...v1, added] },
    SCHEMA_MIGRATIONS: { 1: [added] },
  };
});

const { ProjectStore } = await import("../src/index.js");

const tempDir = tempDirFactory();

/** A format 1 file, made by writing the version-1 tables by hand. */
async function formatOneProject(): Promise<string> {
  const { APPLICATION_ID, SCHEMAS } =
    await vi.importActual<typeof import("../src/schema.js")>("../src/schema.js");
  const path = join(tempDir(), "old.wforge");
  const db = new Database(path);
  db.pragma(`application_id = ${APPLICATION_ID}`);
  for (const statement of SCHEMAS[1] ?? []) db.exec(statement);
  const insert = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  insert.run("format_version", "1");
  insert.run("project_id", "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10");
  insert.run("name", "Old site");
  insert.run("created_at", "2026-10-20T10:00:00.000Z");
  db.close();
  return path;
}

describe("open-time schema migration", () => {
  it("migrates an older file to the current format when opened for writing", async () => {
    const path = await formatOneProject();

    const store = ProjectStore.open(path);
    expect(store.info).toMatchObject({ formatVersion: 2, readOnly: false, newerFormat: false });
    store.close();

    const db = new Database(path, { readonly: true });
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE name = 'added_in_v2'").get()).toEqual({
      name: "added_in_v2",
    });
    db.close();
  });

  it("leaves an older file untouched when opened read-only", async () => {
    const path = await formatOneProject();

    const store = ProjectStore.open(path, { readOnly: true });
    expect(store.info).toMatchObject({ formatVersion: 1, readOnly: true });
    store.close();

    const db = new Database(path, { readonly: true });
    expect(db.prepare("SELECT value FROM meta WHERE key = 'format_version'").pluck().get()).toBe(
      "1",
    );
    db.close();
  });
});
