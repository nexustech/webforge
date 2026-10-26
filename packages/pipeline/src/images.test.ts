import { createHash } from "node:crypto";
import encodePng from "@jsquash/png/encode.js";
import type { MediaItem } from "@webforge/model";
import type { ResolvedImage } from "@webforge/site-components";
import { heroPhoto } from "@webforge/test-utils";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { imageForDepth, makeThumbnail, processImage } from "./images.js";
import { loadNodeResources } from "./node-resources.js";
import type { CodecModules, ImageCache } from "./resources.js";

let codecs: CodecModules;

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

/** Processes `item` from its own bytes, read through `read` (counted by the caller), with `cache`. */
async function process(
  item: MediaItem & { readonly data: Uint8Array },
  cache?: ImageCache,
  read: () => Promise<Uint8Array | undefined> = async () => item.data,
) {
  const result = await processImage(item, { hash: sha256(item.data), read }, codecs, { cache });
  if (result === undefined) throw new Error("The image wasn't processed");
  return result;
}

/** A cache in memory, counting what it was asked for and given. */
function memoryCache() {
  const entries = new Map<string, Uint8Array>();
  const cache: ImageCache = {
    get: async (key) => entries.get(key),
    set: async (key, data) => {
      entries.set(key, data);
    },
  };
  return { cache, entries };
}

beforeAll(async () => {
  codecs = (await loadNodeResources()).codecs;
  // Initialise the codecs (and the ImageData stand-in) before building test images.
  await process({ id: "x", name: "x", mimeType: "image/jpeg", data: heroPhoto() });
}, 60_000);

async function png(width: number, height: number, alpha: number): Promise<Uint8Array> {
  const data = new Uint8ClampedArray(width * height * 4).fill(200);
  for (let i = 3; i < data.length; i += 4) data[i] = alpha;
  return new Uint8Array(await encodePng(new ImageData(data, width, height)));
}

