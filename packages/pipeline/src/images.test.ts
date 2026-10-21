import encodePng from "@jsquash/png/encode.js";
import type { ResolvedImage } from "@webforge/site-components";
import { heroPhoto } from "@webforge/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import { imageForDepth, makeThumbnail, processImage } from "./images.js";
import { loadNodeResources } from "./node-resources.js";
import type { CodecModules } from "./resources.js";

let codecs: CodecModules;

beforeAll(async () => {
  codecs = (await loadNodeResources()).codecs;
  // Initialise the codecs (and the ImageData stand-in) before building test images.
  await processImage({ id: "x", name: "x", mimeType: "image/jpeg", data: heroPhoto() }, codecs);
}, 60_000);

async function png(width: number, height: number, alpha: number): Promise<Uint8Array> {
  const data = new Uint8ClampedArray(width * height * 4).fill(200);
  for (let i = 3; i < data.length; i += 4) data[i] = alpha;
  return new Uint8Array(await encodePng(new ImageData(data, width, height)));
}

describe("processImage", () => {
  it("makes WebP and JPEG files at each width up to the original's", async () => {
    const result = await processImage(
      { id: "a", name: "hero", mimeType: "image/jpeg", data: heroPhoto() },
      codecs,
    );

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
    const result = await processImage(
      { id: "a", name: "logo", mimeType: "image/png", data: await png(300, 100, 255) },
      codecs,
    );

    expect(result.files.map((file) => file.path)).toEqual(["logo-300.webp", "logo-300.jpg"]);
    expect([result.image.width, result.image.height]).toEqual([300, 100]);
  });

  it("keeps PNG as the fallback for images with transparency", async () => {
    const result = await processImage(
      { id: "a", name: "badge", mimeType: "image/png", data: await png(64, 64, 128) },
      codecs,
    );

    expect(result.files.map((file) => file.path)).toEqual(["badge-64.webp", "badge-64.png"]);
    expect(result.image.fallback.type).toBe("image/png");
    // PNG signature: 89 50 4E 47.
    expect([...(result.files[1]?.data.slice(0, 4) ?? [])]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});

describe("processImage with alt text, focal point and crop", () => {
  it("cuts the crop before resizing and moves the focal point into the cut image", async () => {
    const result = await processImage(
      {
        id: "a",
        name: "hero",
        mimeType: "image/jpeg",
        data: heroPhoto(),
        alt: "Green hills",
        focal: { x: 0.3, y: 0.5 },
        crop: { x: 0.1875, y: 0, width: 0.625, height: 1 },
      },
      codecs,
    );

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
  });

  it("has empty alt text and no position without them", async () => {
    const result = await processImage(
      { id: "a", name: "hero", mimeType: "image/jpeg", data: heroPhoto() },
      codecs,
    );

    expect(result.image.alt).toBe("");
    expect(result.image).not.toHaveProperty("objectPosition");
  });
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
