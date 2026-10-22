import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageMeta, MediaId, MediaMeta, NodeDoc } from "@webforge/model";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ClipboardSite, createElementClipboard, type SystemClipboard } from "./clipboard.js";

const bytes = new Uint8Array([0xff, 0xd8, 0xff, 7]);
const photo: ImageMeta = {
  id: "photo" as MediaId,
  hash: createHash("sha256").update(bytes).digest("hex"),
  name: "shop",
  fileName: "shop.jpg",
  kind: "image",
  mimeType: "image/jpeg",
  width: 10,
  height: 10,
  alt: "",
};
const hero: NodeDoc = { type: "Hero", props: { id: "hero", image: { mediaId: "photo" } } };

let dir: string;
let held: string | undefined;
const system: SystemClipboard = {
  writeElements: async (json) => {
    held = json;
  },
  readElements: async (maxBytes) =>
    held !== undefined && held.length <= maxBytes ? held : undefined,
};

/** An open site that has `photo`'s bytes, and records what a paste stores. */
function fakeSite(has = true) {
  const stored: { item: MediaMeta; data: Uint8Array | undefined }[] = [];
  const site: ClipboardSite = {
    current: () => ({ name: "Site", fileName: "Site.wforge", formatVersion: 1, syncService: null }),
    readMedia: (hash) =>
      has && hash === photo.hash ? { mime: "image/jpeg", data: bytes } : undefined,
    storeCopiedMedia: (item, read) => {
      const data = read();
      stored.push({ item, data });
      return data === undefined ? { status: "missing" } : { status: "stored", hash: item.hash };
    },
  };
  return { site, stored };
}

beforeEach(() => {
  dir = join(mkdtempSync(join(tmpdir(), "webforge-clipboard-")), "clipboard");
  held = undefined;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(join(dir, ".."), { recursive: true, force: true });
});

describe("element clipboard (1.25)", () => {
  it("copies elements with their images' bytes, for another site to paste", async () => {
    const copying = createElementClipboard(system, dir, fakeSite().site);
    expect(await copying.write({ nodes: [hero], media: [photo] })).toEqual({ status: "copied" });
    expect(readdirSync(dir)).toEqual([photo.hash]);

    // Another site, opened later, without the image.
    const other = fakeSite(false);
    const result = await createElementClipboard(system, dir, other.site).read();

    expect(result).toEqual({ status: "elements", elements: { nodes: [hero], media: [photo] } });
    expect(other.stored.map(({ item, data }) => [item, [...(data ?? [])]])).toEqual([
      [photo, [...bytes]],
    ]);
  });

  it("keeps only the last copy's images, and leaves out an image whose bytes are gone", async () => {
    const clipboard = createElementClipboard(system, dir, fakeSite().site);
    writeFileSync(join(dir, "..", "x"), "");
    await clipboard.write({ nodes: [hero], media: [photo] });
    await clipboard.write({ nodes: [hero], media: [] });
    expect(readdirSync(dir)).toEqual([]);

    await clipboard.write({ nodes: [hero], media: [photo] });
    // Changed on disk: not the copied image any more.
    writeFileSync(join(dir, photo.hash), "changed");
    const read = await createElementClipboard(system, dir, fakeSite(false).site).read();
    expect(read).toEqual({ status: "elements", elements: { nodes: [hero], media: [] } });
  });

  it("copies an element without the image the site no longer has", async () => {
    const clipboard = createElementClipboard(system, dir, fakeSite(false).site);
    await clipboard.write({ nodes: [hero], media: [photo] });
    expect(existsSync(join(dir, photo.hash))).toBe(false);
    expect(JSON.parse(held ?? "")).toEqual({ nodes: [hero], media: [] });
  });

  it("finds nothing to paste in other content, or in content that isn't valid elements", async () => {
    const clipboard = createElementClipboard(system, dir, fakeSite().site);
    expect(await clipboard.read()).toEqual({ status: "empty" });
    for (const content of [
      "not json",
      '{"nodes":[]}',
      JSON.stringify({ nodes: [{}], media: [] }),
    ]) {
      held = content;
      expect(await clipboard.read()).toEqual({ status: "empty" });
    }
    held = "x".repeat(11 * 1024 * 1024);
    expect(await clipboard.read()).toEqual({ status: "empty" });
  });

  it("needs an open site, and reports a site that can't take the images", async () => {
    const { site } = fakeSite();
    const closed = createElementClipboard(system, dir, { ...site, current: () => null });
    expect(await closed.write({ nodes: [hero], media: [] })).toEqual({
      status: "failed",
      reason: "no-site",
    });
    await createElementClipboard(system, dir, site).write({ nodes: [hero], media: [photo] });
    expect(await closed.read()).toEqual({ status: "failed", reason: "no-site" });

    const readOnly = createElementClipboard(system, dir, {
      ...site,
      storeCopiedMedia: () => ({ status: "failed", reason: "read-only" }),
    });
    expect(await readOnly.read()).toEqual({ status: "failed", reason: "read-only" });
  });

  it("reports a copy it couldn't write", async () => {
    const broken = createElementClipboard(
      { ...system, writeElements: () => Promise.reject(new Error("busy")) },
      dir,
      fakeSite().site,
    );
    expect(await broken.write({ nodes: [hero], media: [] })).toEqual({
      status: "failed",
      reason: "unknown",
    });
  });
});
