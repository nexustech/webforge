import { readFileSync, rmSync } from "node:fs";
import { createSite, DEFAULT_THEME, type MediaId, type PageId } from "@webforge/model";
import { ProjectStore } from "../../src/index.js";

// Writes packages/test-utils/fixtures/wforge/v1.wforge, the format 1 fixture. Run once when the
// format is released, never again (the fixture must stay as format 1 wrote it):
//   node --import ./packages/test-utils/src/resolve-ts.ts \
//     packages/storage/test/support/make-v1-fixture.ts <output path>

const output = process.argv[2];
if (output === undefined) {
  throw new Error("Usage: make-v1-fixture.ts <output.wforge>");
}
rmSync(output, { force: true });
const store = ProjectStore.create(output, { name: "Rosa's Bakery" });
const photo = store.putAsset({
  mediaId: "hero0000000000aa",
  // The same photo as `heroPhoto()` in @webforge/test-utils, which only test files may import.
  data: new Uint8Array(
    readFileSync(new URL("../../../test-utils/fixtures/media/hero.jpg", import.meta.url)),
  ),
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
  // Format 1 wrote the theme's name; the script now takes tokens, named as that theme was.
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
store.close();
