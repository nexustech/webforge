import { describe, expect, it } from "vitest";
import {
  altTextFor,
  cropForAspect,
  type ImageMeta,
  imageValueSchema,
  isImageMeta,
  mediaMetaSchema,
  mediaNameFor,
  mediaNameSchema,
} from "./media.js";

const image = {
  id: "shop",
  kind: "image",
  hash: "a".repeat(64),
  name: "shop-front",
  fileName: "shop.jpg",
  mimeType: "image/jpeg",
  width: 1600,
  height: 1000,
  alt: "Our shop front on the high street",
  focal: { x: 0.25, y: 0.5 },
  crop: { x: 0, y: 0.1, width: 1, height: 0.8 },
} as const;

const pdf = {
  id: "menu",
  kind: "file",
  hash: "b".repeat(64),
  name: "menu",
  fileName: "Menu 2026.pdf",
  mimeType: "application/pdf",
} as const;

describe("mediaMetaSchema", () => {
  it("accepts images and files", () => {
    expect(mediaMetaSchema.parse(image)).toEqual(image);
    expect(mediaMetaSchema.parse(pdf)).toEqual(pdf);
  });

  it.each([
    ["an unknown kind", { ...image, kind: "video" }],
    ["an unsupported image type", { ...image, mimeType: "image/gif" }],
    ["a file type for an image", { ...image, mimeType: "application/pdf" }],
    ["an image type for a file", { ...pdf, mimeType: "image/png" }],
    ["image fields on a file", { ...pdf, alt: "x" }],
    ["a short hash", { ...image, hash: "abc" }],
    ["an unsafe export name", { ...image, name: "../shop" }],
    ["a path as file name", { ...image, fileName: "C:\\Users\\sam\\shop.jpg" }],
    ["a zero width", { ...image, width: 0 }],
    ["a focal point outside the image", { ...image, focal: { x: 1.5, y: 0 } }],
    ["a crop outside the image", { ...image, crop: { x: 0.5, y: 0, width: 0.6, height: 1 } }],
    ["an empty crop", { ...image, crop: { x: 0, y: 0, width: 0, height: 1 } }],
  ])("rejects %s", (_name, value) => {
    expect(mediaMetaSchema.safeParse(value).success).toBe(false);
  });
});

describe("altTextFor", () => {
  const meta = mediaMetaSchema.parse(image) as ImageMeta;

  it("reuses the image's alt text unless the placement overrides it (G15)", () => {
    expect(altTextFor({ mediaId: meta.id }, meta)).toBe("Our shop front on the high street");
    expect(altTextFor({ mediaId: meta.id, alt: "Inside" }, meta)).toBe("Inside");
    expect(altTextFor({ mediaId: meta.id, alt: "" }, meta)).toBe("");
    expect(altTextFor({ mediaId: meta.id }, undefined)).toBe("");
  });
});

describe("imageValueSchema", () => {
  it("accepts a media id with an optional alt override and nothing else", () => {
    expect(imageValueSchema.parse({ mediaId: "shop" })).toEqual({ mediaId: "shop" });
    expect(imageValueSchema.safeParse({ mediaId: "shop", width: 3 }).success).toBe(false);
    expect(imageValueSchema.safeParse({ mediaId: "" }).success).toBe(false);
  });
});

describe("isImageMeta", () => {
  it("tells images from files", () => {
    expect(isImageMeta(mediaMetaSchema.parse(image))).toBe(true);
    expect(isImageMeta(mediaMetaSchema.parse(pdf))).toBe(false);
  });
});

describe("mediaNameFor", () => {
  it("makes a valid export name from the file name", () => {
    expect(mediaNameFor("Shop Front (1).JPG", "image")).toBe("shop-front-1");
    expect(mediaNameFor("Café crème.png", "image")).toBe("cafe-creme");
    expect(mediaNameFor("menu.v2.pdf", "file")).toBe("menu-v2");
    expect(mediaNameFor("--__--.jpg", "image")).toBe("image");
    expect(mediaNameFor("日本.pdf", "file")).toBe("file");
    const long = mediaNameFor(`${"a".repeat(59)} b.jpg`, "image");
    expect(long).toBe("a".repeat(59));
    for (const name of ["shop-front-1", "cafe-creme", "menu-v2", "image", "file", long]) {
      expect(mediaNameSchema.safeParse(name).success).toBe(true);
    }
  });

  it("adds a number when another item has the name", () => {
    expect(mediaNameFor("shop.jpg", "image", ["shop"])).toBe("shop-2");
    expect(mediaNameFor("shop.jpg", "image", ["shop", "shop-2"])).toBe("shop-3");
    expect(mediaNameFor("shop.jpg", "image", ["shop-2"])).toBe("shop");
  });
});

describe("cropForAspect", () => {
  const photo = { width: 1600, height: 1000 };

  it("keeps the full width for a wider shape and the full height for a narrower one", () => {
    expect(cropForAspect(photo, 16 / 9)).toEqual({ x: 0, y: 0.05, width: 1, height: 0.9 });
    expect(cropForAspect(photo, 1)).toEqual({ x: 0.1875, y: 0, width: 0.625, height: 1 });
  });

  it("centres the crop on the focal point, as far as the image allows", () => {
    expect(cropForAspect({ ...photo, focal: { x: 0.25, y: 0.5 } }, 1)).toEqual({
      x: 0,
      y: 0,
      width: 0.625,
      height: 1,
    });
    expect(cropForAspect({ ...photo, focal: { x: 0.6, y: 0.5 } }, 1)).toEqual({
      x: 0.2875,
      y: 0,
      width: 0.625,
      height: 1,
    });
    expect(cropForAspect({ ...photo, focal: { x: 0.5, y: 1 } }, 16 / 9)).toEqual({
      x: 0,
      y: 0.1,
      width: 1,
      height: 0.9,
    });
  });

  it("cuts nothing when the image already has the shape", () => {
    expect(cropForAspect(photo, 16 / 10)).toBeUndefined();
  });

  it("makes crops the Media schema accepts", () => {
    for (const aspect of [1, 4 / 3, 3 / 2, 16 / 9, 3 / 4]) {
      for (const x of [0, 0.33, 1]) {
        const crop = cropForAspect({ width: 1234, height: 777, focal: { x, y: x } }, aspect);
        expect(mediaMetaSchema.safeParse({ ...image, crop }).success).toBe(true);
      }
    }
  });
});
