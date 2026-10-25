import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { BlobWriter, ProjectFileError, ProjectStore } from "../src/index.js";

// The storage writer's connection (R13b, ADR 0013): it writes blobs only, beside the store's own
// connection, and the store records the asset that names one.

const tempDir = tempDirFactory();

function createProject(): string {
  const path = join(tempDir(), "site.wforge");
  ProjectStore.create(path, { name: "Writer" }).close();
  return path;
}

const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

describe("BlobWriter", () => {
  it("stores bytes under their hash, once, beside an open store that then records the asset", () => {
    const path = createProject();
    const store = ProjectStore.open(path);
    const writer = BlobWriter.open(path);

    const hash = writer.put(photo, "image/jpeg");
    expect(writer.put(photo, "image/jpeg")).toBe(hash);
    writer.close();
    const asset = store.addAsset({
      mediaId: "shop",
      hash,
      mime: "image/jpeg",
      width: 10,
      height: 8,
      originalName: "shop.jpg",
    });
    store.close();

    expect(hash).toBe(sha(photo));
    const reopened = ProjectStore.open(path);
    try {
      expect(reopened.readAsset("shop")).toEqual(asset);
      expect(new Uint8Array(reopened.readBlob(hash)?.data ?? [])).toEqual(photo);
    } finally {
      reopened.close();
    }
  });

  it("leaves a blob nothing names for garbage collection, the file still opening", () => {
    const path = createProject();
    const writer = BlobWriter.open(path);
    const hash = writer.put(photo, "image/jpeg");
    writer.close();

    const store = ProjectStore.open(path);
    try {
      expect(store.collectGarbage().blobs).toBe(1);
      expect(store.hasBlob(hash)).toBe(false);
    } finally {
      store.close();
    }
  });

  it("refuses an asset whose bytes aren't stored", () => {
    const store = ProjectStore.open(createProject());
    try {
      expect(() =>
        store.addAsset({ mediaId: "x", hash: sha(photo), mime: "image/jpeg", originalName: "x" }),
      ).toThrow();
    } finally {
      store.close();
    }
  });

  it("opens only a Webforge project", () => {
    const path = join(tempDir(), "other.db");
    writeFileSync(path, "");

    expect(() => BlobWriter.open(path)).toThrow(ProjectFileError);
    expect(() => BlobWriter.open(join(tempDir(), "missing.wforge"))).toThrow();
  });
});
