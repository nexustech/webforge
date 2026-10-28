import type { SitePage, SiteSnapshot } from "@webforge/model";
import { sampleSite } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import type { SiteIcon } from "./html.js";
import {
  hasSitemap,
  llmsTxt,
  markdownPage,
  markdownUrl,
  readablePages,
  robotsTxt,
  shareTags,
  siteAddress,
  sitemapXml,
  webManifest,
  withYear,
} from "./site-files.js";

const ADDRESS = "https://rosas.example";

/** The sample site with a web address (none for `false`) and search settings of its own. */
function site(
  search: Partial<NonNullable<SiteSnapshot["search"]>> = {},
  address: string | false = `${ADDRESS}/`,
): SiteSnapshot {
  const sample = sampleSite();
  const { "address.url": _address, ...settings } = sample.settings ?? {};
  return {
    ...sample,
    settings: { ...settings, ...(address === false ? {} : { "address.url": address }) },
    search: { allowIndexing: true, includeSitemap: true, readableByAi: true, ...search },
    pages: [
      ...sample.pages,
      {
        id: "lost",
        path: "404",
        title: "Page not found",
        hideFromNavigation: true,
        doc: { root: { props: {} }, content: [] },
      },
    ],
  };
}

/** `snapshot` with its About page hidden from search engines (3.15, SEO-2). */
const withHiddenAbout = (snapshot: SiteSnapshot): SiteSnapshot => ({
  ...snapshot,
  pages: snapshot.pages.map((each) =>
    each.path === "about" ? { ...each, hideFromSearch: true } : each,
  ),
});

const page = (snapshot: SiteSnapshot, path: string): SitePage => {
  const found = snapshot.pages.find((candidate) => candidate.path === path);
  if (found === undefined) throw new Error(`no page ${path}`);
  return found;
};

describe("siteAddress", () => {
  it("is the web address without its closing slash, and nothing when it's empty or unset", () => {
    expect(siteAddress(site())).toBe(ADDRESS);
    expect(siteAddress(site({}, ""))).toBeUndefined();
    expect(siteAddress(site({}, false))).toBeUndefined();
  });

  it("ignores an address Site Settings wouldn't accept, as it's written into links as it is", () => {
    expect(siteAddress(site({}, 'https://rosas.example/"><script>'))).toBeUndefined();
    expect(siteAddress(site({}, "http://rosas.example"))).toBeUndefined();
  });
});

