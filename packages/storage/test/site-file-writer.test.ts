import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import { ProjectFileError, ProjectStore, SiteFileWriter } from "../src/index.js";

// The storage writer's connection (R13b, ADR 0013): it writes imports, pasted and downloaded files
// beside the store's own connection, with the content fingerprint, so the file still opens, and
// cleans the file up as its site closes (#664).

const tempDir = tempDirFactory();

function createProject(): string {
  const path = join(tempDir(), "site.wforge");
  ProjectStore.create(path, { name: "Writer" }).close();
  return path;
}

const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const asset = (mediaId: string) => ({
  mediaId,
  data: photo,
  mime: "image/jpeg",
  width: 10,
  height: 8,
  originalName: "shop.jpg",
});

describe("SiteFileWriter", () => {
  it("stores an import beside an open store, which reads it, and the file still opens", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    const writer = SiteFileWriter.open(path);

    const hash = writer.put(asset("shop"));
    // The same bytes again: one blob, a second asset naming it.
    expect(writer.put(asset("again"))).toBe(hash);
    writer.close();

    expect(hash).toBe(sha(photo));
    expect(store.readAsset("shop")).toEqual({
      mediaId: "shop",
      hash,
      mime: "image/jpeg",
      width: 10,
      height: 8,
      originalName: "shop.jpg",
    });
    store.close();
    // The fingerprint matches the rows: the file opens, not as corrupt.
    const reopened = ProjectStore.open(path);
    try {
      expect(new Uint8Array(reopened.readBlob(hash)?.data ?? [])).toEqual(photo);
      expect(reopened.listAssets().map((each) => each.mediaId)).toEqual(["again", "shop"]);
    } finally {
      reopened.close();
    }
  });

  it("leaves an import nothing in the site names to garbage collection", () => {
    const path = createProject();
    const writer = SiteFileWriter.open(path);
    const hash = writer.put(asset("shop"));
    writer.close();

    const store = ProjectStore.open(path);
    try {
      expect(store.collectGarbage().blobs).toBe(1);
      expect(store.hasBlob(hash)).toBe(false);
      expect(store.readAsset("shop")).toBeUndefined();
    } finally {
      store.close();
    }
  });

  it("stores files all or none, the first as a Media item's asset when asked", () => {
    const path = createProject();
    const writer = SiteFileWriter.open(path);
    const code = new TextEncoder().encode("window.x = 1;");

    const hashes = writer.putBlobs(
      [
        { data: photo, mime: "image/jpeg" },
        { data: code, mime: "text/javascript" },
      ],
      { mediaId: "pasted", width: 10, height: 8, originalName: "shop.jpg" },
    );
    // Bytes the file has already, with no asset: kept as they are.
    expect(writer.putBlobs([{ data: code, mime: "text/javascript" }])).toEqual([sha(code)]);
    // A blob that can't be stored stores none of the others.
    expect(() =>
      writer.putBlobs([
        { data: new Uint8Array([5]), mime: "image/png" },
        { data: undefined as unknown as Uint8Array, mime: "image/png" },
      ]),
    ).toThrow();
    // Bytes that aren't the ones expected: nothing stored, not even the item's asset (#664).
    expect(() =>
      writer.putBlobs(
        [
          { data: new Uint8Array([6]), mime: "image/png", hash: sha(photo) },
          { data: new Uint8Array([7]), mime: "image/png" },
        ],
        { mediaId: "wrong", originalName: "wrong.png" },
      ),
    ).toThrow("not the ones expected");
    expect(writer.putBlobs([{ data: photo, mime: "image/jpeg", hash: sha(photo) }])).toEqual([
      sha(photo),
    ]);
    writer.close();

    expect(hashes).toEqual([sha(photo), sha(code)]);
    const store = ProjectStore.open(path);
    try {
      expect(store.readAsset("pasted")).toMatchObject({ hash: sha(photo), mime: "image/jpeg" });
      expect(store.readBlob(sha(code))?.mime).toBe("text/javascript");
      expect(store.hasBlob(sha(new Uint8Array([5])))).toBe(false);
      expect(store.readAsset("wrong")).toBeUndefined();
      expect(store.hasBlob(sha(new Uint8Array([7])))).toBe(false);
    } finally {
      store.close();
    }
  });

  it("cleans up as the site closes: garbage goes, and the file shrinks once enough is free", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    const kept = store.putBlob(photo, "image/jpeg");
    store.commit([{ type: "put", id: "page:home", kind: "page", content: { image: kept } }]);
    // Garbage: a large image nothing names any more, and a small one.
    store.putBlob(new Uint8Array(8 * 1024 * 1024).fill(3), "image/png");
    store.putBlob(new Uint8Array([4]), "image/png");
    store.close();
    const before = statSync(path).size;

    const writer = SiteFileWriter.open(path);
    expect(writer.cleanUp()).toEqual({
      blobs: 2,
      bytes: 8 * 1024 * 1024 + 1,
      assets: 0,
      vacuumed: true,
    });
    writer.close();

    expect(statSync(path).size).toBeLessThan(before / 4);
    const reopened = ProjectStore.open(path);
    try {
      expect(reopened.hasBlob(kept)).toBe(true);
      expect(reopened.readDocument("page:home")?.content).toEqual({ image: kept });
    } finally {
      reopened.close();
    }
  });

  it("writes nothing when there is nothing to clean up, nor enough free to give back", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    store.putBlob(new Uint8Array([4]), "image/png");
    store.close();
    const writer = SiteFileWriter.open(path);
    // A little garbage: removed, but too little freed to rewrite the file for.
    expect(writer.cleanUp()).toMatchObject({ blobs: 1, vacuumed: false });
    const before = readFileSync(path);

    expect(writer.cleanUp()).toEqual({ blobs: 0, bytes: 0, assets: 0, vacuumed: false });
    writer.close();

    expect(readFileSync(path).equals(before)).toBe(true);
  });

  it("leaves an unedited file as it was, however much of it is free (#661, #664)", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    store.putBlob(new Uint8Array(8 * 1024 * 1024).fill(3), "image/png");
    // Collected at an earlier close, which left the space free.
    expect(store.collectGarbage().blobs).toBe(1);
    store.close();
    const before = readFileSync(path);
    const modified = statSync(path).mtimeMs;

    const writer = SiteFileWriter.open(path);
    expect(writer.cleanUp()).toEqual({ blobs: 0, bytes: 0, assets: 0, vacuumed: false });
    writer.close();

    expect(readFileSync(path).equals(before)).toBe(true);
    expect(statSync(path).mtimeMs).toBe(modified);
  });

  it("leaves a file too large to rewrite quickly for Version History's Clean up (#664)", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    const kept = store.putBlob(new Uint8Array(17 * 1024 * 1024).fill(1), "image/png");
    store.commit([{ type: "put", id: "page:home", kind: "page", content: { image: kept } }]);
    store.putBlob(new Uint8Array(24 * 1024 * 1024).fill(2), "image/png");
    store.close();

    const writer = SiteFileWriter.open(path);
    // Garbage goes, but a VACUUM of what's kept could outlast the time a clean-up is given.
    expect(writer.cleanUp()).toMatchObject({ blobs: 1, vacuumed: false });
    writer.close();
  });

  it("opens only a Webforge project", () => {
    const path = join(tempDir(), "other.db");
    writeFileSync(path, "");

    expect(() => SiteFileWriter.open(path)).toThrow(ProjectFileError);
    expect(() => SiteFileWriter.open(join(tempDir(), "missing.wforge"))).toThrow();
  });
});
