import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import { AssetWriter, ProjectFileError, ProjectStore } from "../src/index.js";

// The storage writer's connection (R13b, ADR 0013): it writes imports beside the store's own
// connection, with the content fingerprint, so the file still opens.

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

describe("AssetWriter", () => {
  it("stores an import beside an open store, which reads it, and the file still opens", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    const writer = AssetWriter.open(path);

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
    const writer = AssetWriter.open(path);
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

  it("opens only a Webforge project", () => {
    const path = join(tempDir(), "other.db");
    writeFileSync(path, "");

    expect(() => AssetWriter.open(path)).toThrow(ProjectFileError);
    expect(() => AssetWriter.open(join(tempDir(), "missing.wforge"))).toThrow();
  });
});
