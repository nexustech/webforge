import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_EXPORT_CHOICES, type ExportChoices } from "@webforge/model";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { hardenConnection } from "../src/connection.js";
import {
  APPLICATION_ID,
  FORMAT_VERSION,
  ProjectFileError,
  type ProjectFileErrorCode,
  ProjectStore,
  ReadOnlyProjectError,
} from "../src/index.js";

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
    const second = store.saveVersion("Daily", "daily");
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
      store.saveVersion(`Version ${i}`, "daily");
    }
    store.close();

    expect(blobCount(path)).toBe(1);
  });

  it("refuses to open a project whose version manifest was tampered with (#295)", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    const version = store.saveVersion("v", "manual");
    store.close();
    tamper(path, (db) => {
      db.prepare("UPDATE versions SET manifest = ? WHERE id = ?").run("{}", version.id);
    });

    expect(openResult(path)).toBe("corrupt");
  });
});

describe("ProjectStore versions in storage format 2 (#664)", () => {
  /** A site of one page, whose text is `text`, with an image `image` it names. */
  const page = (text: string, image?: string) => ({
    type: "put" as const,
    id: "page:home",
    kind: "page" as const,
    content: { title: text, ...(image === undefined ? {} : { image }) },
  });

  it("saves why, the site format, its picture and where it was published", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    store.commit([
      { type: "put", id: "site", kind: "site", content: { formatVersion: 9 } },
      page("One"),
    ]);
    const picture = store.putBlob(new Uint8Array([9, 9, 9]), "image/png");
    const published = {
      destinationId: "d1",
      publishedAt: "2026-11-01T10:00:00.000Z",
      check: "different" as const,
      deploy: "abc",
    };
    const version = store.saveVersion("Published", "on-publish", {
      thumbnailHash: picture,
      publishedTo: published,
    });
    store.close();

    const reopened = ProjectStore.open(path);
    expect(reopened.listVersions()).toEqual([
      {
        id: version.id,
        name: "Published",
        kind: "auto",
        reason: "on-publish",
        createdAt: version.createdAt,
        siteFormat: 9,
        thumbnailHash: picture,
        publishedTo: published,
      },
    ]);
    // Republished later: the last publish is the one it records.
    const again = { ...published, check: "live" as const };
    expect(reopened.recordPublish(version.id, again)).toBe(true);
    expect(reopened.recordPublish("no-such-version", again)).toBe(false);
    expect(reopened.listVersions()[0]?.publishedTo).toEqual(again);
    reopened.close();
  });

  it("saves the documents read earlier, not the working copy as it is now (ADR 0018 §3)", () => {
    const store = ProjectStore.open(createProject());
    store.commit([page("As built")]);
    const built = store.readManifest();
    store.commit([page("Edited during the publish")]);

    const version = store.saveVersion("Published", "on-publish", { documents: built });

    expect(store.readVersion(version.id)).toEqual([
      { id: "page:home", kind: "page", content: { title: "As built" } },
    ]);
    expect(() =>
      store.saveVersion("Gone", "on-publish", {
        documents: [{ id: "page:home", kind: "page", hash: "4".repeat(64) }],
      }),
    ).toThrow("no longer in the file");
    store.close();
  });

  it("deletes a version, and prunes Webforge's own down to the newest, never the person's", () => {
    const store = ProjectStore.open(createProject());
    store.commit([page("One")]);
    const mine = store.saveVersion("Mine", "manual");
    const daily = ["Monday", "Tuesday", "Wednesday"].map((day) => store.saveVersion(day, "daily"));
    const before = store.saveVersion("Before restoring", "before-restore");

    expect(store.pruneAutoVersions(2)).toBe(2);
    expect(store.listVersions().map((version) => version.name)).toEqual([
      "Before restoring",
      "Wednesday",
      "Mine",
    ]);
    expect(store.pruneAutoVersions(0)).toBe(2);
    expect(store.listVersions()).toEqual([mine]);
    expect(() => store.pruneAutoVersions(-1)).toThrow();

    expect(store.deleteVersion(mine.id)).toBe(true);
    expect(store.deleteVersion(daily[0]?.id ?? "")).toBe(false);
    expect(store.listVersions()).toEqual([]);
    expect(before.kind).toBe("auto");
    store.close();
  });

  it("keeps the newest version the site was published from when pruning (#664)", () => {
    const store = ProjectStore.open(createProject());
    store.commit([page("One")]);
    store.saveVersion("Published first", "on-publish");
    const live = store.saveVersion("Published again", "on-publish");
    for (const day of ["Monday", "Tuesday", "Wednesday"]) store.saveVersion(day, "daily");

    expect(store.pruneAutoVersions(2)).toBe(2);
    expect(store.listVersions().map((version) => version.name)).toEqual([
      "Wednesday",
      "Tuesday",
      "Published again",
    ]);
    expect(store.pruneAutoVersions(0)).toBe(2);
    expect(store.listVersions().map((version) => version.id)).toEqual([live.id]);
    store.close();
  });

  it("says how much space the versions keep, all of them and each alone", () => {
    const store = ProjectStore.open(createProject());
    const old = store.putBlob(new Uint8Array(1000), "image/png");
    const shared = store.putBlob(new Uint8Array(300).fill(1), "image/png");
    const picture = store.putBlob(new Uint8Array(50).fill(2), "image/png");
    store.commit([page("Old", old)]);
    const first = store.saveVersion("First", "manual", { thumbnailHash: picture });
    const firstPage = store.readManifest()[0];
    store.commit([page("Shared", shared)]);
    const second = store.saveVersion("Second", "daily");
    const third = store.saveVersion("Third", "daily");
    store.commit([page("Now")]);
    const pageSize = (text: string, image: string) => JSON.stringify({ title: text, image }).length;

    const space = store.versionSpace();

    expect(space.versions).toEqual([
      // The page and image the second and third share is neither's alone.
      { id: third.id, bytes: 0 },
      { id: second.id, bytes: 0 },
      { id: first.id, bytes: 1000 + 50 + pageSize("Old", old) },
    ]);
    expect(space.bytes).toBe(1000 + 50 + 300 + pageSize("Old", old) + pageSize("Shared", shared));
    expect(firstPage?.id).toBe("page:home");
    store.close();
  });

  it("keeps a version's picture when cleaning up, and lets it go with the version", () => {
    const store = ProjectStore.open(createProject());
    store.commit([page("One")]);
    const picture = store.putBlob(new Uint8Array([7, 7]), "image/png");
    const version = store.saveVersion("With a picture", "manual", { thumbnailHash: picture });

    expect(store.collectGarbage().blobs).toBe(0);
    expect(store.hasBlob(picture)).toBe(true);
    store.deleteVersion(version.id);
    expect(store.collectGarbage().blobs).toBe(1);
    expect(store.hasBlob(picture)).toBe(false);
    store.close();
  });

  it("reads a version's site migrated and checked, as the site is read", () => {
    const store = ProjectStore.open(createProject());
    expect(store.readVersionSite("no-such-version")).toBeUndefined();
    store.commit([page("Not a site")]);
    const version = store.saveVersion("Broken", "manual");

    expect(() => store.readVersionSite(version.id)).toThrow();
    store.close();
  });

  it("shows a version whose publish record it can't read as never published", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    const version = store.saveVersion("v", "on-publish");
    store.close();
    tamper(path, (db) => {
      db.prepare("UPDATE versions SET published_to = ? WHERE id = ?").run("{not json", version.id);
    });

    const reopened = ProjectStore.open(path);
    expect(reopened.listVersions()[0]?.publishedTo).toBeUndefined();
    reopened.close();
  });

  it("refuses to open a project whose version's picture is missing (#295)", () => {
    const path = createProject();
    tamper(path, (db) => {
      db.pragma("foreign_keys = OFF");
      db.prepare(
        `INSERT INTO versions (id, name, kind, created_at, format_version, manifest, reason,
           site_format, thumbnail_hash)
         VALUES ('v', 'v', 'manual', '2026-11-01T10:00:00.000Z', 2, '{"documents":[]}', 'manual',
           1, ?)`,
      ).run("5".repeat(64));
    });

    expect(openResult(path)).toBe("corrupt");
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

  it("opens a project from a newer Webforge read-only, with extra tables and metadata", () => {
    const path = createProject();
    tamper(path, (db) => {
      db.exec("CREATE TABLE added_in_v2 (x)");
      db.exec("INSERT INTO meta VALUES ('added_in_v2', 'yes')");
      db.prepare("UPDATE meta SET value = ? WHERE key = 'format_version'").run(
        String(FORMAT_VERSION + 1),
      );
    });

    const store = ProjectStore.open(path);

    expect(store.info).toMatchObject({
      formatVersion: FORMAT_VERSION + 1,
      readOnly: true,
      newerFormat: true,
    });
    expect(store.readDocuments()).toEqual([]);
    expect(() => store.commit([{ type: "delete", id: "x" }])).toThrow(ReadOnlyProjectError);
    store.close();
  });

  it("rejects an older format whose tables don't match that format", () => {
    const path = createProject();
    tamper(path, (db) => db.exec("UPDATE meta SET value = '0' WHERE key = 'format_version'"));

    expect(openResult(path)).toBe("unexpected-schema");
  });

  it("refuses to open a document that points to a missing blob, or to other bytes (#295)", () => {
    const missing = createProject();
    tamper(missing, (db) => {
      db.pragma("foreign_keys = OFF");
      db.prepare("INSERT INTO documents VALUES ('page:home', 'page', ?)").run("f".repeat(64));
    });
    expect(openResult(missing)).toBe("corrupt");

    const invalid = createProject();
    tamper(invalid, (db) => {
      db.prepare("INSERT INTO blobs VALUES (?, 'application/json', 3, ?)").run(
        "e".repeat(64),
        Buffer.from("{{{"),
      );
      db.prepare("INSERT INTO documents VALUES ('page:home', 'page', ?)").run("e".repeat(64));
    });
    expect(openResult(invalid)).toBe("corrupt");
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

  it("turns foreign keys on itself, whatever better-sqlite3's default is (R14)", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = OFF");

    hardenConnection(db);

    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    db.exec("CREATE TABLE blobs (hash TEXT PRIMARY KEY)");
    db.exec("CREATE TABLE documents (blob_hash TEXT NOT NULL REFERENCES blobs (hash))");
    expect(() => db.exec("INSERT INTO documents VALUES ('missing')")).toThrow(/FOREIGN KEY/);
    db.close();
  });
});

describe("ProjectStore export choices (3.3)", () => {
  it("starts from the defaults and remembers the last choices across opens", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    expect(store.readExportChoices()).toEqual(DEFAULT_EXPORT_CHOICES);

    const choices = { format: "zip", minify: true, developerFiles: false, askWebAddress: false };
    store.writeExportChoices({ ...choices, format: "folder" });
    store.writeExportChoices(choices as ExportChoices);
    store.close();

    const reopened = ProjectStore.open(path);
    expect(reopened.readExportChoices()).toEqual(choices);
    reopened.close();
  });

  it("falls back to the defaults for a value it doesn't know, and still opens", () => {
    for (const value of ["not json", '{"format":"tar"}', "[]"]) {
      const path = createProject();
      tamper(path, (db) =>
        db.prepare("INSERT INTO meta (key, value) VALUES ('export_choices', ?)").run(value),
      );

      const store = ProjectStore.open(path);

      expect(store.readExportChoices(), value).toEqual(DEFAULT_EXPORT_CHOICES);
      store.close();
    }
  });

  it("refuses to change a read-only site's choices", () => {
    const store = ProjectStore.open(createProject(), { readOnly: true });

    expect(() => store.writeExportChoices(DEFAULT_EXPORT_CHOICES)).toThrow(ReadOnlyProjectError);
    store.close();
  });
});