describe("shareTags (3.5)", () => {
  it("gives a page its canonical address, its share card's tags and the manifest", () => {
    const snapshot = site({ xHandle: "rosasbakery" });
    const about = page(snapshot, "about");

    expect(
      shareTags({
        site: snapshot,
        page: about,
        prefix: "",
        shareImage: "assets/img/shop-share.jpg",
        manifest: true,
      }),
    ).toEqual([
      `<link rel="canonical" href="${ADDRESS}/about.html">`,
      '<meta property="og:type" content="website">',
      `<meta property="og:site_name" content="Rosa's Bakery">`,
      `<meta property="og:title" content="${about.title} | Rosa's Bakery">`,
      ...(about.description === undefined
        ? []
        : [`<meta property="og:description" content="${about.description}">`]),
      `<meta property="og:url" content="${ADDRESS}/about.html">`,
      `<meta property="og:image" content="${ADDRESS}/assets/img/shop-share.jpg">`,
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:site" content="@rosasbakery">',
      '<link rel="manifest" href="site.webmanifest">',
    ]);
  });

  it("gives the home page the site's address and name", () => {
    const snapshot = site();
    const tags = shareTags({
      site: snapshot,
      page: page(snapshot, "index"),
      prefix: "",
      shareImage: undefined,
      manifest: false,
    });

    expect(tags).toContain(`<link rel="canonical" href="${ADDRESS}/">`);
    expect(tags).toContain(`<meta property="og:title" content="Rosa's Bakery">`);
    expect(tags).toContain('<meta name="twitter:card" content="summary">');
    expect(tags.join("\n")).not.toContain("manifest");
  });

  it("without a web address: no canonical address, the picture relative to the page", () => {
    const snapshot = site({}, false);
    const tags = shareTags({
      site: snapshot,
      page: page(snapshot, "about"),
      prefix: "../",
      shareImage: "assets/img/shop-share.jpg",
      manifest: true,
    }).join("\n");

    expect(tags).not.toContain("canonical");
    expect(tags).not.toContain("og:url");
    expect(tags).toContain('<meta property="og:image" content="../assets/img/shop-share.jpg">');
    expect(tags).toContain('<link rel="manifest" href="../site.webmanifest">');
  });

  it("keeps search engines away when Site Settings say so, and from 'Page not found' always", () => {
    const hidden = site({ allowIndexing: false });
    const open = site();
    const tagsOf = (snapshot: SiteSnapshot, path: string) =>
      shareTags({
        site: snapshot,
        page: page(snapshot, path),
        prefix: `${ADDRESS}/`,
        shareImage: undefined,
        manifest: false,
      }).join("\n");
    const noindex = '<meta name="robots" content="noindex">';

    expect(tagsOf(hidden, "about")).toContain(noindex);
    expect(tagsOf(open, "about")).not.toContain(noindex);
    // It stands for every missing address, so it has no address of its own.
    expect(tagsOf(open, "404")).toContain(noindex);
    expect(tagsOf(open, "404")).not.toContain("canonical");
    expect(tagsOf(open, "404")).not.toContain("og:url");
  });

  it("keeps search engines away from a page hidden from them, which keeps its address (3.15)", () => {
    const snapshot = withHiddenAbout(site());
    const tags = shareTags({
      site: snapshot,
      page: page(snapshot, "about"),
      prefix: `${ADDRESS}/`,
      shareImage: undefined,
      manifest: false,
    }).join("\n");

    expect(tags).toContain('<meta name="robots" content="noindex">');
    // Still on the site, and linked: only search engines leave it out.
    expect(tags).toContain(`<link rel="canonical" href="${ADDRESS}/about.html">`);
  });

  it("writes the search engines' verification codes on every page (3.15, SEO-8)", () => {
    const snapshot = site({ verification: { google: "abcDEF123_-xyz", bing: "0123456789ABCDEF" } });
    for (const path of ["index", "about", "404"]) {
      const tags = shareTags({
        site: snapshot,
        page: page(snapshot, path),
        prefix: "",
        shareImage: undefined,
        manifest: false,
      });
      expect(tags, path).toContain(
        '<meta name="google-site-verification" content="abcDEF123_-xyz">',
      );
      expect(tags, path).toContain('<meta name="msvalidate.01" content="0123456789ABCDEF">');
    }
    const none = shareTags({
      site: site(),
      page: page(site(), "index"),
      prefix: "",
      shareImage: undefined,
      manifest: false,
    }).join("\n");
    expect(none).not.toContain("verification");
    expect(none).not.toContain("msvalidate");
  });

  it("escapes what a person wrote", () => {
    const snapshot = { ...site(), name: 'Tom & "Jerry"' };

    expect(
      shareTags({
        site: snapshot,
        page: page(snapshot, "index"),
        prefix: "",
        shareImage: undefined,
        manifest: false,
      }),
    ).toContain('<meta property="og:site_name" content="Tom &amp; &quot;Jerry&quot;">');
  });
});

