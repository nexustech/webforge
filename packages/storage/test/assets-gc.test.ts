import { createHash } from "node:crypto";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import Database from "better-sqlite3";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ProjectFileError, ProjectStore } from "../src/index.js";

const tempDir = tempDirFactory();

function newStore(): { store: ProjectStore; path: string } {
  const path = join(tempDir(), "site.wforge");
  return { store: ProjectStore.create(path, { name: "Rosa's Bakery" }), path };
}

const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const bytes = (...values: number[]) => new Uint8Array(values);

/** The site's media document as the editor stores it: metadata naming each original's hash. */
function mediaDocument(hashes: readonly string[]) {
  return {
    type: "put" as const,
    id: "media",
    kind: "media",
    content: Object.fromEntries(hashes.map((hash, index) => [`m${index}`, { hash }])),
  };
}

describe("ProjectStore assets", () => {
  it("stores an import's original bytes unmodified and records its facts", () => {
    const { store, path } = newStore();
    const photo = bytes(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3);

    const asset = store.putAsset({
      mediaId: "shop",
      data: photo,
      mime: "image/jpeg",
      width: 1600,
      height: 1000,
      originalName: "shop.jpg",
    });
    store.close();

    expect(asset.hash).toBe(sha(photo));
    const reopened = ProjectStore.open(path);
    expect(reopened.readAsset("shop")).toEqual({
      mediaId: "shop",
      hash: sha(photo),
      mime: "image/jpeg",
      width: 1600,
      height: 1000,
      originalName: "shop.jpg",
    });
    expect(Array.from(reopened.readBlob(asset.hash)?.data ?? [])).toEqual(Array.from(photo));
    expect(reopened.readAsset("other")).toBeUndefined();
    reopened.close();
  });

  it("shares the blob of identical imports and points a replaced item at its new file", () => {
    const { store } = newStore();
    const first = bytes(1, 2, 3);
    const second = bytes(4, 5, 6);

    store.putAsset({ mediaId: "a", data: first, mime: "application/pdf", originalName: "a.pdf" });
    store.putAsset({ mediaId: "b", data: first, mime: "application/pdf", originalName: "b.pdf" });
    store.putAsset({ mediaId: "a", data: second, mime: "application/pdf", originalName: "c.pdf" });

    expect(store.listAssets()).toEqual([
      expect.objectContaining({ mediaId: "a", hash: sha(second), originalName: "c.pdf" }),
      {
        mediaId: "b",
        hash: sha(first),
        mime: "application/pdf",
        width: undefined,
        height: undefined,
        originalName: "b.pdf",
      },
    ]);
    store.close();
  });
});

describe("ProjectStore.collectGarbage", () => {
  it("removes blobs and assets nothing refers to, and keeps the rest", () => {
    const { store, path } = newStore();
    const used = store.putAsset({
      mediaId: "used",
      data: bytes(1),
      mime: "image/png",
      originalName: "a.png",
    });
    const old = store.putAsset({
      mediaId: "old",
      data: bytes(2),
      mime: "image/png",
      originalName: "b.png",
    });
    const unused = store.putAsset({
      mediaId: "gone",
      data: bytes(3, 3),
      mime: "image/png",
      originalName: "c.png",
    });
    // A version still shows `old`; the working copy only `used`.
    store.commit([mediaDocument([used.hash, old.hash])]);
    store.saveVersion("Before redesign", "manual");
    store.commit([mediaDocument([used.hash])]);

    const report = store.collectGarbage();

    expect(report).toEqual({ blobs: 1, bytes: 2, assets: 1 });
    expect(store.readBlob(unused.hash)).toBeUndefined();
    expect(store.readAsset("gone")).toBeUndefined();
    expect(store.readBlob(used.hash)).toBeDefined();
    expect(store.readBlob(old.hash)).toBeDefined();
    // The documents' own blobs, current and versioned, survive too.
    expect(store.readDocument("media")?.content).toEqual({ m0: { hash: used.hash } });
    const [version] = store.listVersions();
    expect(store.readVersion(version?.id ?? "")?.[0]?.content).toEqual({
      m0: { hash: used.hash },
      m1: { hash: old.hash },
    });
    expect(store.collectGarbage()).toEqual({ blobs: 0, bytes: 0, assets: 0 });
    store.close();
    const reopened = ProjectStore.open(path);
    expect(reopened.listAssets().map((asset) => asset.mediaId)).toEqual(["old", "used"]);
    reopened.close();
  });

  // 25 stores, each committing and saving versions with an fsync: under 3 s on the developer's
  // computer and on CI's Linux and macOS runners, but about 15–28 s on its Windows runners, whose
  // disks are slow and uneven, and past the 30 s default on a busy one. Three times the slowest
  // seen still catches a collector that has become many times slower.
  it("never removes a blob the working copy or a version refers to", () => {
    fc.assert(
      fc.property(
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 8 }),
        fc.array(fc.array(fc.nat(), { maxLength: 4 }), { maxLength: 4 }),
        fc.array(fc.nat(), { maxLength: 4 }),
        (files, versions, current) => {
          const { store } = newStore();
          const hashes = files.map(
            (data, index) =>
              store.putAsset({
                mediaId: `m${index}`,
                data,
                mime: "image/png",
                originalName: "x.png",
              }).hash,
          );
          const pick = (indexes: readonly number[]) =>
            indexes.map((index) => hashes[index % hashes.length] ?? "");
          const referenced = new Set(pick(current));
          for (const version of versions) {
            store.commit([mediaDocument(pick(version))]);
            store.saveVersion("auto", "auto");
            for (const hash of pick(version)) referenced.add(hash);
          }
          store.commit([mediaDocument(pick(current))]);

          store.collectGarbage();

          for (const hash of new Set(hashes)) {
            expect(store.readBlob(hash) !== undefined).toBe(referenced.has(hash));
          }
          expect(store.listAssets().every((asset) => referenced.has(asset.hash))).toBe(true);
          store.close();
        },
      ),
      { numRuns: 25 },
    );
  }, 90_000);

  it("removes nothing when a version's manifest is damaged", () => {
    const { store, path } = newStore();
    const asset = store.putAsset({
      mediaId: "a",
      data: bytes(9),
      mime: "image/png",
      originalName: "a.png",
    });
    store.saveVersion("One", "manual");
    store.close();
    const db = new Database(path);
    db.prepare("UPDATE versions SET manifest = '{'").run();
    db.close();

    const reopened = ProjectStore.open(path);
    expect(() => reopened.collectGarbage()).toThrow(ProjectFileError);
    expect(reopened.readBlob(asset.hash)).toBeDefined();
    reopened.close();
  });
});
