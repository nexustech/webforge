import type { MediaId, MenuItemId, NodeDoc, PageId, SiteSnapshot } from "@webforge/model";
import { DEFAULT_THEME } from "@webforge/model";
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
      // The price list the About page links to is one of them (files/price-list.pdf, 1.28).
      files: 15,
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
    // The only absolute URLs are the user's own outbound links: in the menu and in the text.
    expect(index.match(/(?:src|href|srcSet)="[a-z]+:/gi)).toEqual(['href="https:', 'href="https:']);
    expect(index).not.toContain('type="module"');
  });

  it("styles a dropdown to open on focus without the script (F-ED-17)", () => {
    const css = text(built, [...built.files.keys()].find((path) => path.endsWith(".css")) ?? "");

    expect(css).toContain("focus-within");
    expect(css).toMatch(/data-wf-ready/);
  });

  it("compiles readable CSS with daisyUI, the site theme, the fonts and only the classes used", () => {
    const css = text(built, fileNamed(built, /^assets\/css\//));

    expect(css).toContain("/*! tailwindcss v4");
    expect(css).toContain('[data-theme="cupcake"]');
    expect(css).toContain('src: url("../fonts/inter-latin-wght-normal.woff2") format("woff2");');
    expect(css).toContain(".md\\:menu-horizontal");
    expect(css).toContain(".data-open\\:flex");
    expect(css).toContain(".collapse-arrow");
    expect(css).not.toContain(".carousel");
    expect(css).not.toContain('[data-theme="dracula"]');
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
      // Added to the (edited) menu, as the Pages panel adds a new page.
      menu: {
        follows: "custom",
        items: [
          ...(base.menu?.items ?? []),
          { id: "cakes" as MenuItemId, kind: "page", pageId: "cakes" as PageId, hidden: false },
        ],
      },
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
    theme: { ...DEFAULT_THEME, preset: "light" },
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

describe("buildSite: a value bound on several pages (1.17 acceptance)", () => {
  it("shows the same Site Settings value on every page, and a new one everywhere at once", async () => {
    const heading = (id: string) => ({
      type: "Heading",
      props: { id, text: "Typed", bindings: { text: "contact.phone" } },
    });
    const base = siteWith([], {
      pages: ["index", "about", "contact"].map((path) => ({
        id: path,
        path,
        title: path,
        doc: { root: { props: {} }, content: [heading(`h-${path}`)] },
      })),
    });
    const html = async (phone: string) => {
      const built = await buildSite(
        { ...base, settings: { "contact.phone": phone } },
        siteLibrary,
        resources,
      );
      return ["index", "about", "contact"].map((path) =>
        new TextDecoder().decode(built.files.get(`${path}.html`)),
      );
    };

    for (const page of await html("+44 1234 567890")) expect(page).toContain("+44 1234 567890");
    for (const page of await html("+44 9876 543210")) {
      expect(page).toContain("+44 9876 543210");
      expect(page).not.toContain("+44 1234 567890");
    }
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

  it("points links in rich text at pages by relative path, ../ in a folder, # for a deleted page", async () => {
    const richText = (id: string) => ({
      type: "Text",
      props: {
        id,
        text:
          '<p><a href="webforge:page/home">Home</a> <a href="webforge:page/menu#cakes">Cakes</a> ' +
          '<a href="webforge:page/gone">Old</a></p>',
      },
    });
    const site = siteWith([richText("t")], {
      pages: [
        {
          id: "home",
          path: "index",
          title: "Home",
          doc: { root: { props: {} }, content: [richText("t")] },
        },
        { id: "menu", path: "menu", title: "Menu", doc: { root: { props: {} }, content: [] } },
        {
          id: "cakes",
          path: "services/cakes",
          title: "Cakes",
          doc: { root: { props: {} }, content: [richText("c")] },
        },
      ],
    });

    const result = await buildSite(site, siteLibrary, resources);

    expect(text(result, "index.html")).toContain(
      '<a href="index.html">Home</a> <a href="menu.html#cakes">Cakes</a> <a href="#">Old</a>',
    );
    expect(text(result, "services/cakes.html")).toContain(
      '<a href="../index.html">Home</a> <a href="../menu.html#cakes">Cakes</a> <a href="#">Old</a>',
    );
    expect(result.report.warnings).toEqual([
      { code: "broken-link", page: "index", detail: "gone" },
      { code: "broken-link", page: "services/cakes", detail: "gone" },
    ]);
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

describe("buildSite: documents (1.28)", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\nprice list");
  const sheet = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
  const documents = [
    { id: "prices", name: "price-list", mimeType: "application/pdf" as const, data: pdf },
    {
      id: "stock",
      name: "stock",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" as const,
      data: sheet,
    },
  ];
  const heroLinkingTo = (mediaId: string, extra: Record<string, boolean> = {}): NodeDoc => ({
    type: "Hero",
    props: {
      id: "h",
      title: "Our prices",
      buttonLabel: "Price list",
      buttonLink: { kind: "file", mediaId, ...extra },
    },
  });

  it("copies linked documents unchanged to files/, and only those, with relative links", async () => {
    const site = siteWith([heroLinkingTo("prices", { newTab: true })], {
      documents,
      pages: [
        {
          id: "home",
          path: "index",
          title: "Home",
          doc: { root: { props: {} }, content: [heroLinkingTo("prices", { newTab: true })] },
        },
        {
          id: "menu",
          path: "shop/menu",
          title: "Menu",
          doc: { root: { props: {} }, content: [heroLinkingTo("prices", { download: true })] },
        },
      ],
    });

    const output = await buildSite(site, siteLibrary, resources);

    expect([...(output.files.get("files/price-list.pdf") ?? [])]).toEqual([...pdf]);
    // The spreadsheet is in Media but nothing links to it.
    expect([...output.files.keys()].filter((path) => path.startsWith("files/"))).toEqual([
      "files/price-list.pdf",
    ]);
    expect(text(output, "index.html")).toContain(
      'href="files/price-list.pdf" target="_blank" rel="noopener"',
    );
    expect(text(output, "shop/menu.html")).toContain('href="../files/price-list.pdf" download=""');
    expect(output.report.warnings).toEqual([]);
  });

  it("styles a margin set for one device on that device only (1.32)", async () => {
    const heading: NodeDoc = {
      type: "Heading",
      props: {
        id: "h",
        text: "Prices",
        margin: { $responsive: { desktop: { top: "l" }, mobile: { top: "s" } } },
      },
    };
    const output = await buildSite(siteWith([heading]), siteLibrary, resources);
    const css = text(output, fileNamed(output, /^assets\/css\//));

    expect(text(output, "index.html")).toContain("max-md:mt-4 md:mt-16");
    expect(css).toMatch(/@media \(width < 48rem\) \{\s*\.max-md\\:mt-4 \{/);
    expect(css).toMatch(/@media \(width >= 48rem\) \{\s*\.md\\:mt-16 \{/);
  });

  it("styles an element's own hex colours, as Tailwind arbitrary classes (2.1)", async () => {
    const heading: NodeDoc = {
      type: "Heading",
      props: {
        id: "h",
        text: "Prices",
        advanced: { className: "bg-[#1f6feb] text-[#abcdef]/50" },
      },
    };
    const output = await buildSite(siteWith([heading]), siteLibrary, resources);
    const css = text(output, fileNamed(output, /^assets\/css\//));

    expect(text(output, "index.html")).toContain("bg-[#1f6feb] text-[#abcdef]/50");
    expect(css).toMatch(/\.bg-\\\[\\#1f6feb\\\] \{\s*background-color: #1f6feb;/);
    expect(css).toMatch(/\.text-\\\[\\#abcdef\\\]\\\/50 \{[^}]*#abcdef/);
  });

  it("warns about a link to a document deleted from Media, and keeps building", async () => {
    const output = await buildSite(
      siteWith([heroLinkingTo("gone", { download: true })], { documents }),
      siteLibrary,
      resources,
    );

    expect(output.report.warnings).toEqual([
      { code: "broken-link", page: "index", detail: "gone" },
    ]);
    // Not `download`: that would save this page instead.
    expect(text(output, "index.html")).toContain('<a class="btn btn-primary" href="#">');
    expect([...output.files.keys()].some((path) => path.startsWith("files/"))).toBe(false);
  });

  it("points rich text's document links at files/ from a page in a folder", async () => {
    const text_: NodeDoc = {
      type: "Text",
      props: {
        id: "t",
        text:
          '<p>See <a href="webforge:file/prices?download">our prices</a> or ' +
          '<a target="_blank" href="webforge:file/prices">open them</a>.</p>',
      },
    };
    const site = siteWith([], {
      documents,
      pages: [
        { id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } },
        {
          id: "cakes",
          path: "shop/cakes",
          title: "Cakes",
          doc: { root: { props: {} }, content: [text_] },
        },
      ],
    });

    const output = await buildSite(site, siteLibrary, resources);

    expect(text(output, "shop/cakes.html")).toContain(
      '<a href="../files/price-list.pdf" download>our prices</a> or ' +
        '<a href="../files/price-list.pdf" target="_blank" rel="noopener">open them</a>',
    );
    expect([...(output.files.get("files/price-list.pdf") ?? [])]).toEqual([...pdf]);
    expect(output.report.warnings).toEqual([]);
  });

  it("copies a document the navigation menu links to, and links to it from the Header", async () => {
    const site = siteWith([], {
      documents,
      layout: {
        header: [{ type: "Header", props: { id: "header", siteName: "Test" } }],
        footer: [],
      },
      menu: {
        follows: "custom",
        items: [
          {
            id: "m" as MenuItemId,
            kind: "link",
            label: "Stock list",
            link: { kind: "file", mediaId: "stock" as MediaId, download: true },
            hidden: false,
          },
        ],
      },
    });

    const output = await buildSite(site, siteLibrary, resources);

    expect([...(output.files.get("files/stock.xlsx") ?? [])]).toEqual([...sheet]);
    expect(text(output, "index.html")).toContain(
      '<a href="files/stock.xlsx" download="">Stock list</a>',
    );
    expect(output.report.warnings).toEqual([]);
  });
});
