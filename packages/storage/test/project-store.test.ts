import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  APPLICATION_ID,
  FORMAT_VERSION,
  ProjectFileError,
  type ProjectFileErrorCode,
  ProjectStore,
} from "../src/index.js";
import { tempDirFactory } from "./support/temp-dir.js";

const tempDir = tempDirFactory();

function newProjectPath(): string {
  return join(tempDir(), "site.wforge");
}

function createProject(path = newProjectPath()): string {
  ProjectStore.create(path, { name: "Rosa's Bakery" }).close();
  return path;
}

/** Changes a closed project with a raw connection, as another program could. */
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

function blobCount(path: string): number {
  const db = new Database(path, { readonly: true });
  try {
    return Number(db.prepare("SELECT count(*) FROM blobs").pluck().get());
  } finally {
    db.close();
  }
}

describe("ProjectStore.create", () => {
  it("creates an empty project that opens with its metadata", () => {
    const path = newProjectPath();
    const created = ProjectStore.create(path, { name: "Rosa's Bakery" });
    const info = created.info;
    created.close();

    const store = ProjectStore.open(path);
    expect(store.info).toEqual(info);
    expect(info.name).toBe("Rosa's Bakery");
    expect(info.formatVersion).toBe(FORMAT_VERSION);
    expect(info.projectId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(info.createdAt)).not.toBeNaN();
    expect(store.readDocuments()).toEqual([]);
    expect(store.listVersions()).toEqual([]);
    store.close();
  });

  it("marks the file with the Webforge application id and the rollback journal", () => {
    const path = createProject();
    const db = new Database(path, { readonly: true });
    expect(db.pragma("application_id", { simple: true })).toBe(APPLICATION_ID);
    expect(db.pragma("journal_mode", { simple: true })).toBe("delete");
    db.close();
  });

  it("replaces an existing file and leaves no temporary files", () => {
    const path = newProjectPath();
    writeFileSync(path, "old content");

    createProject(path);

    expect(openResult(path)).toBe("opened");
    expect(readdirSync(join(path, ".."))).toEqual(["site.wforge"]);
  });

  it("cleans up when the project cannot be written", () => {
    const dir = tempDir();
    const path = join(dir, "missing-folder", "site.wforge");

    expect(() => ProjectStore.create(path, { name: "Site" })).toThrow();
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe("ProjectStore documents", () => {
  it("commits puts and deletes and reads them back after reopening", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    store.commit([
      { type: "put", id: "page:home", kind: "page", content: { title: "Home", sections: [] } },
      { type: "put", id: "page:about", kind: "page", content: { title: "About" } },
      { type: "put", id: "theme", kind: "theme", content: { primary: "#c0ffee" } },
    ]);
    store.commit([
      { type: "put", id: "page:home", kind: "page", content: { title: "Welcome" } },
      { type: "delete", id: "page:about" },
    ]);
    store.close();

    const reopened = ProjectStore.open(path);
    expect(reopened.readDocuments()).toEqual([
      { id: "page:home", kind: "page", content: { title: "Welcome" } },
      { id: "theme", kind: "theme", content: { primary: "#c0ffee" } },
    ]);
    expect(reopened.readDocument("page:home")?.content).toEqual({ title: "Welcome" });
    expect(reopened.readDocument("page:about")).toBeUndefined();
    reopened.close();
  });

  it("applies all changes of a commit or none", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    store.commit([{ type: "put", id: "page:home", kind: "page", content: { title: "Home" } }]);

    // A value JSON cannot represent makes the second change throw half-way through the commit.
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() =>
      store.commit([
        { type: "put", id: "page:home", kind: "page", content: { title: "Changed" } },
        { type: "put", id: "page:bad", kind: "page", content: cyclic as never },
      ]),
    ).toThrow();

    expect(store.readDocuments()).toEqual([
      { id: "page:home", kind: "page", content: { title: "Home" } },
    ]);
    store.close();
  });

  it("stores identical content once", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    store.commit([
      { type: "put", id: "page:a", kind: "page", content: { same: true } },
      { type: "put", id: "page:b", kind: "page", content: { same: true } },
    ]);
    store.close();

    expect(blobCount(path)).toBe(1);
  });

  it("leaves no side files next to the project between commits", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    store.commit([{ type: "put", id: "page:home", kind: "page", content: {} }]);

    expect(readdirSync(join(path, ".."))).toEqual(["site.wforge"]);
    store.close();
  });
});

