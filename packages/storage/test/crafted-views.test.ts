import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { ProjectFileError, type ProjectFileErrorCode, ProjectStore } from "../src/index.js";
import { SCHEMAS } from "../src/schema.js";

// A crafted file's views and triggers (security review S4, #651): opening a file runs none of its
// SQL before its tables are checked, whatever format it claims. From the review's `files-1`.

const tempDir = tempDirFactory();

function createProject(): string {
  const path = join(tempDir(), "site.wforge");
  ProjectStore.create(path, { name: "Rosa's Bakery" }).close();
  return path;
}

function tamper(path: string, change: (db: Database.Database) => void): void {
  const db = new Database(path);
  try {
    change(db);
  } finally {
    db.close();
  }
}

function openResult(path: string): ProjectFileErrorCode | "opened" {
  try {
    ProjectStore.open(path).close();
    return "opened";
  } catch (error) {
    if (error instanceof ProjectFileError) {
      return error.code;
    }
    throw error;
  }
}

describe("a crafted file's views and triggers (S4)", () => {
  it("refuses a meta view without running it", () => {
    const path = createProject();
    tamper(path, (db) =>
      db.exec(`DROP TABLE meta;
        CREATE VIEW meta AS WITH RECURSIVE c(x) AS
          (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 30000000)
        SELECT 'k' AS key, 'v' AS value FROM c WHERE x < 0`),
    );
    const start = performance.now();
    const result = openResult(path);
    const elapsed = performance.now() - start;
    expect(result).toBe("unexpected-schema");
    expect(elapsed).toBeLessThan(500);
  }, 60_000);

  it("refuses a newer-format file whose documents table is a view", () => {
    const path = createProject();
    tamper(path, (db) =>
      db.exec(`UPDATE meta SET value = '99' WHERE key = 'format_version';
        DROP TABLE documents;
        CREATE VIEW documents AS SELECT 1 AS id`),
    );
    expect(openResult(path)).not.toBe("opened");
  });

  it("refuses a newer-format file with a trigger, or whose blobs or assets are views", () => {
    for (const change of [
      "CREATE TRIGGER sneaky AFTER INSERT ON documents BEGIN SELECT 1; END",
      "DROP TABLE assets; CREATE VIEW assets AS SELECT 1 AS media_id",
      "CREATE VIEW extra AS SELECT 1",
    ]) {
      const path = createProject();
      tamper(path, (db) =>
        db.exec(`UPDATE meta SET value = '99' WHERE key = 'format_version'; ${change}`),
      );
      expect(openResult(path), change).toBe("unexpected-schema");
    }
  });

  it("still opens a newer-format file with a table of its own, read-only", () => {
    const path = createProject();
    tamper(path, (db) =>
      db.exec(`UPDATE meta SET value = '99' WHERE key = 'format_version';
        CREATE TABLE later (id TEXT PRIMARY KEY NOT NULL) STRICT`),
    );
    const store = ProjectStore.open(path);
    expect(store.info).toMatchObject({ newerFormat: true, readOnly: true });
    store.close();
  });

  it("defines meta the same way in every format, since it is checked first", () => {
    const metaOf = (statements: readonly string[]) =>
      statements.find((statement) => statement.startsWith("CREATE TABLE meta"));
    const first = metaOf(SCHEMAS[1] ?? []);
    expect(first).toBeDefined();
    for (const statements of Object.values(SCHEMAS)) expect(metaOf(statements)).toBe(first);
  });
});
