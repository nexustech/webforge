import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { beforeAll, describe, expect, it } from "vitest";
import { type BuiltSite, buildSite } from "../src/build.js";
import { plannedImage } from "../src/images.js";
import { itemHtml } from "../src/item-html.js";
import { loadNodeResources } from "../src/node-resources.js";

let built: BuiltSite;

beforeAll(async () => {
  built = await buildSite(sampleSite(), siteLibrary, await loadNodeResources());
}, scaledTestTimeout(60_000));

/** The sample site's hero photo's size in Media. */
const SIZES = new Map([["hero-photo", { width: 1600, height: 1000 }]]);

/** HTML without the whitespace formatting puts between tags. */
const flat = (html: string) => html.replace(/>\s+</g, "><").trim();

const page = (path: string) => flat(new TextDecoder().decode(built.files.get(path)));

describe("itemHtml (3.14)", () => {
  it("writes an item as the export does: its picture, links and first-section loading", () => {
    const hero = itemHtml(sampleSite(), siteLibrary, SIZES, "home", "hero");
    const intro = itemHtml(sampleSite(), siteLibrary, SIZES, "home", "intro");
    const about = itemHtml(sampleSite(), siteLibrary, SIZES, "about", "about");

    for (const [html, path] of [
      [hero, "index.html"],
      [intro, "index.html"],
      [about, "about.html"],
    ] as const) {
      expect(html).toBeDefined();
      expect(page(path)).toContain(flat(html ?? ""));
    }
    // Readable, as the export is (X4).
    expect(hero?.split("\n").length).toBeGreaterThan(3);
    expect(hero).toContain('fetchPriority="high"');
    expect(about).toContain("files/price-list.pdf");
  });

  it("finds an item in the Header the page shows", () => {
    expect(page("index.html")).toContain(
      flat(itemHtml(sampleSite(), siteLibrary, SIZES, "home", "header") ?? "missing"),
    );
  });

  it("writes nothing for a hidden item, and gives up on an unknown page or item", () => {
    const site = sampleSite();
    const home = site.pages.find((each) => each.id === "home");
    if (home === undefined) throw new Error("no home page");
    const [hero, ...rest] = home.doc.content;
    if (hero === undefined) throw new Error("no hero");
    const hidden = {
      ...site,
      pages: site.pages.map((each) =>
        each === home
          ? {
              ...each,
              doc: {
                ...each.doc,
                content: [{ ...hero, props: { ...hero.props, hidden: true } }, ...rest],
              },
            }
          : each,
      ),
    };

    expect(itemHtml(hidden, siteLibrary, SIZES, "home", "hero")).toBe("");
    expect(itemHtml(site, siteLibrary, SIZES, "nowhere", "hero")).toBeUndefined();
    expect(itemHtml(site, siteLibrary, SIZES, "home", "nothing")).toBeUndefined();
  });
});

describe("plannedImage (3.14)", () => {
  const item = {
    id: "photo",
    name: "cakes",
    mimeType: "image/jpeg",
    data: new Uint8Array(),
  } as const;

  it("names and sizes an image's files as the export does, the crop first", () => {
    const image = plannedImage(
      { ...item, crop: { x: 0, y: 0, width: 0.5, height: 1 } },
      { width: 2400, height: 1200 },
    );

    // Cut to 1200 × 1200, then at each width up to it.
    expect(image.width).toBe(1200);
    expect(image.height).toBe(1200);
    expect(image.src).toBe("assets/img/cakes-1200.jpg");
    expect(image.sources[0]?.srcset).toMatch(/^assets\/img\/cakes-\d+\.webp \d+w/);
    expect(image.fallback.type).toBe("image/jpeg");
  });

  it("takes a PNG's fallback to be a PNG, for its transparency", () => {
    const image = plannedImage({ ...item, mimeType: "image/png" }, { width: 300, height: 200 });

    expect(image.src).toBe("assets/img/cakes-300.png");
    expect(image.fallback.type).toBe("image/png");
  });
});