describe("ProjectStore blobs", () => {
  it("stores binary data once, under the SHA-256 hash of its bytes", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]);

    const hash = store.putBlob(bytes, "image/png");
    expect(hash).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(store.putBlob(bytes, "image/png")).toBe(hash);
    store.close();

    const reopened = ProjectStore.open(path);
    const blob = reopened.readBlob(hash);
    expect(blob?.mime).toBe("image/png");
    expect(Array.from(blob?.data ?? [])).toEqual(Array.from(bytes));
    expect(reopened.readBlob("0".repeat(64))).toBeUndefined();
    reopened.close();
    expect(blobCount(path)).toBe(1);
  });
});

describe("ProjectStore versions", () => {
  it("saves versions that keep the documents as they were", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    store.commit([{ type: "put", id: "page:home", kind: "page", content: { title: "One" } }]);
    const first = store.saveVersion("Before redesign", "manual");
    store.commit([
      { type: "put", id: "page:new", kind: "page", content: { title: "New" } },
      { type: "put", id: "page:home", kind: "page", content: { title: "Two" } },
    ]);
    const second = store.saveVersion("Daily", "auto");
    store.close();

    const reopened = ProjectStore.open(path);
    expect(reopened.listVersions()).toEqual([second, first]);
    expect(first).toMatchObject({ name: "Before redesign", kind: "manual" });
    expect(reopened.readVersion(first.id)).toEqual([
      { id: "page:home", kind: "page", content: { title: "One" } },
    ]);
    expect(reopened.readVersion(second.id)).toEqual([
      { id: "page:home", kind: "page", content: { title: "Two" } },
      { id: "page:new", kind: "page", content: { title: "New" } },
    ]);
    expect(reopened.readVersion("no-such-version")).toBeUndefined();
    reopened.close();
  });

  it("keeps any document id and the working copy's order in versions", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    // "__proto__" must stay an ordinary key; "～" (U+FF5E) sorts before "😀" as UTF-8 bytes but
    // after it as UTF-16 code units.
    store.commit(
      ["page:😀", "__proto__", "page:～", "10", "9"].map((id) => ({
        type: "put" as const,
        id,
        kind: "page",
        content: { id },
      })),
    );
    const version = store.saveVersion("All ids", "manual");

    expect(store.readVersion(version.id)).toEqual(store.readDocuments());
    expect(store.readDocuments().map((document) => document.id)).toEqual([
      "10",
      "9",
      "__proto__",
      "page:～",
      "page:😀",
    ]);
    store.close();
  });

  it("shares unchanged content between versions", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    store.commit([
      { type: "put", id: "page:home", kind: "page", content: { body: "x".repeat(100_000) } },
    ]);
    for (let i = 0; i < 20; i += 1) {
      store.saveVersion(`Version ${i}`, "auto");
    }
    store.close();

    expect(blobCount(path)).toBe(1);
  });

  it("rejects a version whose manifest was tampered with", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    const version = store.saveVersion("v", "manual");
    store.close();
    tamper(path, (db) => {
      db.prepare("UPDATE versions SET manifest = ? WHERE id = ?").run("{}", version.id);
    });

    const reopened = ProjectStore.open(path);
    expect(() => reopened.readVersion(version.id)).toThrow(ProjectFileError);
    reopened.close();
  });
});

