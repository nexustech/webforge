import type { NodeDoc, SiteSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import { type BuiltSite, buildSite } from "../src/build.js";
import { loadNodeResources } from "../src/node-resources.js";
import type { PipelineResources } from "../src/resources.js";

let resources: PipelineResources;
let built: BuiltSite;

beforeAll(async () => {
  resources = await loadNodeResources();
  built = await buildSite(sampleSite(), siteLibrary, resources);
}, 60_000);

const text = (site: BuiltSite, path: string) => new TextDecoder().decode(site.files.get(path));
const fileNamed = (site: BuiltSite, pattern: RegExp) =>
  [...site.files.keys()].find((path) => pattern.test(path)) ?? "";

describe("buildSite: golden output (X4: byte-stable, readable)", () => {
  it("writes the expected files", () => {
    expect([...built.files.keys()]).toMatchSnapshot();
    expect({ ...built.report, bytes: undefined }).toEqual({
      pages: 2,
      files: 12,
      bytes: undefined,
      warnings: [],
    });
  });

  it("produces the same HTML as the reviewed golden files", async () => {
    await expect(text(built, "index.html")).toMatchFileSnapshot("golden/index.html");
    await expect(text(built, "about.html")).toMatchFileSnapshot("golden/about.html");
    await expect(text(built, fileNamed(built, /^assets\/js\//))).toMatchFileSnapshot(
      "golden/webforge.js",
    );
  });

  it("is byte-stable: building again gives identical files", async () => {
    const again = await buildSite(sampleSite(), siteLibrary, resources);

    expect([...again.files.keys()]).toEqual([...built.files.keys()]);
    for (const [path, data] of built.files) {
      expect(again.files.get(path), path).toEqual(data);
    }
  }, 60_000);
});

describe("buildSite: self-contained output (X1, C8)", () => {
  it("links pages, styles, scripts and images with relative URLs only", () => {
    const index = text(built, "index.html");

    expect(index).toMatch(/<link rel="stylesheet" href="assets\/css\/site\.[0-9a-f]{10}\.css">/);
    expect(index).toMatch(/<script defer src="assets\/js\/webforge\.[0-9a-f]{10}\.js"><\/script>/);
    expect(index).toContain('<a href="about.html">About us</a>');
    // The only absolute URLs are the SVG namespace and the user's own outbound link.
    expect(index.match(/(?:src|href|srcSet)="[a-z]+:/gi)).toEqual(['href="https:']);
    expect(index).not.toContain('type="module"');
  });

  it("compiles readable CSS with daisyUI, the site theme, the fonts and only the classes used", () => {
    const css = text(built, fileNamed(built, /^assets\/css\//));

    expect(css).toContain("/*! tailwindcss v4");
    expect(css).toContain("[data-theme=cupcake]");
    expect(css).toContain('src: url("../fonts/inter-latin-400-normal.woff2") format("woff2");');
    expect(css).toContain(".md\\:menu-horizontal");
    expect(css).toContain(".data-open\\:flex");
    expect(css).toContain(".collapse-arrow");
    expect(css).not.toContain(".carousel");
    expect(css).not.toContain("[data-theme=dracula]");
    expect(css.split("\n").length).toBeGreaterThan(500);
  });

  it("exports each image as WebP plus a JPEG fallback, never wider than the original", () => {
    const images = [...built.files.keys()].filter((path) => path.startsWith("assets/img/"));

    expect(images).toEqual([
      "assets/img/hero-1280.jpg",
      "assets/img/hero-1280.webp",
      "assets/img/hero-1600.jpg",
      "assets/img/hero-1600.webp",
      "assets/img/hero-640.jpg",
      "assets/img/hero-640.webp",
    ]);
    const webp = built.files.get("assets/img/hero-640.webp");
    // RIFF....WEBP
    expect(new TextDecoder().decode(webp?.slice(8, 12))).toBe("WEBP");
    expect(text(built, "index.html")).toContain('width="1600" height="1000"');
  });
});

describe("buildSite: pages in folders", () => {
  it("prefixes every relative URL with ../ for each folder level", async () => {
    const base = sampleSite();
    const site: SiteSnapshot = {
      ...base,
      pages: [
        ...base.pages,
        {
          id: "cakes",
          path: "services/cakes",
          title: "Cakes",
          doc: { root: { props: {} }, content: base.pages[0]?.doc.content.slice(0, 1) ?? [] },
        },
      ],
    };

    const nested = await buildSite(site, siteLibrary, resources);
    const html = text(nested, "services/cakes.html");

    expect(html).toMatch(/href="\.\.\/assets\/css\/site\.[0-9a-f]{10}\.css"/);
    expect(html).toContain('<a href="../index.html">Home</a>');
    expect(html).toContain('<a href="../services/cakes.html" aria-current="page">Cakes</a>');
    expect(html).toContain('srcSet="../assets/img/hero-640.webp 640w');
    expect(html).toContain('src="../assets/img/hero-1600.jpg"');
    expect(html).toContain('<a class="btn btn-primary" href="../about.html">About us</a>');
    expect(html).toContain("<title>Cakes | Rosa's Bakery</title>");
  }, 60_000);
});

describe("buildSite: page settings", () => {
  it("uses navigation labels, leaves hidden pages out of the menu and hides Header or Footer", async () => {
    const base = sampleSite();
    const [home, about] = base.pages;
    if (home === undefined || about === undefined) throw new Error("sample site changed");
    const site: SiteSnapshot = {
      ...base,
      pages: [
        { ...home, navLabel: "Start" },
        { ...about, hideHeader: true, hideFooter: true },
        {
          ...about,
          id: "not-found",
          path: "404",
          title: "Page not found",
          hideFromNavigation: true,
        },
      ],
    };

    const output = await buildSite(site, siteLibrary, resources);
    const homeHtml = text(output, "index.html");
    const aboutHtml = text(output, "about.html");

    expect(homeHtml).toContain('<a href="index.html" aria-current="page">Start</a>');
    expect(homeHtml).toContain('<a href="about.html">About us</a>');
    expect(homeHtml).not.toContain("404.html");
    expect(homeHtml).toContain('class="site-footer');
    expect(aboutHtml).not.toContain("<nav");
    expect(aboutHtml).not.toContain('class="site-footer');
    expect(output.files.has("404.html")).toBe(true);
  }, 60_000);
});

function siteWith(content: NodeDoc[], overrides: Partial<SiteSnapshot> = {}): SiteSnapshot {
  return {
    name: "Test",
    language: "en",
    theme: { name: "light" },
    layout: { header: [], footer: [] },
    pages: [{ id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content } }],
    media: [],
    ...overrides,
  };
}

describe("buildSite: Site Settings values (1.17)", () => {
  it("shows bound values from Site Settings and leaves empty ones out", async () => {
    const site = siteWith([], {
      layout: {
        header: [
          {
            type: "Header",
            props: { id: "h", siteName: "Typed", bindings: { siteName: "general.name" } },
          },
        ],
        footer: [
          {
            type: "Footer",
            props: { id: "f", text: "Typed", bindings: { text: "contact.phone" } },
          },
        ],
      },
      settings: { "general.name": "Rosa's Bakery" },
    });

    const built = await buildSite(site, siteLibrary, resources);
    const index = new TextDecoder().decode(built.files.get("index.html"));

    expect(index).toContain(">Rosa&#x27;s Bakery</a>");
    expect(index).not.toContain("Typed");
  });
});

describe("buildSite: checks (X5)", () => {
  it("warns about links to pages that do not exist and keeps building", async () => {
    const site = siteWith([
      { type: "Hero", props: { id: "h", title: "Hi", buttonLabel: "Go", buttonLink: "contact" } },
    ]);

    const result = await buildSite(site, siteLibrary, resources);

    expect(result.report.warnings).toEqual([
      { code: "broken-link", page: "index", detail: "contact" },
    ]);
    expect(text(result, "index.html")).toContain('<a class="btn btn-primary" href="#">Go</a>');
  });

  it("passes external links through unchanged", async () => {
    const site = siteWith([
      {
        type: "Hero",
        props: { id: "h", title: "Hi", buttonLabel: "Mail", buttonLink: "mailto:rosa@example.com" },
      },
    ]);

    const result = await buildSite(site, siteLibrary, resources);

    expect(text(result, "index.html")).toContain('href="mailto:rosa@example.com"');
  });

  it("adds no script when no component needs one", async () => {
    const result = await buildSite(siteWith([]), siteLibrary, resources);

    expect([...result.files.keys()].some((path) => path.startsWith("assets/js/"))).toBe(false);
    expect(text(result, "index.html")).not.toContain("<script");
  });

  it("fails for an invalid site", async () => {
    const site = siteWith([], { pages: [] });

    await expect(buildSite(site, siteLibrary, resources)).rejects.toMatchObject({
      name: "BuildError",
      code: "invalid-site",
    });
  });

  it("fails for a component type the library does not have", async () => {
    const site = siteWith([{ type: "Carousel", props: { id: "c" } }]);

    await expect(buildSite(site, siteLibrary, resources)).rejects.toMatchObject({
      code: "unknown-component",
    });
  });

  it("leaves out an image deleted from Media, with a warning, instead of failing (1.16)", async () => {
    const site = siteWith([
      { type: "Hero", props: { id: "h", title: "Fresh bread", image: { mediaId: "gone" } } },
    ]);

    const built = await buildSite(site, siteLibrary, resources);

    expect(built.report.warnings).toContainEqual({
      code: "missing-image",
      page: "index",
      detail: "gone",
    });
    const index = new TextDecoder().decode(built.files.get("index.html"));
    expect(index).toContain("Fresh bread");
    expect(index).not.toContain("<img");
    expect([...built.files.keys()].some((path) => path.startsWith("assets/img/"))).toBe(false);
  });
});
