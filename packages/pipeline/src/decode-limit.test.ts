import { deflateSync } from "node:zlib";
import { heroPhoto } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { beforeAll, describe, expect, it } from "vitest";
import { decodeOriginal, makeThumbnail, UndecodableImageError } from "./images.js";
import { loadNodeResources } from "./node-resources.js";
import type { CodecModules } from "./resources.js";

let codecs: CodecModules;

beforeAll(async () => {
  codecs = (await loadNodeResources()).codecs;
}, scaledTestTimeout(60_000));

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of bytes) c = (crcTable[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
/** A 1-bit greyscale PNG of `width` x `height`, all black: tiny on disk, huge decoded. */
function bombPng(width: number, height: number): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 0; // greyscale
  const raw = Buffer.alloc((1 + Math.ceil(width / 8)) * height); // filter 0, zero pixels
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ]);
}

// The decode limit on Media from a site file (security review S12, #651): an image claiming more
// than 50 megapixels is refused before it is decoded, as import refuses it. From the review's
// `files-2`.

describe("the decode limit on Media from a site file (S12)", () => {
  it(
    "refuses to decode an image over 50 megapixels (as import does)",
    async () => {
      // 8000 x 7000 = 56 megapixels: over the import limit, ~224 MB of RGBA once decoded.
      const bomb = bombPng(8000, 7000);
      expect(bomb.byteLength).toBeLessThan(100_000);
      await expect(makeThumbnail(bomb, "image/png", codecs)).rejects.toThrow(UndecodableImageError);
    },
    scaledTestTimeout(120_000),
  );

  it("refuses an image that isn't the type it's stored as, or has no readable size", async () => {
    const png = bombPng(2, 2);
    await expect(decodeOriginal(png, "image/jpeg")).rejects.toThrow(UndecodableImageError);
    await expect(decodeOriginal(png.subarray(0, 12), "image/png")).rejects.toThrow(
      UndecodableImageError,
    );
  });

  it("still makes a thumbnail of an image within the limit", async () => {
    const thumbnail = await makeThumbnail(heroPhoto(), "image/jpeg", codecs);
    // A WebP: RIFF.
    expect([...thumbnail.subarray(0, 4)]).toEqual([0x52, 0x49, 0x46, 0x46]);
  });
});
