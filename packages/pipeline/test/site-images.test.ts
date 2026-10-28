import { createHash } from "node:crypto";
import type { SiteSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { beforeAll, describe, expect, it } from "vitest";
import { type BuildEvent, type BuiltSite, buildSite } from "../src/build.js";
import { createMemoryImageCache } from "../src/memory-image-cache.js";
import { loadNodeResources } from "../src/node-resources.js";
import type { PipelineResources } from "../src/resources.js";

let resources: PipelineResources;
/** One build of the sample site with its site images, and the cache it filled, shared below. */
let built: BuiltSite;
const imageCache = createMemoryImageCache(64 * 1024 * 1024);

beforeAll(async () => {
  resources = await loadNodeResources();
  built = await buildSite(withSiteImages(), siteLibrary, { ...resources, imageCache });
}, scaledTestTimeout(120_000));

const text = (site: BuiltSite, path: string) => new TextDecoder().decode(site.files.get(path));

/** A PNG's width and height, from its header. */
function pngSize(data: Uint8Array | undefined): readonly [number, number] {
  if (data === undefined) throw new Error("No such file");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

/** A JPEG's width and height, from its frame header. */
function jpegSize(data: Uint8Array | undefined): readonly [number, number] {
  if (data === undefined) throw new Error("No such file");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let at = 2;
  while (at + 9 < data.length) {
    const marker = data[at + 1] ?? 0;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return [view.getUint16(at + 7), view.getUint16(at + 5)];
    }
    at += 2 + view.getUint16(at + 2);
  }
  throw new Error("No frame header");
}

/** The sizes an `.ico` holds, from its directory. */
function icoSizes(data: Uint8Array | undefined): number[] {
  if (data === undefined) throw new Error("No such file");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  expect([view.getUint16(0, true), view.getUint16(2, true)]).toEqual([0, 1]);
  return Array.from({ length: view.getUint16(4, true) }, (_, at) => view.getUint8(6 + 16 * at));
}

/** The sample site with its photo (1600 × 1000) as the icon, and the About page's share picture. */
function withSiteImages(change: Partial<SiteSnapshot["media"][number]> = {}): SiteSnapshot {
  const site = sampleSite();
  return {
    ...site,
    icon: "hero-photo",
    media: site.media.map((item) => ({ ...item, ...change })),
    pages: site.pages.map((page) =>
      page.path === "about" ? { ...page, shareImage: "hero-photo" } : page,
    ),
  };
}

describe("buildSite: the favicon set and share pictures (3.4)", () => {
  it("makes the favicon set from Site Settings' icon, and links it from every page", () => {
    expect(icoSizes(built.files.get("favicon.ico"))).toEqual([16, 32, 48]);
    expect(pngSize(built.files.get("apple-touch-icon.png"))).toEqual([180, 180]);
    expect(pngSize(built.files.get("assets/icons/icon-192.png"))).toEqual([192, 192]);
    expect(pngSize(built.files.get("assets/icons/icon-512.png"))).toEqual([512, 512]);
    // Linked after the stylesheet, in the icon set's order.
    const head = text(built, "about.html");
    expect(head).toContain(
      [
        '<link rel="icon" href="favicon.ico" sizes="16x16 32x32 48x48">',
        '<link rel="apple-touch-icon" type="image/png" sizes="180x180" href="apple-touch-icon.png">',
        '<link rel="icon" type="image/png" sizes="192x192" href="assets/icons/icon-192.png">',
      ].join("\n  "),
    );
    expect(head).not.toContain("icon-512");
    // The whole set, for 3.5's web app manifest.
    expect(built.icons).toEqual([
      { path: "favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon", link: "icon" },
      {
        path: "apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        link: "apple-touch-icon",
      },
      { path: "assets/icons/icon-192.png", sizes: "192x192", type: "image/png", link: "icon" },
      { path: "assets/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ]);
  });

  it("cuts each page's share picture to 1200 × 630, for 3.5's og:image", () => {
    expect(jpegSize(built.files.get("assets/img/hero-share.jpg"))).toEqual([1200, 630]);
    expect([...built.shareImages]).toEqual([["about", "assets/img/hero-share.jpg"]]);
  });

  it(
    "never makes an image larger: a small icon gives only the sizes it covers",
    async () => {
      // A 40 × 40 cut of the photo.
      const small = await buildSite(
        withSiteImages({ crop: { x: 0, y: 0, width: 0.025, height: 0.04 } }),
        siteLibrary,
        resources,
      );

      expect(icoSizes(small.files.get("favicon.ico"))).toEqual([16, 32]);
      expect(small.files.has("apple-touch-icon.png")).toBe(false);
      expect(small.files.has("assets/icons/icon-192.png")).toBe(false);
      expect(text(small, "index.html")).not.toContain("apple-touch-icon");
      expect(small.icons).toEqual([
        { path: "favicon.ico", sizes: "16x16 32x32", type: "image/x-icon", link: "icon" },
      ]);
      // The share picture is the cut's own size, at 1.91 : 1.
      expect(jpegSize(small.files.get("assets/img/hero-share.jpg"))).toEqual([40, 21]);
    },
    scaledTestTimeout(60_000),
  );

  it(
    "warns of an icon too small for a favicon, known from the cache without reading it again",
    async () => {
      // A 10 × 10 cut of the photo, named by its hash, its bytes read only when asked.
      const site = withSiteImages({ crop: { x: 0, y: 0, width: 0.00625, height: 0.01 } });
      const photo = site.media[0]?.data ?? new Uint8Array();
      const hash = createHash("sha256").update(photo).digest("hex");
      const byHash = {
        ...site,
        media: site.media.map(({ data: _data, ...item }) => ({ ...item, hash })),
      };
      const cache = createMemoryImageCache(16 * 1024 * 1024);
      let reads = 0;
      const counted = {
        ...resources,
        imageCache: cache,
        readMedia: async () => {
          reads += 1;
          return { data: photo, mime: "image/jpeg" as const };
        },
      };

      const first = await buildSite(byHash, siteLibrary, counted);
      const afterFirst = reads;
      const second = await buildSite(byHash, siteLibrary, counted);

      for (const tiny of [first, second]) {
        expect(tiny.files.has("favicon.ico")).toBe(false);
        expect(tiny.icons).toEqual([]);
        expect(text(tiny, "index.html")).not.toContain('rel="icon"');
        expect(tiny.report.warnings).toContainEqual({
          code: "small-icon",
          page: "",
          detail: "hero-photo",
        });
      }
      // The second build knew from the icon's empty plan that it makes nothing, and read nothing
      // (R15): the page images and share picture came from the cache too.
      expect(afterFirst).toBeGreaterThan(0);
      expect(reads).toBe(afterFirst);
    },
    scaledTestTimeout(60_000),
  );

  it(
    "counts the favicon set and each share picture in the images stage's progress",
    async () => {
      const events: BuildEvent[] = [];

      await buildSite(
        withSiteImages(),
        siteLibrary,
        { ...resources, imageCache },
        {
          onProgress: (event) => events.push(event),
        },
      );

      // The photo the pages place, then the icon, then the About page's share picture.
      expect(events.filter((event) => event.stage === "images")).toEqual([
        { stage: "images", done: 0, total: 3 },
        { stage: "images", done: 1, total: 3 },
        { stage: "images", done: 2, total: 3 },
      ]);
    },
    scaledTestTimeout(60_000),
  );

  it(
    "reads and encodes nothing again with the image cache",
    async () => {
      const site = withSiteImages();
      let reads = 0;
      // The photo named by its hash, its bytes read only when asked: count the reads.
      const photo = site.media[0]?.data ?? new Uint8Array();
      const hash = createHash("sha256").update(photo).digest("hex");
      const byHash = {
        ...site,
        media: site.media.map(({ data: _data, ...item }) => ({ ...item, hash })),
      };
      const second = await buildSite(byHash, siteLibrary, {
        ...resources,
        imageCache,
        readMedia: async () => {
          reads += 1;
          return { data: photo, mime: "image/jpeg" };
        },
      });

      for (const path of ["favicon.ico", "apple-touch-icon.png", "assets/img/hero-share.jpg"]) {
        expect(second.files.get(path), path).toEqual(built.files.get(path));
      }
      // The icon set is known from the cache too.
      expect(second.icons).toEqual(built.icons);
      // Every icon, the share picture and the page images came from the cache.
      expect(reads).toBe(0);
    },
    scaledTestTimeout(60_000),
  );

  it(
    "leaves out a share picture deleted from Media, with a warning, and needs nothing unset",
    async () => {
      const site = withSiteImages();
      const deleted = { ...site, media: [] };

      const without = await buildSite(deleted, siteLibrary, resources);

      expect(without.report.warnings).toContainEqual({
        code: "missing-image",
        page: "about",
        detail: "hero-photo",
      });
      expect(without.shareImages.size).toBe(0);
      expect(without.files.has("favicon.ico")).toBe(false);
      // The icon too: the site has no favicon, and the report says why.
      expect(without.report.warnings).toContainEqual({
        code: "missing-icon",
        page: "",
        detail: "hero-photo",
      });
      // Without an icon or a share picture, nothing changes (the golden files say so too).
      const plain = await buildSite(sampleSite(), siteLibrary, { ...resources, imageCache });
      expect(text(plain, "index.html")).not.toContain('rel="icon"');
      expect(plain.shareImages.size).toBe(0);
    },
    scaledTestTimeout(60_000),
  );
});
