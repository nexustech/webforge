import { describe, expect, it, vi } from "vitest";
import { createMediaResponder } from "./media-protocol.js";

const PHOTO = "a".repeat(64);
const PRICES = "b".repeat(64);
const HUGE = "1".repeat(64);
const MISLABELLED = "2".repeat(64);
/** The start of a 20 × 10 JPEG: its start-of-frame segment, which says its size. */
const jpegHeader = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x0a, 0x00, 0x14, 0x03, 0, 0, 0, 0,
]);
/** The start of a PNG claiming 30,000 × 30,000 pixels: a few bytes that decode to 3.6 GB. */
const hugePng = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x75,
  0x30, 0, 0, 0x75, 0x30, 8, 6, 0, 0, 0,
]);
const photo = { mime: "image/jpeg", data: jpegHeader };
const blobs = new Map([
  [PHOTO, photo],
  [PRICES, { mime: "application/pdf", data: new Uint8Array([0x25]) }],
  [HUGE, { mime: "image/png", data: hugePng }],
  [MISLABELLED, { mime: "image/png", data: jpegHeader }],
]);

function setUp(
  makeThumbnail = vi.fn<() => Promise<Uint8Array | undefined>>(
    async () => new Uint8Array([1, 2, 3]),
  ),
  cacheSize = 300,
) {
  const respond = createMediaResponder({
    readMedia: async (hash) => blobs.get(hash),
    makeThumbnail,
    cacheSize,
  });
  return { respond, makeThumbnail };
}

const bytes = async (response: Response) => new Uint8Array(await response.arrayBuffer());

describe("createMediaResponder", () => {
  it("serves an image's original bytes by hash", async () => {
    const { respond } = setUp();

    const response = await respond(`webforge-media://original/${PHOTO}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(await bytes(response)).toEqual(photo.data);
  });

  it("serves exactly an image's bytes when they are part of a larger buffer, uncopied (R13b)", async () => {
    // As a pooled Buffer can be: the image sits between other bytes.
    const pooled = new Uint8Array([9, 9, ...jpegHeader, 9, 9, 9]);
    const respond = createMediaResponder({
      readMedia: async () => ({
        mime: "image/jpeg",
        data: pooled.subarray(2, 2 + jpegHeader.length),
      }),
      makeThumbnail: async () => undefined,
    });

    const response = await respond(`webforge-media://original/${PHOTO}`);

    expect(await bytes(response)).toEqual(jpegHeader);
  });

  it("makes a thumbnail once and serves it as WebP", async () => {
    const { respond, makeThumbnail } = setUp();

    const first = await respond(`webforge-media://thumbnail/${PHOTO}`);
    const second = await respond(`webforge-media://thumbnail/${PHOTO}`);

    expect(first.headers.get("Content-Type")).toBe("image/webp");
    // Readable on a canvas, for Theme Studio's palette from an image (2.3b).
    expect(first.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await bytes(second)).toEqual(new Uint8Array([1, 2, 3]));
    expect(makeThumbnail).toHaveBeenCalledTimes(1);
    expect(makeThumbnail).toHaveBeenCalledWith(photo.data, "image/jpeg");
  });

  it("tries a failed thumbnail again, and forgets the least recently used", async () => {
    const makeThumbnail = vi
      .fn<() => Promise<Uint8Array | undefined>>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(new Uint8Array([9]));
    const { respond } = setUp(makeThumbnail, 1);

    expect((await respond(`webforge-media://thumbnail/${PHOTO}`)).status).toBe(404);
    expect((await respond(`webforge-media://thumbnail/${PHOTO}`)).status).toBe(200);
    expect(makeThumbnail).toHaveBeenCalledTimes(2);

    blobs.set("c".repeat(64), photo);
    await respond(`webforge-media://thumbnail/${"c".repeat(64)}`);
    await respond(`webforge-media://thumbnail/${PHOTO}`);
    expect(makeThumbnail).toHaveBeenCalledTimes(4);
  });

  it("serves no image over 50 megapixels or not what it's stored as, nor its thumbnail (S12)", async () => {
    const { respond, makeThumbnail } = setUp();

    for (const hash of [HUGE, MISLABELLED, HUGE]) {
      expect((await respond(`webforge-media://thumbnail/${hash}`)).status).toBe(404);
      // Nor the original, which the canvas would decode: it shows its missing-image placeholder.
      expect((await respond(`webforge-media://original/${hash}`)).status).toBe(404);
    }
    // Refused from its first bytes, and remembered: no decoder ever sees it.
    expect(makeThumbnail).not.toHaveBeenCalled();
  });

  it("answers 404 when the site's file can't be read", async () => {
    const respond = createMediaResponder({
      readMedia: () => {
        throw new Error("database closed");
      },
      makeThumbnail: async () => undefined,
    });

    expect((await respond(`webforge-media://original/${PHOTO}`)).status).toBe(404);
  });

  it("answers 404 for anything but an image of the open site", async () => {
    const { respond } = setUp();

    for (const url of [
      `webforge-media://original/${PRICES}`,
      `webforge-media://original/${"0".repeat(64)}`,
      `webforge-media://original/${PHOTO.toUpperCase()}`,
      `webforge-media://original/../${PHOTO}`,
      `webforge-media://file/${PHOTO}`,
      `webforge-media://original/${PHOTO}?x=1`,
    ]) {
      expect((await respond(url)).status, url).toBe(404);
    }
  });
});
