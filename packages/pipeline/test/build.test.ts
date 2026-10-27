import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type {
  MediaId,
  MenuItemId,
  NodeDoc,
  PageId,
  SharedSectionId,
  SiteSnapshot,
} from "@webforge/model";
import { createSite, DEFAULT_THEME, newSharedCopy, siteToSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { sampleSite } from "@webforge/test-utils";
import { transform } from "lightningcss";
import { compile } from "tailwindcss";
import { beforeAll, describe, expect, it } from "vitest";
import { type BuildEvent, type BuiltSite, buildSite } from "../src/build.js";
import { tailwindLoaders } from "../src/css.js";
import { loadNodeResources } from "../src/node-resources.js";
import type { ImageCache, PipelineResources } from "../src/resources.js";

const requireFrom = createRequire(import.meta.url);

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
      pages: 3,
      // The price list the About page links to is one of them (files/price-list.pdf, 1.28).
      files: 16,
      bytes: undefined,
      // The second Newsletter has no form address (3.7).
      warnings: [{ code: "form-unset", page: "about", detail: "noAddress" }],
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
    // The only absolute URLs are the user's own outbound links: in the menu (its row on wide
    // screens, its menu on small ones and the Footer's columns, 2.6) and in the text.
    expect(index.match(/(?:src|href|srcSet)="[a-z]+:/gi)).toEqual(Array(4).fill('href="https:'));
    expect(index).not.toContain('type="module"');
  });

  it("opens the menu and its dropdowns without the script: each a <details> (F-ED-17, 2.6)", () => {
    const index = text(built, "index.html");

    expect(index).toContain('<details class="site-menu md:hidden" data-wf-menu="">');
    expect(index).toContain('<details class="site-submenu" data-wf-dropdown="">');
    // No CSS fallback for focus is needed any more.
    expect(text(built, fileNamed(built, /^assets\/css\//))).not.toContain("data-wf-ready");
  });

  it("keeps the sticky header's anchors in view without the script too (F-DS-6)", () => {
    const css = text(built, fileNamed(built, /^assets\/css\//));

    expect(text(built, "index.html")).toContain('data-wf-sticky=""');
    // The header's own class sets the page's scroll padding: `:root:has(<that class>)`.
    expect(css).toMatch(/:root:has\(\.\S*scroll-pt-20\) \{\n\s*scroll-padding-top:/);
    expect(css).toContain("scroll-padding-top: calc(var(--spacing) * 20);");
    // The centred Header is taller on wide screens, its menu below the name: more padding there.
    expect(css).toMatch(
      /@media [^{]*\{\n\s*:root:has\(\.\S*scroll-pt-32\) \{\n\s*scroll-padding-top:/,
    );
    expect(css).toContain(".data-scrolled\\:shadow-md");
    expect(text(built, fileNamed(built, /^assets\/js\//))).toContain("Sticky header (F-DS-6)");
  });

  it("compiles readable CSS with daisyUI, the site theme, the fonts and only the classes used", () => {
    const css = text(built, fileNamed(built, /^assets\/css\//));

    expect(css).toContain("/*! tailwindcss v4");
    expect(css).toContain('[data-theme="cupcake"]');
    expect(css).toContain('src: url("../fonts/inter-latin-wght-normal.woff2") format("woff2");');
    expect(css).toContain(".menu-horizontal");
    expect(css).toContain(".md\\:hidden");
    expect(css).toContain(".collapse-arrow");
    expect(css).not.toContain(".carousel");
    expect(css).not.toContain('[data-theme="dracula"]');
    expect(css.split("\n").length).toBeGreaterThan(500);
  });

  it("links each gallery image to a file the export writes, which opens without the script (2.7a)", () => {
    const about = text(built, "about.html");
    const links = [...about.matchAll(/<a href="([^"]+)"[^>]*data-wf-lightbox-item=""/g)].map(
      (match) => match[1] ?? "",
    );

    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(built.files.has(link), link).toBe(true);
    }
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

describe("buildSite: Custom Code (2.11, F-ED-15)", () => {
  it("writes Custom Code into the page as it is, its classes in the site's CSS", async () => {
    const base = sampleSite();
    const script =
      "<script>\nconst note = `Sale\n  today`;   if (note) window.sold = true;\n</script>";
    const code = `<div class="rounded-full bg-accent">Sale</div>${script}<style>.sale{color:red}</style>`;
    const [home, ...rest] = base.pages;
    if (home === undefined) throw new Error("no home page");
    const custom: NodeDoc = { type: "CustomCode", props: { id: "custom", code } };
    const site: SiteSnapshot = {
      ...base,
      pages: [{ ...home, doc: { ...home.doc, content: [...home.doc.content, custom] } }, ...rest],
    };

    const exported = await buildSite(site, siteLibrary, resources);

    // As written: its markup laid out as the rest of the readable HTML is (X4), and what's in its
    // script and style exactly as typed, not reformatted.
    const page = text(exported, "index.html");
    expect(page.replace(/\s+/g, " ")).toContain(
      '<div class="site-custom-code"> <div class="rounded-full bg-accent">Sale</div> <script>',
    );
    expect(page).toContain(script);
    expect(page).toContain("<style>.sale{color:red}</style>");
    expect(text(exported, fileNamed(exported, /site\.[0-9a-f]+\.css$/))).toContain(".rounded-full");
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

  it("refuses a page or folder named after a Windows device, naming the page (R16)", async () => {
    const page = (path: string, title: string) => ({
      id: path.replaceAll("/", "-"),
      path,
      title,
      doc: { root: { props: {} }, content: [] },
    });
    for (const [path, title] of [
      ["con", "Contact us"],
      ["aux/team", "Our team"],
      ["company/lpt1", "Printing"],
    ] as const) {
      const site = siteWith([], { pages: [page("index", "Home"), page(path, title)] });

      await expect(buildSite(site, siteLibrary, resources)).rejects.toMatchObject({
        name: "BuildError",
        code: "reserved-name",
        page: title,
      });
    }
  });

  it("fails for an invalid site", async () => {
    const site = siteWith([], { pages: [] });

    await expect(buildSite(site, siteLibrary, resources)).rejects.toMatchObject({
      name: "BuildError",
      code: "invalid-site",
    });
  });

  it("fails for a component type the library does not have", async () => {
    const site = siteWith([{ type: "NoSuchComponent", props: { id: "c" } }]);

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

describe("buildSite: the theme's typography (#419)", () => {
  it("sets titles in the heading font and text at the type scale's sizes, the page title smaller on phones", async () => {
    const site: SiteSnapshot = {
      ...sampleSite(),
      theme: {
        ...DEFAULT_THEME,
        preset: "typography",
        fonts: {
          heading: { family: "Lora", fallback: "serif" },
          body: { family: "Work Sans", fallback: "sans-serif" },
        },
        typeScale: {
          ...DEFAULT_THEME.typeScale,
          h1: { size: "6xl", weight: 600, leading: "tight" },
          body: { size: "base", weight: 400, leading: "normal" },
        },
      },
    };

    const exported = await buildSite(site, siteLibrary, resources);

    const page = text(exported, "index.html");
    expect(page).toContain('<h1 class="font-heading text-h1">');
    expect(page).toContain("text-body");
    const css = text(exported, fileNamed(exported, /^assets\/css\//)).replace(/\s+/g, " ");
    expect(css).toContain('--font-heading: "Lora", ui-serif, Georgia, serif;');
    expect(css).toContain("font-family: var(--font-heading);");
    expect(css).toContain("--text-h1: 3.75rem;");
    expect(css).toContain("--text-h1--font-weight: 600;");
    expect(css).toContain("font-size: var(--text-h1);");
    expect(css).toContain("--text-body: 1rem;");
    // A 6xl title is 4xl on phones (capped, so it fits).
    expect(css).toContain("@media (width < 48rem) { :root { --text-h1: 2.25rem; } }");
    // The heading font's files are part of the site.
    expect([...exported.files.keys()].some((path) => /lora/i.test(path))).toBe(true);
  }, 60_000);
});

describe("buildSite: the theme's buttons, shadows and links (#423)", () => {
  it("draws buttons, shadows and links in running text as the theme says", async () => {
    const site: SiteSnapshot = {
      ...sampleSite(),
      theme: {
        ...DEFAULT_THEME,
        preset: "outline",
        buttons: { shape: "square", size: "l", style: "outline" },
        shadow: "none",
        links: { underline: "hover" },
      },
    };

    const exported = await buildSite(site, siteLibrary, resources);

    const css = text(exported, fileNamed(exported, /^assets\/css\//)).replace(/\s+/g, " ");
    // Every button's corners and the default size's height; the main buttons drawn outline.
    expect(css).toContain("--wf-button-radius: 0rem; --wf-button-height: 3rem;");
    expect(css).toContain(
      ".btn:not(.btn-circle, .btn-square) { --radius-field: var(--wf-button-radius); }",
    );
    expect(css).toContain("--size: var(--wf-button-height);");
    expect(css).toMatch(
      /\.btn-primary:not\(\.btn-outline, \.btn-ghost, \.btn-link, \.wf-filled\) \{ --btn-bg: #0000;/,
    );
    // No shadows: Tailwind writes the theme's shadow scale into the classes that use it.
    expect(css).toContain(".shadow-md { --tw-shadow: 0 0 var(--tw-shadow-color, #0000);");
    // Links in running text not underlined until hovered or focused.
    expect(css).toContain("--wf-link-decoration: none;");
    expect(css).toContain("text-decoration-line: var(--wf-link-decoration,underline);");
  }, 60_000);
});

describe("buildSite: the theme's style (2.13d)", () => {
  it("draws headings, cards, photos and the sections' rhythm as the theme says", async () => {
    const site: SiteSnapshot = {
      ...sampleSite(),
      theme: {
        ...DEFAULT_THEME,
        preset: "styled",
        headings: { case: "uppercase", tracking: "wide" },
        cards: { style: "outlined" },
        images: { corners: "square" },
        sections: { rhythm: "alternating" },
      },
    };

    const exported = await buildSite(site, siteLibrary, resources);

    const css = text(exported, fileNamed(exported, /^assets\/css\//)).replace(/\s+/g, " ");
    expect(css).toContain(
      ":is(h1, h2, h3, h4, h5, h6).font-heading { text-transform: uppercase; letter-spacing: 0.1em; }",
    );
    expect(css).toContain(
      "section .wf-card { background-color: var(--color-base-100); border: var(--border) solid var(--color-base-300); }",
    );
    expect(css).toContain("img.rounded-box { border-radius: 0; }");
    // A rule per selector, as written, never merged into a list: a browser without :has()
    // (Firefox ESR 115) drops only the canvas's rule, and keeps the exported page's stripes.
    const onPage = "#main > section:nth-child(even of section):not([data-theme])";
    const canvas =
      ".wf-sections > :nth-child(even of :has(> section:not([data-webforge-hidden]))) > section:not([data-theme])";
    const rhythm = css.indexOf(`${onPage} { background-color: var(--color-base-200); }`);
    expect(rhythm).toBeGreaterThan(-1);
    expect(css).toContain(`${canvas} { background-color: var(--color-base-200); }`);
    expect(css).not.toContain(`${onPage}, ${canvas}`);
    // In the components layer, under the classes of sections with colours of their own, which
    // are utilities.
    expect(
      css
        .slice(0, rhythm)
        .match(/@layer (\w+) \{/g)
        ?.at(-1),
    ).toBe("@layer components {");
    expect(css).toContain("@layer theme, base, components, utilities;");
    // And over the page's surface that any section framed on it sets by its class.
    expect(css).toContain(`${onPage}.bg-base-100 { background-color: var(--color-base-200); }`);
    expect(css).toContain(`${canvas}.bg-base-100 { background-color: var(--color-base-200); }`);
  }, 60_000);
});

describe("buildSite: cancelled, followed, and reading bytes when needed (R15)", () => {
  /** sampleSite with its files named by hash, their bytes served by `readMedia` and counted. */
  function byHash() {
    const site = sampleSite();
    const stored = new Map<string, { data: Uint8Array; mime: string }>();
    const reads: string[] = [];
    const named = <T extends { readonly data?: Uint8Array | undefined; readonly mimeType: string }>(
      item: T,
    ) => {
      const data = item.data ?? new Uint8Array();
      const hash = createHash("sha256").update(data).digest("hex");
      stored.set(hash, { data, mime: item.mimeType });
      const { data: _bytes, ...rest } = item;
      return { ...rest, hash };
    };
    const snapshot: SiteSnapshot = {
      ...site,
      media: site.media.map(named),
      documents: (site.documents ?? []).map(named),
    };
    const readMedia: PipelineResources["readMedia"] = async (hash) => {
      reads.push(hash);
      return stored.get(hash);
    };
    return { snapshot, readMedia, reads, stored };
  }

  it("builds the same site from hashes, reading each file once, one at a time", async () => {
    const { snapshot, readMedia, reads, stored } = byHash();

    const fromHashes = await buildSite(snapshot, siteLibrary, { ...resources, readMedia });

    expect([...fromHashes.files.keys()]).toEqual([...built.files.keys()]);
    for (const [path, data] of built.files) expect(fromHashes.files.get(path), path).toEqual(data);
    expect(reads.sort()).toEqual([...stored.keys()].sort());
  }, 60_000);

  it("reads nothing and encodes nothing for images the cache has (a second export)", async () => {
    const { snapshot, readMedia, reads } = byHash();
    const entries = new Map<string, Uint8Array>();
    const imageCache: ImageCache = {
      get: async (key) => entries.get(key),
      set: async (key, data) => {
        entries.set(key, data);
      },
    };
    const first = await buildSite(snapshot, siteLibrary, { ...resources, readMedia, imageCache });
    const kept = entries.size;
    reads.length = 0;

    const second = await buildSite(snapshot, siteLibrary, { ...resources, readMedia, imageCache });

    // Only the document is read again: images come from the cache, as they were encoded.
    expect(reads).toHaveLength(snapshot.documents?.length ?? 0);
    expect(entries.size).toBe(kept);
    for (const [path, data] of first.files) expect(second.files.get(path), path).toEqual(data);
  }, 60_000);

  it("leaves out an image or document the site no longer stores, with a warning", async () => {
    const { snapshot, readMedia } = byHash();

    const result = await buildSite(snapshot, siteLibrary, {
      ...resources,
      readMedia: async (hash) => (hash === snapshot.media[0]?.hash ? undefined : readMedia?.(hash)),
    });

    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({ code: "missing-image", detail: snapshot.media[0]?.id }),
    );
  }, 60_000);

  it("refuses a document stored as another type than the snapshot says", async () => {
    const { snapshot, readMedia } = byHash();
    const document = snapshot.documents?.[0];

    const result = await buildSite(snapshot, siteLibrary, {
      ...resources,
      readMedia: async (hash) => {
        const stored = await readMedia?.(hash);
        return hash === document?.hash && stored !== undefined
          ? { ...stored, mime: "text/html" }
          : stored;
      },
    });

    expect([...result.files.keys()].some((path) => path.startsWith("files/"))).toBe(false);
  }, 60_000);

  it("tells its progress: each image and page, then the styles and the fonts", async () => {
    const events: BuildEvent[] = [];

    await buildSite(sampleSite(), siteLibrary, resources, {
      onProgress: (event) => events.push(event),
    });

    const stages = events.map((event) => event.stage);
    expect(stages.indexOf("pages")).toBeGreaterThan(stages.lastIndexOf("images"));
    expect(stages.slice(-2)).toEqual(["styles", "fonts"]);
    expect(events.filter((event) => event.stage === "pages")).toEqual(
      sampleSite().pages.map((_page, done) => ({ stage: "pages", done, total: 3 })),
    );
  }, 60_000);

  it("stops at the next image or page once cancelled", async () => {
    const controller = new AbortController();
    const events: BuildEvent[] = [];

    const building = buildSite(sampleSite(), siteLibrary, resources, {
      signal: controller.signal,
      onProgress: (event) => {
        events.push(event);
        if (event.stage === "images" && event.done === 0) controller.abort();
      },
    });

    await expect(building).rejects.toMatchObject({ name: "BuildError", code: "cancelled" });
    // The first image was under way when it was cancelled; nothing after it started.
    expect(events).toEqual([expect.objectContaining({ stage: "images", done: 0 })]);
  }, 60_000);
});

describe("buildSite: what the export writes (3.3)", () => {
  const css = (site: BuiltSite) =>
    text(site, fileNamed(site, /^assets\/css\/site\.[0-9a-f]{10}\.css$/));

  it("writes the same site minified: CSS that means the same, HTML without comments, a shorter script", async () => {
    const small = await buildSite(sampleSite(), siteLibrary, resources, {
      output: { minify: true },
    });

    // The same files, the CSS and script under the names of their minified content.
    const named = (site: BuiltSite) =>
      [...site.files.keys()].map((path) => path.replace(/\.[0-9a-f]{10}\./, ".#."));
    expect(named(small)).toEqual(named(built));
    // Parsed and minified again, both stylesheets are the same CSS. lightningcss keeps what it
    // doesn't parse fully (`color-mix(in lab, red, red)` in `@supports`) as written, so whitespace
    // beside commas and brackets, which never matters there, is left out of the comparison.
    const normalised = (code: string) =>
      new TextDecoder()
        .decode(
          transform({ filename: "site.css", code: new TextEncoder().encode(code), minify: true })
            .code,
        )
        .replace(/\s*([,()])\s*/g, "$1");
    expect(normalised(css(small))).toBe(normalised(css(built)));
    expect(css(small).length).toBeLessThan(css(built).length * 0.85);
    const home = text(small, "index.html");
    expect(home).not.toContain("<!--");
    expect(home.length).toBeLessThan(text(built, "index.html").length);
    expect(home).toContain(`href="${fileNamed(small, /^assets\/css\//)}"`);
    expect(home).toContain(`src="${fileNamed(small, /^assets\/js\//)}"`);
    expect(text(small, fileNamed(small, /^assets\/js\//)).length).toBeLessThan(
      text(built, fileNamed(built, /^assets\/js\//)).length,
    );
  }, 60_000);

  it("writes a page it can't minify readable, with a warning naming it", async () => {
    const base = sampleSite();
    const [home, ...rest] = base.pages;
    if (home === undefined) throw new Error("no home page");
    // A tag the person's Custom Code left broken.
    const broken: NodeDoc = { type: "CustomCode", props: { id: "custom", code: "<a <b>Sale</b>" } };
    const site: SiteSnapshot = {
      ...base,
      pages: [{ ...home, doc: { ...home.doc, content: [...home.doc.content, broken] } }, ...rest],
    };

    const small = await buildSite(site, siteLibrary, resources, { output: { minify: true } });

    expect(small.report.warnings).toEqual([
      // The sample's second Newsletter has no form address (3.7).
      { code: "form-unset", page: "about", detail: "noAddress" },
      { code: "not-minified", page: "index", detail: "" },
    ]);
    expect(text(small, "index.html")).toContain("<!-- Header (shared) -->");
    // The other pages are minified as asked.
    expect(text(small, "about.html")).not.toContain("<!--");
  }, 60_000);

  it("adds developer files only when asked: the stylesheet's source, the theme, the settings, a README", async () => {
    expect([...built.files.keys()].some((path) => path.startsWith("developer/"))).toBe(false);

    const withFiles = await buildSite(sampleSite(), siteLibrary, resources, {
      output: { developerFiles: true },
    });

    expect([...withFiles.files.keys()].filter((path) => path.startsWith("developer/"))).toEqual([
      "developer/README.md",
      "developer/design-tokens.json",
      "developer/input.css",
      "developer/package.json",
      "developer/site.json",
    ]);
    // Everything else is as without them.
    for (const [path, data] of built.files) expect(withFiles.files.get(path), path).toEqual(data);
    const input = text(withFiles, "developer/input.css");
    expect(input.startsWith('@import "tailwindcss" source(none);\n@source "../**/*.html";\n')).toBe(
      true,
    );
    expect(input).toContain('@plugin "daisyui"');
    expect(JSON.parse(text(withFiles, "developer/design-tokens.json"))).toEqual(sampleSite().theme);
    expect(JSON.parse(text(withFiles, "developer/site.json"))).toMatchObject({
      name: "Rosa's Bakery",
      settings: { "contact.phone": "+44 1234 567890" },
    });
    // The versions this export used, and a script that writes the file the pages link to.
    expect(JSON.parse(text(withFiles, "developer/package.json"))).toEqual({
      private: true,
      description: expect.stringContaining("Rosa's Bakery"),
      scripts: {
        "build-css": `tailwindcss -i input.css -o ../${fileNamed(withFiles, /^assets\/css\//)}`,
      },
      devDependencies: {
        "@tailwindcss/cli": requireFrom("tailwindcss/package.json").version,
        daisyui: requireFrom("daisyui/package.json").version,
        tailwindcss: requireFrom("tailwindcss/package.json").version,
      },
    });
    expect(text(withFiles, "developer/README.md")).toContain("npm run build-css");
  }, 60_000);

  it("rebuilds, as Tailwind's CLI would from input.css, the very stylesheet the pages link to", async () => {
    const withFiles = await buildSite(sampleSite(), siteLibrary, resources, {
      output: { developerFiles: true },
    });
    // The `tailwindcss` package's stylesheet and the files it imports, as the CLI loads them.
    const loaders = tailwindLoaders(resources);
    const packaged = {
      ...loaders,
      loadStylesheet: async (id: string, base: string) =>
        id === "tailwindcss"
          ? {
              path: id,
              base,
              content: readFileSync(requireFrom.resolve("tailwindcss/index.css"), "utf8"),
            }
          : loaders.loadStylesheet(id, base),
    };

    // No pages read: the classes `input.css` lists are the stylesheet's, escaped ones included.
    const compiler = await compile(text(withFiles, "developer/input.css"), packaged);

    // Tailwind's package writes its own defaults' strings in double quotes, the files the app
    // bundles in single: the same CSS.
    const same = (code: string) => code.replaceAll("'", '"').replace(/\s+/g, " ").trim();
    expect(same(compiler.build([]))).toBe(same(css(withFiles)));
    expect(text(withFiles, "developer/input.css")).toContain(
      '@source inline("[&::-webkit-details-marker]:hidden");',
    );
  }, 60_000);
});

describe("buildSite: shared sections (F-ED-23, 3.3)", () => {
  it("writes each copy inline, as its section, a second copy on a page with anchors of its own", async () => {
    const site = createSite({
      name: "Bakery",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });
    const hoursId = "shared-hours" as SharedSectionId;
    const shared = {
      [hoursId]: {
        id: hoursId,
        name: "Opening hours",
        section: {
          type: "Section",
          props: {
            id: "hours",
            advanced: { anchorId: "opening-hours" },
            content: [{ type: "Heading", props: { id: "title", text: "Open every day" } }],
          },
        },
      },
    };
    const [home, notFound] = Object.values(site.pages);
    if (home === undefined || notFound === undefined) throw new Error("No pages");
    const copies = (count: number) => {
      const content: NodeDoc[] = [];
      for (let made = 0; made < count; made++) {
        content.push(newSharedCopy(content, hoursId, shared, site.layout) as NodeDoc);
      }
      return content;
    };
    const withCopies = {
      ...site,
      sharedSections: shared,
      pages: {
        [home.id]: { ...home, doc: { ...home.doc, content: copies(2) } },
        [notFound.id]: { ...notFound, doc: { ...notFound.doc, content: copies(1) } },
      },
    };

    const exported = await buildSite(siteToSnapshot(withCopies, new Map()), siteLibrary, resources);

    await expect(text(exported, "index.html")).toMatchFileSnapshot(
      "golden/shared-sections/index.html",
    );
    await expect(text(exported, "404.html")).toMatchFileSnapshot("golden/shared-sections/404.html");
    expect(text(exported, "index.html")).toContain('id="opening-hours"');
    expect(text(exported, "index.html")).toContain('id="opening-hours-2"');
    expect(text(exported, "index.html")).not.toContain("SharedSectionCopy");
  }, 60_000);
});

describe("buildSite: section backgrounds (2.26)", () => {
  it("draws a section's background image as a responsive picture, its classes in the stylesheet", async () => {
    const base = sampleSite();
    const [home, ...rest] = base.pages;
    if (home === undefined) throw new Error("no home page");
    const story: NodeDoc = {
      type: "TextSection",
      props: {
        id: "story",
        title: "Our story",
        backgroundImage: { mediaId: "hero-photo" },
        overlay: "60",
        overlayColor: "neutral",
      },
    };
    const site: SiteSnapshot = {
      ...base,
      pages: [{ ...home, doc: { ...home.doc, content: [...home.doc.content, story] } }, ...rest],
    };

    const exported = await buildSite(site, siteLibrary, resources);

    const page = text(exported, "index.html");
    expect(page).toContain('sizes="100vw"');
    expect(page).toContain(
      '<source type="image/webp" srcSet="assets/img/hero-640.webp 640w, assets/img/hero-1280.webp 1280w, assets/img/hero-1600.webp 1600w" sizes="100vw" />',
    );
    expect(page).toContain("bg-neutral/60");
    expect(page).not.toContain("background-image");
    const css = text(exported, fileNamed(exported, /^assets\/css\//));
    for (const name of ["isolate", "-z-10", "text-neutral-content", String.raw`bg-neutral\/60`]) {
      expect(css, name).toContain(`.${name}`);
    }
    // Only the sample's Newsletter without its form address (3.7).
    expect(exported.report.warnings).toEqual([
      { code: "form-unset", page: "about", detail: "noAddress" },
    ]);
  }, 60_000);
});