describe("ProjectStore.open with untrusted files", () => {
  it("reports a missing file", () => {
    expect(openResult(join(tempDir(), "nothing-here.wforge"))).toBe("not-found");
  });

  it("rejects a file that is not a database", () => {
    const path = newProjectPath();
    writeFileSync(path, "This is a text file, not a project. ".repeat(100));
    expect(openResult(path)).toBe("not-a-project");
  });

  it("rejects an empty file and a database from another program", () => {
    const empty = newProjectPath();
    writeFileSync(empty, "");
    expect(openResult(empty)).toBe("not-a-project");

    const other = join(tempDir(), "other.wforge");
    tamper(other, (db) => db.exec("CREATE TABLE notes (text TEXT)"));
    expect(openResult(other)).toBe("not-a-project");
  });

  it("rejects a project with damaged pages", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    store.commit([
      { type: "put", id: "page:home", kind: "page", content: { body: "y".repeat(50_000) } },
    ]);
    store.close();
    const bytes = readFileSync(path);
    // Overwrite pages 3 to 6 with garbage; keep page 1 (header and schema) intact.
    const pageSize = bytes.readUInt16BE(16);
    bytes.fill(0xa5, pageSize * 2, pageSize * 6);
    writeFileSync(path, bytes);

    expect(openResult(path)).toBe("corrupt");
  });

  it("rejects extra triggers, views, tables and indexes", () => {
    for (const sql of [
      "CREATE TRIGGER evil AFTER INSERT ON documents BEGIN DELETE FROM blobs; END",
      "CREATE VIEW peek AS SELECT * FROM meta",
      "CREATE TABLE extra (x)",
      "CREATE INDEX documents_kind ON documents (kind)",
    ]) {
      const path = createProject();
      tamper(path, (db) => db.exec(sql));
      expect(openResult(path), sql).toBe("unexpected-schema");
    }
  });

  it("rejects a project without metadata", () => {
    const path = createProject();
    tamper(path, (db) => db.exec("DROP TABLE meta"));
    expect(openResult(path)).toBe("unexpected-schema");
  });

  it("rejects invalid or unknown metadata", () => {
    const badId = createProject();
    tamper(badId, (db) => db.exec("UPDATE meta SET value = 'not-a-uuid' WHERE key = 'project_id'"));
    expect(openResult(badId)).toBe("unexpected-schema");

    const extraKey = createProject();
    tamper(extraKey, (db) => db.exec("INSERT INTO meta VALUES ('surprise', 'value')"));
    expect(openResult(extraKey)).toBe("unexpected-schema");
  });

  it("asks for an update when the project comes from a newer Webforge", () => {
    const path = createProject();
    tamper(path, (db) => {
      db.exec("CREATE TABLE added_in_v2 (x)");
      db.prepare("UPDATE meta SET value = ? WHERE key = 'format_version'").run(
        String(FORMAT_VERSION + 1),
      );
    });
    expect(openResult(path)).toBe("newer-format");
  });

  it("rejects a document that points to a missing or invalid blob", () => {
    const missing = createProject();
    tamper(missing, (db) => {
      db.pragma("foreign_keys = OFF");
      db.prepare("INSERT INTO documents VALUES ('page:home', 'page', ?)").run("f".repeat(64));
    });
    const store = ProjectStore.open(missing);
    expect(() => store.readDocuments()).toThrow(ProjectFileError);
    store.close();

    const invalid = createProject();
    tamper(invalid, (db) => {
      db.prepare("INSERT INTO blobs VALUES (?, 'application/json', 3, ?)").run(
        "e".repeat(64),
        Buffer.from("{{{"),
      );
      db.prepare("INSERT INTO documents VALUES ('page:home', 'page', ?)").run("e".repeat(64));
    });
    const invalidStore = ProjectStore.open(invalid);
    expect(() => invalidStore.readDocument("page:home")).toThrow(ProjectFileError);
    invalidStore.close();
  });

  it("switches a project that another tool put in WAL mode back to the rollback journal", () => {
    const path = createProject();
    tamper(path, (db) => db.pragma("journal_mode = WAL"));

    const store = ProjectStore.open(path);
    store.commit([{ type: "put", id: "page:home", kind: "page", content: {} }]);
    store.close();

    expect(readdirSync(join(path, ".."))).toEqual(["site.wforge"]);
    const db = new Database(path, { readonly: true });
    expect(db.pragma("journal_mode", { simple: true })).toBe("delete");
    db.close();
  });

  it("relies on better-sqlite3 keeping SQLite's defensive mode on", () => {
    // Defensive mode stops SQL from corrupting the file (writable_schema, journal_mode=OFF…).
    // better-sqlite3 enables it by default; this guards against an upgrade changing that.
    const db = new Database(":memory:");
    db.exec("CREATE TABLE t (x)");
    db.pragma("writable_schema = ON");
    expect(() => db.exec("UPDATE sqlite_schema SET sql = 'CREATE TABLE t (y)'")).toThrow(
      /may not be modified/,
    );
    db.close();
  });
});
