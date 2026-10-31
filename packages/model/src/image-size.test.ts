import { describe, expect, it } from "vitest";
import { decodableImage, MAX_IMAGE_PIXELS, sniffImage } from "./image-size.js";

/** The first bytes of a PNG of `width` × `height`: its signature and IHDR chunk. */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

/** The first bytes of a JPEG of `width` × `height`: a comment segment, then its frame header. */
const jpegHeader = (width: number, height: number) =>
  new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xfe,
    0x00,
    0x04,
    0x68,
    0x69,
    0xff,
    0xc2,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    0,
    0,
    0,
    0,
  ]);

describe("sniffImage and decodableImage (S12)", () => {
  it("reads a PNG's and a JPEG's type and size from their first bytes", () => {
    expect(sniffImage(pngHeader(640, 427))).toEqual({
      mimeType: "image/png",
      width: 640,
      height: 427,
    });
    expect(sniffImage(jpegHeader(1600, 1000))).toEqual({
      mimeType: "image/jpeg",
      width: 1600,
      height: 1000,
    });
    // "%PDF-1.7": not an image.
    expect(
      sniffImage(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])),
    ).toBeUndefined();
    expect(sniffImage(pngHeader(0, 10))).toBeUndefined();
    expect(sniffImage(pngHeader(10, 10).subarray(0, 14))).toBeUndefined();
  });

  it("lets an image be decoded only as its own type, at most 50 megapixels", () => {
    expect(decodableImage(pngHeader(10_000, 5_000), "image/png")).toBeDefined();
    expect(MAX_IMAGE_PIXELS).toBe(50_000_000);
    expect(decodableImage(pngHeader(10_000, 5_001), "image/png")).toBeUndefined();
    expect(decodableImage(pngHeader(10, 10), "image/jpeg")).toBeUndefined();
    expect(decodableImage(jpegHeader(30_000, 30_000), "image/jpeg")).toBeUndefined();
  });
});