describe("webManifest (3.5)", () => {
  it("lists the PNG icons, not the .ico, as readable JSON", () => {
    const icons: SiteIcon[] = [
      { path: "favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon", link: "icon" },
      { path: "assets/icons/icon-192.png", sizes: "192x192", type: "image/png", link: "icon" },
      { path: "assets/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ];

    expect(JSON.parse(webManifest(site(), icons))).toEqual({
      name: "Rosa's Bakery",
      short_name: "Rosa's Bakery",
      start_url: "./",
      display: "browser",
      icons: [
        { src: "assets/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "assets/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
    expect(webManifest(site(), icons)).toContain('\n  "name": ');
  });
});

describe("robots.txt and sitemap.xml (3.5)", () => {
  it("opens the site to search engines, pointing at the sitemap", () => {
    expect(robotsTxt(site())).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${ADDRESS}/sitemap.xml\n`);
    expect(hasSitemap(site())).toBe(true);
  });

  it("names no sitemap without a web address, or with the sitemap off", () => {
    expect(robotsTxt(site({}, false))).toBe("User-agent: *\nAllow: /\n");
    expect(hasSitemap(site({}, false))).toBe(false);
    expect(robotsTxt(site({ includeSitemap: false }))).toBe("User-agent: *\nAllow: /\n");
    expect(hasSitemap(site({ includeSitemap: false }))).toBe(false);
  });

  it("still lets search engines fetch the pages that say noindex when the site is hidden (3.15)", () => {
    // A page they may not fetch is one whose noindex they never read (SEO-3).
    expect(robotsTxt(site({ allowIndexing: false }))).toBe("User-agent: *\nAllow: /\n");
    expect(hasSitemap(site({ allowIndexing: false }))).toBe(false);
  });

  it("leaves out a page hidden from search engines, from the sitemap and the AI files (3.15)", () => {
    const snapshot = withHiddenAbout(site());

    expect(sitemapXml(snapshot, ADDRESS)).not.toContain("about.html");
    expect(readablePages(snapshot).map((each) => each.path)).not.toContain("about");
    expect(llmsTxt(snapshot)).not.toContain("about");
  });

  it("lists every page's address but the 'Page not found' page's", () => {
    const xml = sitemapXml(site(), ADDRESS);

    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /);
    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])).toEqual([
      `${ADDRESS}/`,
      `${ADDRESS}/about.html`,
      `${ADDRESS}/thanks.html`,
    ]);
  });

  it("treats a snapshot from before the settings as open to search engines, without AI files", () => {
    const older = { ...site(), search: undefined };

    expect(hasSitemap(older)).toBe(true);
  });
});

describe("withYear (F-CM-8)", () => {
  it("fills in every {year} with the build's year", () => {
    expect(withYear("<p>© {year} Rosa's, since 1990. {year}!</p>", 2027)).toBe(
      "<p>© 2027 Rosa's, since 1990. 2027!</p>",
    );
  });

  it("leaves scripts and styles as written: Custom Code's template literals keep their year", () => {
    // Custom Code's JavaScript: `the ${year}` (a template literal), spelt so this file has none.
    const literal = "`the $" + "{year}`";
    const scripts = `<script>const a = ${literal};</script><SCRIPT>b('{year}')</SCRIPT>`;
    const html = `<p>{year}</p>${scripts}<style>/* {year} */</style><p>{year}</p>`;

    expect(withYear(html, 2027)).toBe(
      `<p>2027</p>${scripts}<style>/* {year} */</style><p>2027</p>`,
    );
  });
});

describe("llms.txt and the Markdown copies' links (F-EX-5)", () => {
  it("lists the site's name, description and every page but 'Page not found'", () => {
    const snapshot = site({ description: "Fresh bread\nin Hightown" });

    expect(llmsTxt(snapshot)).toBe(
      [
        "# Rosa's Bakery",
        "",
        "> Fresh bread in Hightown",
        "",
        "## Pages",
        "",
        ...snapshot.pages
          .filter((candidate) => candidate.path !== "404")
          .map(
            (candidate) =>
              `- [${candidate.title}](${ADDRESS}/${candidate.path}.md)${
                candidate.description === undefined ? "" : `: ${candidate.description}`
              }`,
          ),
        "",
      ].join("\n"),
    );
  });

  it("links from the site's root without a web address", () => {
    expect(llmsTxt(site({}, false))).toContain("](/about.md)");
  });

  it("makes a page's links absolute, or from the site's root, and leaves other sites' alone", () => {
    const snapshot = site();
    const bare = site({}, false);

    expect(markdownUrl(snapshot, "menu/cakes", "../about.html")).toBe(`${ADDRESS}/about.html`);
    expect(markdownUrl(snapshot, "menu/cakes", "../assets/img/a-640.jpg")).toBe(
      `${ADDRESS}/assets/img/a-640.jpg`,
    );
    expect(markdownUrl(bare, "menu/cakes", "../about.html#hours")).toBe("/about.html#hours");
    expect(markdownUrl(bare, "about", "#team")).toBe("/about.html#team");
    expect(markdownUrl(snapshot, "about", "https://instagram.com/x")).toBe(
      "https://instagram.com/x",
    );
    expect(markdownUrl(snapshot, "about", "mailto:rosa@example.com")).toBe(
      "mailto:rosa@example.com",
    );
  });

  it("starts a copy with the page's title unless its content has one", () => {
    const about = page(site(), "about");

    expect(markdownPage(about, "Text\n")).toBe(`# ${about.title}\n\nText\n`);
    expect(markdownPage(about, "## Our story\n")).toBe(`# ${about.title}\n\n## Our story\n`);
    expect(markdownPage(about, "![Shop](a.jpg)\n\n# Our story\n")).toBe(
      "![Shop](a.jpg)\n\n# Our story\n",
    );
  });
});
