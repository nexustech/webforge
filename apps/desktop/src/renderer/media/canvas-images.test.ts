import type { ImageMeta, MediaId, MediaMeta } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { canvasImage, connectCanvasImages } from "./canvas-images.js";
import { addMedia, cropMedia, setFocalPoint } from "./media-commands.js";

const photo: ImageMeta = {
  id: "photo" as MediaId,
  hash: "a".repeat(64),
  name: "shop",
  fileName: "shop.jpg",
  kind: "image",
  mimeType: "image/jpeg",
  width: 1600,
  height: 1000,
  alt: "Our shop",
};
const prices: MediaMeta = {
  id: "prices" as MediaId,
  hash: "b".repeat(64),
  name: "prices",
  fileName: "prices.pdf",
  kind: "file",
  mimeType: "application/pdf",
};

describe("canvasImage", () => {
  it("shows the original through the media scheme, at its size, with its alt text", () => {
    expect(canvasImage(photo)).toEqual({
      sources: [],
      src: `webforge-media://original/${photo.hash}`,
      fallback: { type: "image/jpeg", srcset: `webforge-media://original/${photo.hash} 1600w` },
      width: 1600,
      height: 1000,
      alt: "Our shop",
    });
  });

  it("keeps the focal point in view", () => {
    expect(canvasImage({ ...photo, focal: { x: 0.25, y: 0.6 } })).toMatchObject({
      objectPosition: "25% 60%",
    });
  });

  it("shows a crop as its shape, cut around where it sits", () => {
    // The square preset around x = 0.6: x 0.2875 of a free span 0.375 → 76.7%.
    expect(
      canvasImage({ ...photo, crop: { x: 0.2875, y: 0, width: 0.625, height: 1 } }),
    ).toMatchObject({
      width: 1000,
      height: 1000,
      aspectRatio: "1000 / 1000",
      objectPosition: "76.7% 50%",
    });
    expect(
      canvasImage({
        ...photo,
        focal: { x: 0.5, y: 0.2 },
        crop: { x: 0, y: 0.05, width: 1, height: 0.9 },
      }),
    ).toMatchObject({ aspectRatio: "1600 / 900", objectPosition: "50% 50%" });
  });
});

describe("connectCanvasImages", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives the canvas the site's images, again once Media has changed and settled", () => {
    vi.useFakeTimers();
    const session = sessionWith();
    const engine = { setImages: vi.fn() };
    const stop = connectCanvasImages(engine, session);

    expect(engine.setImages).toHaveBeenCalledTimes(1);
    // An Image element without its image says where to choose one (2.9).
    expect(engine.setImages.mock.calls[0]?.[1]?.()).toBe(
      "No image yet: choose one in the Edit panel",
    );
    expect(engine.setImages.mock.calls[0]?.[0]("photo")).toMatchObject({
      alt: "Image deleted from Media",
    });

    addMedia(session, [photo, prices]);
    expect(engine.setImages).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(150);
    expect(engine.setImages).toHaveBeenCalledTimes(2);
    const resolve = engine.setImages.mock.calls[1]?.[0];
    expect(resolve("photo")).toMatchObject({ alt: "Our shop" });
    // A file isn't an image; an image no longer in Media shows a placeholder.
    expect(resolve("prices")).toBeNull();
    expect(resolve("missing")).toMatchObject({
      src: expect.stringMatching(/^data:image\/svg\+xml,/),
      alt: "Image deleted from Media",
    });

    // Changes in quick succession draw the page once.
    setFocalPoint(session, photo.id, { x: 0.2, y: 0.5 });
    vi.advanceTimersByTime(100);
    cropMedia(session, photo.id, "square");
    vi.advanceTimersByTime(150);
    expect(engine.setImages).toHaveBeenCalledTimes(3);

    // A change elsewhere in the site doesn't draw the page again.
    session.edit("page", "Renamed site", (draft) => {
      draft.settings.general.name = "Rosa's";
    });
    vi.advanceTimersByTime(150);
    expect(engine.setImages).toHaveBeenCalledTimes(3);

    cropMedia(session, photo.id, "original");
    stop();
    vi.advanceTimersByTime(150);
    expect(engine.setImages).toHaveBeenCalledTimes(3);
  });
});