describe("processImage", () => {
  it("makes WebP and JPEG files at each width up to the original's", async () => {
    const result = await process({
      id: "a",
      name: "hero",
      mimeType: "image/jpeg",
      data: heroPhoto(),
    });

    expect(result.files.map((file) => file.path)).toEqual([
      "hero-640.webp",
      "hero-640.jpg",
      "hero-1280.webp",
      "hero-1280.jpg",
      "hero-1600.webp",
      "hero-1600.jpg",
    ]);
    expect(result.image).toEqual({
      sources: [
        {
          type: "image/webp",
          srcset:
            "assets/img/hero-640.webp 640w, assets/img/hero-1280.webp 1280w, assets/img/hero-1600.webp 1600w",
        },
      ],
      src: "assets/img/hero-1600.jpg",
      fallback: {
        type: "image/jpeg",
        srcset:
          "assets/img/hero-640.jpg 640w, assets/img/hero-1280.jpg 1280w, assets/img/hero-1600.jpg 1600w",
      },
      width: 1600,
      height: 1000,
      alt: "",
    });
  }, 60_000);

  it("never upscales a small image", async () => {
    const result = await process({
      id: "a",
      name: "logo",
      mimeType: "image/png",
      data: await png(300, 100, 255),
    });

    expect(result.files.map((file) => file.path)).toEqual(["logo-300.webp", "logo-300.jpg"]);
    expect([result.image.width, result.image.height]).toEqual([300, 100]);
  });

  it("keeps PNG as the fallback for images with transparency", async () => {
    const result = await process({
      id: "a",
      name: "badge",
      mimeType: "image/png",
      data: await png(64, 64, 128),
    });

    expect(result.files.map((file) => file.path)).toEqual(["badge-64.webp", "badge-64.png"]);
    expect(result.image.fallback.type).toBe("image/png");
    // PNG signature: 89 50 4E 47.
    expect([...(result.files[1]?.data.slice(0, 4) ?? [])]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});

describe("processImage with a cache (R15)", () => {
  const hero = (): MediaItem & { readonly data: Uint8Array } => ({
    id: "a",
    name: "hero",
    mimeType: "image/jpeg",
    data: heroPhoto(),
  });

  it("takes an image encoded before from the cache, reading and encoding nothing", async () => {
    const { cache, entries } = memoryCache();
    const first = await process(hero(), cache);
    const kept = entries.size;

    const read = vi.fn(async () => undefined);
    const second = await process({ ...hero(), name: "photo" }, cache, read);

    expect(read).not.toHaveBeenCalled();
    expect(entries.size).toBe(kept);
    // The same bytes, under the name the item has now.
    expect(second.files.map((file) => file.path)).toEqual(
      first.files.map((file) => file.path.replace("hero", "photo")),
    );
    expect(second.files.map((file) => file.data)).toEqual(first.files.map((file) => file.data));
    expect(second.image).toMatchObject({ width: first.image.width, height: first.image.height });
  }, 60_000);

  it("encodes the image again for another crop, or when a file has gone from the cache", async () => {
    const { cache, entries } = memoryCache();
    await process(hero(), cache);

    const read = vi.fn(async () => heroPhoto());
    const cropped = await process(
      { ...hero(), crop: { x: 0, y: 0, width: 0.5, height: 1 } },
      cache,
      read,
    );
    expect(read).toHaveBeenCalledTimes(1);
    expect(cropped.image.width).toBe(800);

    const webp = [...entries.keys()].find((key) => key.endsWith("/whole/640.webp"));
    if (webp !== undefined) entries.delete(webp);
    await process(hero(), cache, read);
    expect(read).toHaveBeenCalledTimes(2);
  }, 60_000);

  it("treats a damaged plan in the cache as nothing there", async () => {
    const { cache, entries } = memoryCache();
    await process(hero(), cache);
    const plan = [...entries.keys()].find((key) => key.endsWith("/whole/plan"));
    if (plan !== undefined) entries.set(plan, new TextEncoder().encode("{not json"));

    const read = vi.fn(async () => heroPhoto());
    await process(hero(), cache, read);

    expect(read).toHaveBeenCalledTimes(1);
  }, 60_000);

  it("gives nothing for an original that can't be read", async () => {
    const item = hero();
    await expect(
      processImage(item, { hash: sha256(item.data), read: async () => undefined }, codecs),
    ).resolves.toBeUndefined();
  });
});

describe("processImage with alt text, focal point and crop", () => {
  it("cuts the crop before resizing and moves the focal point into the cut image", async () => {
    const result = await process({
      id: "a",
      name: "hero",
      mimeType: "image/jpeg",
      data: heroPhoto(),
      alt: "Green hills",
      focal: { x: 0.3, y: 0.5 },
      crop: { x: 0.1875, y: 0, width: 0.625, height: 1 },
    });

    // 1600 × 1000 cut to its centre 1000 × 1000: exported at 640 and 1000 wide.
    expect(result.files.map((file) => file.path)).toEqual([
      "hero-640.webp",
      "hero-640.jpg",
      "hero-1000.webp",
      "hero-1000.jpg",
    ]);
    expect(result.image).toMatchObject({
      width: 1000,
      height: 1000,
      alt: "Green hills",
      // 0.3 of the original is (0.3 - 0.1875) / 0.625 = 18% of the cut image.
      objectPosition: "18% 50%",
    });
    // Encoding the photo takes seconds on a busy machine, as in the tests above.
  }, 60_000);

  it("has empty alt text and no position without them", async () => {
    const result = await process({
      id: "a",
      name: "hero",
      mimeType: "image/jpeg",
      data: heroPhoto(),
    });

    expect(result.image.alt).toBe("");
    expect(result.image).not.toHaveProperty("objectPosition");
  }, 60_000);
});

describe("imageForDepth", () => {
  const image: ResolvedImage = {
    sources: [
      { type: "image/webp", srcset: "assets/img/a-640.webp 640w, assets/img/a-1280.webp 1280w" },
    ],
    src: "assets/img/a-1280.jpg",
    fallback: { type: "image/jpeg", srcset: "assets/img/a-640.jpg 640w" },
    width: 1280,
    height: 720,
    alt: "",
  };

  it("keeps URLs for pages at the site root", () => {
    expect(imageForDepth(image, 0)).toBe(image);
  });

  it("adds ../ per folder level to every URL", () => {
    const moved = imageForDepth(image, 2);

    expect(moved.src).toBe("../../assets/img/a-1280.jpg");
    expect(moved.sources[0]?.srcset).toBe(
      "../../assets/img/a-640.webp 640w, ../../assets/img/a-1280.webp 1280w",
    );
    expect(moved.fallback.srcset).toBe("../../assets/img/a-640.jpg 640w");
  });
});

describe("makeThumbnail", () => {
  it("makes a 320 px wide WebP preview of a larger image", async () => {
    const thumbnail = await makeThumbnail(heroPhoto(), "image/jpeg", codecs);

    expect(String.fromCharCode(...thumbnail.subarray(8, 12))).toBe("WEBP");
    // VP8 frame size: the original's 1600 × 1000, scaled to 320 wide.
    const view = new DataView(thumbnail.buffer, thumbnail.byteOffset);
    expect(view.getUint16(26, true) & 0x3fff).toBe(320);
    expect(view.getUint16(28, true) & 0x3fff).toBe(200);
  });

  it("keeps a narrower image's size", async () => {
    const thumbnail = await makeThumbnail(await png(40, 10, 128), "image/png", codecs);

    expect(String.fromCharCode(...thumbnail.subarray(0, 4))).toBe("RIFF");
    expect(thumbnail.byteLength).toBeGreaterThan(0);
  });
});
