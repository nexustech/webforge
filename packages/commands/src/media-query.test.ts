import type { MediaId, MediaMeta } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { createCommandApi } from "./api.js";
import { setup } from "./api.test-helper.js";

const photo: MediaMeta = {
  id: "media-photo" as MediaId,
  kind: "image",
  hash: "a".repeat(64),
  name: "workshop",
  fileName: "workshop.jpg",
  mimeType: "image/jpeg",
  width: 1600,
  height: 900,
  alt: "The workshop",
  focal: { x: 0.5, y: 0.5 },
};

const prices: MediaMeta = {
  id: "media-prices" as MediaId,
  kind: "file",
  hash: "b".repeat(64),
  name: "prices",
  fileName: "prices.pdf",
  mimeType: "application/pdf",
  size: 52_000,
};

describe("the media query (4.12b, AIB-7)", () => {
  it("lists each picture and file by id, with what an app needs to place it", () => {
    const { host } = setup(true, (doc) => {
      doc.media[photo.id] = photo;
      doc.media[prices.id] = prices;
    });

    expect(createCommandApi(host).query("media", {})).toEqual({
      status: "done",
      data: [
        {
          id: "media-photo",
          fileName: "workshop.jpg",
          kind: "image",
          mimeType: "image/jpeg",
          width: 1600,
          height: 900,
          alt: "The workshop",
        },
        {
          id: "media-prices",
          fileName: "prices.pdf",
          kind: "file",
          mimeType: "application/pdf",
          size: 52_000,
        },
      ],
    });
  });

  it("answers an empty list for a site with no Media, and takes nothing", () => {
    const api = createCommandApi(setup().host);
    expect(api.query("media", {})).toEqual({ status: "done", data: [] });
    expect(api.query("media", { path: "C:/photos" }).status).toBe("invalid");
  });
});
