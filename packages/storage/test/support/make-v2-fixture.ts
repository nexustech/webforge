import { readFileSync, rmSync } from "node:fs";
import { createSite, DEFAULT_THEME, type MediaId, type PageId } from "@webforge/model";
import { ProjectStore } from "../../src/index.js";

// Writes packages/test-utils/fixtures/wforge/v2.wforge, the format 2 fixture (#664): format 1's
// site, with a version for each kind of fact format 2 added. Run once when the format is
// released, never again (the fixture must stay as format 2 wrote it):
//   node --import ./packages/test-utils/src/resolve-ts.ts \
//     packages/storage/test/support/make-v2-fixture.ts <output path>

const output = process.argv[2];
if (output === undefined) {
  throw new Error("Usage: make-v2-fixture.ts <output.wforge>");
}
rmSync(output, { force: true });
const store = ProjectStore.create(output, { name: "Rosa's Bakery" });
const hero = new Uint8Array(
  readFileSync(new URL("../../../test-utils/fixtures/media/hero.jpg", import.meta.url)),
);
const photo = store.putAsset({
  mediaId: "hero0000000000aa",
  data: hero,
  mime: "image/jpeg",
  width: 1600,
  height: 1000,
  originalName: "hero.jpg",
});
const site = createSite({
  name: "Rosa's Bakery",
  language: "en-GB",
  homeTitle: "Home",
  notFoundTitle: "Page not found",
  theme: { ...DEFAULT_THEME, preset: "cupcake" },
  homeDoc: {
    root: { props: {} },
    content: [
      {
        type: "Hero",
        props: {
          id: "hero",
          title: "Baked fresh every morning",
          image: { mediaId: photo.mediaId },
        },
      },
    ],
  },
});
const about = "about00000000000" as PageId;
site.pages[about] = {
  id: about,
  kind: "page",
  slug: "about",
  title: "About us",
  settings: { hideHeader: false, hideFooter: false, hideFromNavigation: false },
  doc: { root: { props: {} }, content: [] },
};
site.pageOrder.splice(1, 0, about);
site.media[photo.mediaId as MediaId] = {
  id: photo.mediaId as MediaId,
  kind: "image",
  hash: photo.hash,
  name: "hero",
  fileName: "hero.jpg",
  mimeType: "image/jpeg",
  width: 1600,
  height: 1000,
  alt: "Green hills under a morning sun",
  focal: { x: 0.5, y: 0.4 },
};
store.saveSite(site);
store.saveVersion("First version", "manual");
store.saveVersion("Before restoring", "before-restore");
// Its picture, a blob of its own: a 1×1 PNG stands in for the page drawn small, which 4.6 makes.
const thumbnailHash = store.putBlob(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
  "image/png",
);
store.saveVersion("Published to Rosa's Bakery", "on-publish", {
  thumbnailHash,
  publishedTo: {
    destinationId: "0d6c2a5e-3f0b-4b8e-9a35-6b1c5a7d2e90",
    publishedAt: "2026-11-01T09:30:00.000Z",
    check: "live",
    deploy: "6544a1b2c3",
  },
});
store.close();
