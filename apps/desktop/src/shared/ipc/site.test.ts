import { createSite, type MediaId } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { exportRequestFor } from "./site.js";

describe("exportRequestFor", () => {
  it("names the site's images by hash, with their alt text, focal point and crop", () => {
    const site = createSite({
      name: "Rosa's Bakery",
      language: "en-GB",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });
    site.media = {
      ["hero" as MediaId]: {
        id: "hero" as MediaId,
        hash: "a".repeat(64),
        name: "hero",
        fileName: "hero.jpg",
        kind: "image",
        mimeType: "image/jpeg",
        width: 1600,
        height: 1000,
        alt: "Our shop",
        focal: { x: 0.3, y: 0.5 },
      },
      ["prices" as MediaId]: {
        id: "prices" as MediaId,
        hash: "b".repeat(64),
        name: "prices",
        fileName: "prices.pdf",
        kind: "file",
        mimeType: "application/pdf",
      },
    };

    const request = exportRequestFor(site);

    expect(request.snapshot.media).toEqual([]);
    expect(request.media).toEqual([
      {
        id: "hero",
        name: "hero",
        mimeType: "image/jpeg",
        hash: "a".repeat(64),
        alt: "Our shop",
        focal: { x: 0.3, y: 0.5 },
      },
    ]);
  });
});
