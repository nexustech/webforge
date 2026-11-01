import { readFileSync } from "node:fs";
import { join } from "node:path";
import { copyWforgeFixture } from "@webforge/test-utils";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { FORMAT_VERSION, ProjectStore } from "../src/index.js";
import { APPLICATION_ID, SCHEMAS } from "../src/schema.js";

// Storage format 2 (#664), the first real schema migration: a format 1 file is read as it is, and
// its first write brings it to format 2 in the same transaction, every version kept.

const tempDir = tempDirFactory();

/** The `sqlite_schema` of the file at `path`, and its recorded format. */
function formatOf(path: string) {
  const db = new Database(path, { readonly: true });
  try {
    return {
      format: db.prepare("SELECT value FROM meta WHERE key = 'format_version'").pluck().get(),
      columns: db
        .prepare("SELECT name FROM pragma_table_info('versions')")
        .pluck()
        .all()
        .map(String),
    };
  } finally {
    db.close();
  }
}

/** The facts a migration must keep of each version. */
const kept = (store: ProjectStore) =>
  store.listVersions().map((version) => ({
    ...version,
    documents: store.readVersion(version.id),
  }));

const SITE_HASH = "1".repeat(64);
const JUNK_HASH = "2".repeat(64);

/**
 * A format 1 file written by hand: an automatic version whose `site` document says format 7, and
 * one whose `site` document isn't JSON.
 */
function handMadeFormatOne(): string {
  const path = join(tempDir(), "old.wforge");
  const db = new Database(path);
  db.pragma(`application_id = ${APPLICATION_ID}`);
  for (const statement of SCHEMAS[1] ?? []) db.exec(statement);
  const meta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  meta.run("format_version", "1");
  meta.run("project_id", "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10");
  meta.run("name", "Old site");
  meta.run("created_at", "2026-10-20T10:00:00.000Z");
  const blob = db.prepare("INSERT INTO blobs (hash, mime, size, data) VALUES (?, ?, ?, ?)");
  blob.run(SITE_HASH, "application/json", 1, Buffer.from('{"formatVersion":7}'));
  blob.run(JUNK_HASH, "application/json", 1, Buffer.from("not JSON"));
  const version = db.prepare(
    `INSERT INTO versions (id, name, kind, created_at, format_version, manifest)
     VALUES (?, ?, ?, ?, 1, ?)`,
  );
  const manifest = (hash: string) =>
    JSON.stringify({ documents: [{ id: "site", kind: "site", hash }] });
  version.run("daily", "Every morning", "auto", "2026-10-21T08:00:00.000Z", manifest(SITE_HASH));
  version.run("mine", "Before the sale", "manual", "2026-10-22T09:00:00.000Z", manifest(JUNK_HASH));
  db.close();
  return path;
}

describe("storage format 2 (#664)", () => {
  it("reads a format 1 file's versions as format 2 tells them, without writing", () => {
    const path = copyWforgeFixture(1, tempDir());
    const before = readFileSync(path);

    const store = ProjectStore.open(path);
    expect(store.info.formatVersion).toBe(1);
    expect(store.listVersions()).toEqual([
      expect.objectContaining({
        name: "First version",
        kind: "manual",
        reason: "manual",
        siteFormat: 1,
        thumbnailHash: undefined,
        publishedTo: undefined,
      }),
    ]);
    store.close();

    expect(readFileSync(path).equals(before)).toBe(true);
  });

  it("migrates with the first write, in its transaction, keeping every version", () => {
    const path = copyWforgeFixture(1, tempDir());
    const store = ProjectStore.open(path);
    const versions = kept(store);
    const site = store.readSite();

    store.writeEditorMode("content");
    expect(store.info.formatVersion).toBe(FORMAT_VERSION);
    store.close();

    expect(formatOf(path)).toEqual({
      format: String(FORMAT_VERSION),
      columns: expect.arrayContaining(["reason", "site_format", "thumbnail_hash", "published_to"]),
    });
    const reopened = ProjectStore.open(path);
    expect(reopened.info.formatVersion).toBe(FORMAT_VERSION);
    expect(kept(reopened)).toEqual(versions);
    expect(reopened.readSite()).toEqual(site);
    // Its versions take new facts now.
    const [first] = versions;
    expect(
      reopened.recordPublish(first?.id ?? "", {
        destinationId: "d1",
        publishedAt: "2026-11-01T10:00:00.000Z",
        check: "live",
      }),
    ).toBe(true);
    reopened.close();
  });

  it("tells why and in which site format from what format 1 kept, oldest version first still", () => {
    const store = ProjectStore.open(handMadeFormatOne());
    const facts = () =>
      store.listVersions().map(({ id, kind, reason, siteFormat }) => ({
        id,
        kind,
        reason,
        siteFormat,
      }));
    const asRead = facts();

    store.writeEditorMode("content");

    expect(asRead).toEqual([
      { id: "mine", kind: "manual", reason: "manual", siteFormat: 1 },
      { id: "daily", kind: "auto", reason: "daily", siteFormat: 7 },
    ]);
    expect(facts()).toEqual(asRead);
    store.close();
  });

  it("leaves the file as it was when the first write fails, migration and all", () => {
    const path = copyWforgeFixture(1, tempDir());
    const before = readFileSync(path);
    const store = ProjectStore.open(path);

    // A version of a document whose blob isn't in the file can't be saved.
    expect(() =>
      store.saveVersion("Broken", "manual", {
        documents: [{ id: "site", kind: "site", hash: "3".repeat(64) }],
      }),
    ).toThrow();
    expect(() =>
      store.commit([{ type: "put", id: "page:x", kind: "page", content: undefined }]),
    ).toThrow(TypeError);
    expect(store.info.formatVersion).toBe(1);
    store.close();

    expect(readFileSync(path).equals(before)).toBe(true);
  });

  it("never migrates a file opened read-only", () => {
    const path = copyWforgeFixture(1, tempDir());

    const store = ProjectStore.open(path, { readOnly: true });
    expect(store.info).toMatchObject({ formatVersion: 1, readOnly: true });
    expect(store.listVersions().map((version) => version.reason)).toEqual(["manual"]);
    store.close();

    expect(formatOf(path).format).toBe("1");
  });

  it("opens the format 2 fixture with its versions' facts", () => {
    const store = ProjectStore.open(copyWforgeFixture(2, tempDir()));

    expect(store.info.formatVersion).toBe(2);
    expect(
      store.listVersions().map(({ name, reason, thumbnailHash, publishedTo }) => ({
        name,
        reason,
        thumbnail: thumbnailHash !== undefined,
        publishedTo,
      })),
    ).toEqual([
      {
        name: "Published to Rosa's Bakery",
        reason: "on-publish",
        thumbnail: true,
        publishedTo: {
          destinationId: "0d6c2a5e-3f0b-4b8e-9a35-6b1c5a7d2e90",
          publishedAt: "2026-11-01T09:30:00.000Z",
          check: "live",
          deploy: "6544a1b2c3",
        },
      },
      {
        name: "Before restoring",
        reason: "before-restore",
        thumbnail: false,
        publishedTo: undefined,
      },
      { name: "First version", reason: "manual", thumbnail: false, publishedTo: undefined },
    ]);
    expect(store.readVersionSite(store.listVersions()[0]?.id ?? "")?.settings.general.name).toBe(
      "Rosa's Bakery",
    );
    store.close();
  });
});
