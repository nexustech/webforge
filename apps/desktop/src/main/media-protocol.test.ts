import { describe, expect, it, vi } from "vitest";
import { createMediaResponder } from "./media-protocol.js";

const PHOTO = "a".repeat(64);
const PRICES = "b".repeat(64);
const photo = { mime: "image/jpeg", data: new Uint8Array([0xff, 0xd8, 0xff]) };
const blobs = new Map([
  [PHOTO, photo],
  [PRICES, { mime: "application/pdf", data: new Uint8Array([0x25]) }],
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

  it("makes a thumbnail once and serves it as WebP", async () => {
    const { respond, makeThumbnail } = setUp();

    const first = await respond(`webforge-media://thumbnail/${PHOTO}`);
    const second = await respond(`webforge-media://thumbnail/${PHOTO}`);

    expect(first.headers.get("Content-Type")).toBe("image/webp");
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