describe("ProjectStore Site Check ignores (3.6)", () => {
  it("remembers what was ignored across opens, nothing at first", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    expect(store.readSiteCheckIgnored()).toEqual([]);

    store.writeSiteCheckIgnored(["altText:page-1/hero/image", "underlinedText:footer/text"]);
    store.close();

    const reopened = ProjectStore.open(path);
    expect(reopened.readSiteCheckIgnored()).toEqual([
      "altText:page-1/hero/image",
      "underlinedText:footer/text",
    ]);
    reopened.writeSiteCheckIgnored([]);
    expect(reopened.readSiteCheckIgnored()).toEqual([]);
    reopened.close();
  });

  it("reads nothing ignored from a value it can't use, and still opens", () => {
    for (const value of ["not json", '{"a":1}', '[""]']) {
      const path = createProject();
      tamper(path, (db) =>
        db.prepare("INSERT INTO meta (key, value) VALUES ('site_check_ignored', ?)").run(value),
      );
      const store = ProjectStore.open(path);

      expect(store.readSiteCheckIgnored()).toEqual([]);
      store.close();
    }
  });

  it("refuses to change a read-only site's ignores", () => {
    const store = ProjectStore.open(createProject(), { readOnly: true });

    expect(() => store.writeSiteCheckIgnored(["a:b"])).toThrow(ReadOnlyProjectError);
    store.close();
  });
});

describe("ProjectStore editor mode", () => {
  it("starts in Design mode and remembers Content mode across opens", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    expect(store.readEditorMode()).toBe("design");

    store.writeEditorMode("content");
    store.writeEditorMode("content");
    store.close();

    const reopened = ProjectStore.open(path);
    expect(reopened.readEditorMode()).toBe("content");
    reopened.writeEditorMode("design");
    expect(reopened.readEditorMode()).toBe("design");
    reopened.close();
  });

  it("falls back to Design mode for a value it doesn't know, and still opens", () => {
    const path = createProject();
    tamper(path, (db) => db.exec("INSERT INTO meta (key, value) VALUES ('editor_mode', 'zoom')"));

    const store = ProjectStore.open(path);

    expect(store.readEditorMode()).toBe("design");
    store.close();
  });

  it("refuses to change a read-only site's mode", () => {
    const store = ProjectStore.open(createProject(), { readOnly: true });

    expect(() => store.writeEditorMode("content")).toThrow(ReadOnlyProjectError);
    store.close();
  });
});
