import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSite, DEFAULT_EXPORT_CHOICES } from "@webforge/model";
import { tempDirFactory } from "@webforge/test-utils";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { ProjectStore } from "../src/index.js";

// Opening checks a project's content against the fingerprint every write records (#295). A write
// that changed documents, assets or versions without recording it would make a healthy file open
// as "corrupt" and offer the backups. So every write goes through ProjectStore's one write helper,
// and these tests keep it that way.
//
// A new ProjectStore method belongs in READERS or WRITERS below; the first test fails until it is.

const tempDir = tempDirFactory();

/** Methods that never change the file. */
const READERS = [
  "info",
  "readDocuments",
  "isEmpty",
  "readDocument",
  "readSite",
  "hasBlob",
  "readBlob",
  "listVersions",
  "readVersion",
  "readAsset",
  "listAssets",
  "readEditorMode",
  "readExportChoices",
  "readSiteCheckIgnored",
  "backupTo",
  "close",
];

/** Every method that changes the file, with a call that does. */
const WRITERS: Record<string, (store: ProjectStore) => unknown> = {
  saveSite: (store) =>
    store.saveSite(
      createSite({ name: "Paths", language: "en", homeTitle: "Home", notFoundTitle: "Oops" }),
    ),
  commit: (store) =>
    store.commit([{ type: "put", id: "page:extra", kind: "page", content: { a: 1 } }]),
  putBlob: (store) => store.putBlob(new Uint8Array([1, 2, 3]), "application/octet-stream"),
  putAsset: (store) =>
    store.putAsset({
      mediaId: "photo",
      data: new Uint8Array([4, 5, 6]),
      mime: "image/png",
      originalName: "photo.png",
    }),
  saveVersion: (store) => store.saveVersion("Before the change", "manual"),
  writeEditorMode: (store) => store.writeEditorMode("content"),
  writeExportChoices: (store) => store.writeExportChoices(DEFAULT_EXPORT_CHOICES),
  writeSiteCheckIgnored: (store) => store.writeSiteCheckIgnored(["brokenLinks:a"]),
  collectGarbage: (store) => store.collectGarbage(),
};

describe("ProjectStore's writes (#295)", () => {
  it("lists every method as a reader or a writer", () => {
    const methods = Object.getOwnPropertyNames(ProjectStore.prototype).filter(
      (name) => name !== "constructor",
    );

    expect(methods.sort()).toEqual([...READERS, ...Object.keys(WRITERS)].sort());
  });

  it("leaves a file that opens after every write, each recording the fingerprint", () => {
    const path = join(tempDir(), "paths.wforge");
    ProjectStore.create(path, { name: "Paths" }).close();
    const fingerprint = () => {
      const db = new Database(path, { readonly: true });
      try {
        return db.pragma("user_version", { simple: true });
      } finally {
        db.close();
      }
    };

    for (const [name, write] of Object.entries(WRITERS)) {
      const store = ProjectStore.open(path);
      write(store);
      store.close();

      expect(() => ProjectStore.open(path).close(), name).not.toThrow();
      expect(fingerprint(), name).not.toBe(0);
    }
  });

  it("opens no transaction but in its one write helper", () => {
    const source = readFileSync(new URL("../src/project-store.ts", import.meta.url), "utf8");

    // `create` and the format migrations stamp in their own transactions, before a store exists.
    expect(source.match(/this\.#db\.transaction\(/g)).toHaveLength(1);
    expect(source).toMatch(/#write<T>\(change: \(\) => T\): T \{[^}]*this\.#db\.transaction\(/);
  });
});
