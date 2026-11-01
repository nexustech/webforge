import { createSite, type MediaId, type MediaMeta, siteToSnapshot } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { siteContentFor, siteSnapshotFor } from "./site-content.js";

const icon: MediaMeta = {
  id: "logo" as MediaId,
  kind: "image",
  hash: "a".repeat(64),
  name: "logo",
  fileName: "logo.png",
  mimeType: "image/png",
  width: 512,
  height: 512,
  alt: "Rosa's Bakery",
};
const unused: MediaMeta = { ...icon, id: "spare" as MediaId, hash: "b".repeat(64), name: "spare" };

/** A new site whose Site Settings' icon is `icon`, with an image nothing uses beside it. */
function site() {
  const doc = createSite({
    name: "Rosa's",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Oops",
  });
  doc.media = { [icon.id]: icon, [unused.id]: unused };
  doc.settings.general.icon = icon.id;
  return doc;
}

describe("siteContentFor (ADR 0018 §3)", () => {
  it("names the images the site uses by hash, without their bytes, and no others", () => {
    const content = siteContentFor(site(), siteLibrary);

    expect(content.media).toEqual([
      {
        id: "logo",
        name: "logo",
        mimeType: "image/png",
        hash: "a".repeat(64),
        alt: "Rosa's Bakery",
      },
    ]);
    expect(content.documents).toEqual([]);
  });
});

describe("siteSnapshotFor", () => {
  it("is the site's snapshot with those images and documents, as the worker builds it", () => {
    const doc = site();
    const { media, documents } = siteContentFor(doc, siteLibrary);

    expect(siteSnapshotFor(doc, siteLibrary)).toEqual({
      ...siteToSnapshot(doc, new Map()),
      media,
      documents,
    });
  });
});
