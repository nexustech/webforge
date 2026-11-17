import {
  COLLECTION_PRESETS,
  type ItemValue,
  type MediaId,
  type NodeDoc,
  type SitePage,
  type SiteSnapshot,
} from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import {
  blogPostingSchema,
  businessDataSchema,
  structuredData,
  websiteDataSchema,
} from "./structured-data.js";

const ADDRESS = "https://rosas.example";

const page = (path: string, content: NodeDoc[] = []): SitePage => ({
  id: path,
  path,
  title: path,
  doc: { root: { props: {} }, content },
});

const CONTACT: NodeDoc = { type: "ContactDetails", props: { id: "details" } };

/** Rosa's bakery: a home page, a contact page showing her details, and `change` on top. */
function site(change: Partial<SiteSnapshot> = {}): SiteSnapshot {
  return {
    name: "Rosa's Bakery",
    language: "en-GB",
    pages: [page("index"), page("visit", [CONTACT]), page("prices")],
    layout: { header: [], footer: [] },
    settings: {
      "address.url": `${ADDRESS}/`,
      "contact.businessName": "Rosa's Bakery Ltd",
      "contact.phone": "+44 1234 567890",
      "contact.address": "1 High Street, Hightown",
      "contact.email": "hello@rosas.example",
    },
    openingHours: [{ days: ["tue", "wed"], opens: "07:00", closes: "15:00" }],
    socialProfiles: [{ network: "instagram", url: "https://instagram.com/rosas" }],
    search: {
      allowIndexing: true,
      includeSitemap: true,
      readableByAi: false,
      description: "Fresh bread",
    },
    business: { type: "food", kind: "Bakery", priceRange: "££" },
    ...change,
  } as SiteSnapshot;
}

/** The JSON-LD objects `structuredData` writes for the page at `path`. */
function dataOn(snapshot: SiteSnapshot, path: string, shareImage?: string): object[] {
  const shown = snapshot.pages.find((each) => each.path === path);
  if (shown === undefined) throw new Error(`no page ${path}`);
  return structuredData({
    site: snapshot,
    page: shown,
    nodes: shown.doc.content,
    library: siteLibrary,
    shareImage,
  }).map((tag) => {
    const json = /<script type="application\/ld\+json">\n([\s\S]*)\n<\/script>/.exec(tag)?.[1];
    return JSON.parse(json ?? "null") as object;
  });
}

describe("structured data (3.15, SEO-1)", () => {
  it("marks up the website and the business on the home page, from Site Settings", () => {
    const [website, business] = dataOn(site(), "index", "assets/img/shop-share.jpg");

    expect(websiteDataSchema.parse(website)).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Rosa's Bakery",
      url: `${ADDRESS}/`,
    });
    expect(businessDataSchema.parse(business)).toEqual({
      "@context": "https://schema.org",
      "@type": "Bakery",
      name: "Rosa's Bakery Ltd",
      description: "Fresh bread",
      url: `${ADDRESS}/`,
      image: `${ADDRESS}/assets/img/shop-share.jpg`,
      sameAs: ["https://instagram.com/rosas"],
      priceRange: "££",
    });
  });

  it("gives the hours and contact details only where the page shows them", () => {
    // The home page doesn't; the page with Opening hours and contact does.
    for (const field of ["address", "telephone", "email", "openingHoursSpecification"]) {
      expect(dataOn(site(), "index")[1], field).not.toHaveProperty(field);
    }
    expect(dataOn(site(), "visit")).toEqual([
      expect.objectContaining({
        address: {
          "@type": "PostalAddress",
          streetAddress: "1 High Street",
          addressLocality: "Hightown",
          addressCountry: "GB",
        },
        telephone: "+44 1234 567890",
        email: "hello@rosas.example",
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Tuesday", "Wednesday"],
            opens: "07:00",
            closes: "15:00",
          },
        ],
      }),
    ]);
    // A field bound to the address shows it, without the hours.
    const footer: NodeDoc = {
      type: "Footer",
      props: { id: "f", text: "", bindings: { text: "contact.address" } },
    };
    const withFooter = site({ layout: { header: [], footer: [footer] } });
    const home = withFooter.pages[0] as SitePage;
    const [, business] = structuredData({
      site: withFooter,
      page: home,
      nodes: [footer],
      library: siteLibrary,
      shareImage: undefined,
    });
    expect(business).toContain('"streetAddress": "1 High Street"');
    expect(business).not.toContain("openingHoursSpecification");
    expect(business).not.toContain("telephone");

    // Contact details not shown, as an email kept for forms: none of them.
    const hoursOnly: NodeDoc = { type: "ContactDetails", props: { id: "d", showContact: false } };
    const quiet = site({ pages: [page("index"), page("visit", [hoursOnly])] });
    const [visit] = dataOn(quiet, "visit");
    expect(visit).toHaveProperty("openingHoursSpecification");
    for (const field of ["address", "telephone", "email"]) {
      expect(visit, field).not.toHaveProperty(field);
    }

    // A field bound to the telephone shows it, and nothing else.
    const call: NodeDoc = {
      type: "Footer",
      props: { id: "f", text: "", bindings: { text: "contact.phone" } },
    };
    const [, called] = structuredData({
      site: site(),
      page: home,
      nodes: [call],
      library: siteLibrary,
      shareImage: undefined,
    });
    expect(called).toContain('"telephone": "+44 1234 567890"');
    expect(called).not.toContain("email");

    // Contact buttons linking to Site Settings' email show it; with their own phone, not its.
    const buttons: NodeDoc = {
      type: "ContactButtons",
      props: { id: "b", call: true, phone: "+44 7700 900123", email: true, emailAddress: "" },
    };
    const [, linked] = structuredData({
      site: site(),
      page: home,
      nodes: [buttons],
      library: siteLibrary,
      shareImage: undefined,
    });
    expect(linked).toContain('"email": "hello@rosas.example"');
    expect(linked).not.toContain("telephone");
  });

  it("takes the type's own schema.org type when the kind isn't one of its, and LocalBusiness when unknown", () => {
    expect(
      dataOn(site({ business: { type: "trades", kind: "Bakery" } }), "index")[1],
    ).toMatchObject({
      "@type": "HomeAndConstructionBusiness",
    });
    expect(dataOn(site({ business: undefined }), "index")[1]).toMatchObject({
      "@type": "LocalBusiness",
    });
    // With no type and no address or hours, as a CV from the blank template: a website only.
    const cv = site({
      business: undefined,
      settings: { "address.url": `${ADDRESS}/` },
      openingHours: [],
    });
    expect(dataOn(cv, "index")).toEqual([expect.objectContaining({ "@type": "WebSite" })]);
    // Hours alone are a place.
    const open = site({ business: undefined, settings: {} });
    expect(dataOn(open, "index")[1]).toMatchObject({ "@type": "LocalBusiness" });
  });

  it("marks a garage up as Vehicle repair, AutoRepair, among the trades (4.11, AIB-4)", () => {
    expect(
      dataOn(site({ business: { type: "trades", kind: "AutoRepair" } }), "index")[1],
    ).toMatchObject({ "@type": "AutoRepair" });
  });

  it("marks a personal site up as a website only", () => {
    const data = dataOn(site({ business: { type: "personal" } }), "index");

    expect(data).toEqual([expect.objectContaining({ "@type": "WebSite" })]);
  });

  it("points a restaurant's menu at its page of prices", () => {
    const prices = page("prices", [{ type: "Pricing", props: { id: "p", items: [] } }]);
    const restaurant = site({
      business: { type: "food", kind: "Restaurant" },
      pages: [page("index"), prices],
    });

    expect(dataOn(restaurant, "index")[1]).toMatchObject({ menu: `${ADDRESS}/prices.html` });
    // Never a page kept from search engines.
    const unlisted = site({
      business: { type: "food", kind: "Restaurant" },
      pages: [page("index"), { ...prices, hideFromSearch: true }],
    });
    expect(dataOn(unlisted, "index")[1]).not.toHaveProperty("menu");
  });

  it("writes none on other pages, or on a page kept from search engines", () => {
    expect(dataOn(site(), "prices")).toEqual([]);
    const hidden = site({ pages: [{ ...page("index"), hideFromSearch: true }] });
    expect(dataOn(hidden, "index")).toEqual([]);

    // The contact page is the first search engines may show: not one kept from them.
    const twice = site({
      pages: [
        page("index"),
        { ...page("old", [CONTACT]), hideFromSearch: true },
        page("visit", [CONTACT]),
      ],
    });
    expect(dataOn(twice, "visit")).toEqual([
      expect.objectContaining({
        address: expect.objectContaining({ streetAddress: "1 High Street" }),
      }),
    ]);
  });

  it("can't be closed early by what was typed, and leaves the business out if a value is refused", () => {
    const sneaky = site({
      settings: { ...site().settings, "contact.businessName": "Rosa</script><script>x" },
    });
    const tags = structuredData({
      site: sneaky,
      page: sneaky.pages[0] as SitePage,
      nodes: [],
      library: siteLibrary,
      shareImage: undefined,
    });
    expect(tags.join("\n").match(/<\/script>/g)).toHaveLength(2);
    expect(tags.join("\n")).toContain("Rosa\\u003c/script\\u003e\\u003cscript\\u003ex");
    expect(dataOn(sneaky, "index")).toContainEqual(
      expect.objectContaining({ name: "Rosa</script><script>x" }),
    );

    // A profile address the checks refuse: no business rather than a wrong one.
    const refused = site({ socialProfiles: [{ network: "custom", url: "not an address" }] });
    expect(dataOn(refused, "index")).toEqual([expect.objectContaining({ "@type": "WebSite" })]);
  });

  it("can't run on past its end, whatever the site's name (S14, #657)", () => {
    const named = site({ name: "Rosa's <!--<script> Bakery & Café > the rest" });
    const [website] = structuredData({
      site: named,
      page: named.pages[0] as SitePage,
      nodes: [],
      library: siteLibrary,
      shareImage: undefined,
    });
    const tag = website ?? "";
    const opening = '<script type="application/ld+json">';
    // The rest of the page as the export writes it after the head's JSON-LD.
    const rest =
      '\n<link rel="stylesheet" href="assets/site.css">\n</head>\n<body><h1>Rosa</h1></body>';
    const text = `${tag}${rest}`.slice(opening.length);

    // The element ends at its own closing tag rather than taking the page with it.
    expect(scriptEnd(text)).toBe(tag.length - opening.length - "</script>".length);
    expect(tag.slice(opening.length, -"</script>".length)).not.toMatch(/[<>&]/);
    // Read back as typed.
    expect(dataOn(named, "index")).toContainEqual(
      expect.objectContaining({
        "@type": "WebSite",
        name: "Rosa's <!--<script> Bakery & Café > the rest",
      }),
    );
  });
});

describe("a Blog's post (5.14, CC-6)", () => {
  /** A post at `blog/spring-opening`, with `values` and `change` on top of its page. */
  const post = (
    values: Readonly<Record<string, ItemValue>>,
    change: Partial<SitePage> = {},
  ): SitePage => ({
    ...page("blog/spring-opening"),
    title: "Spring opening",
    item: { values },
    ...change,
  });
  const FULL: Readonly<Record<string, ItemValue>> = {
    title: { kind: "text", text: "Spring opening" },
    date: { kind: "date", date: "2026-11-10" },
    summary: { kind: "text", text: "Doors open at nine." },
    picture: { kind: "image", mediaId: "photo" as MediaId },
  };
  const withPost = (shown: SitePage, change: Partial<SiteSnapshot> = {}) =>
    site({ pages: [page("index"), page("visit", [CONTACT]), shown], ...change });

  it("describes the post from what it has: title, days, summary, picture, and the site", () => {
    const shown = post(FULL, { updated: "2026-11-12" });
    const data = dataOn(withPost(shown), "blog/spring-opening", "images/share/photo.jpg");

    expect(data).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: "Spring opening",
        url: `${ADDRESS}/blog/spring-opening.html`,
        datePublished: "2026-11-10",
        dateModified: "2026-11-12",
        description: "Doors open at nine.",
        image: `${ADDRESS}/images/share/photo.jpg`,
        publisher: { "@type": "Organization", name: "Rosa's Bakery Ltd", url: `${ADDRESS}/` },
      },
    ]);
    expect(blogPostingSchema.safeParse(data[0]).success).toBe(true);
  });

  it("leaves out what the post doesn't have, and still validates", () => {
    // No picture: the site's own share picture isn't the post's.
    const shown = post({ title: { kind: "text", text: "Spring opening" } });
    const data = dataOn(withPost(shown), "blog/spring-opening", "images/share/site.jpg");

    expect(data).toEqual([expect.not.objectContaining({ image: expect.anything() })]);
    expect(Object.keys(data[0] ?? {})).toEqual([
      "@context",
      "@type",
      "headline",
      "url",
      "publisher",
    ]);
    expect(blogPostingSchema.safeParse(data[0]).success).toBe(true);
  });

  it("never says it changed before it was published", () => {
    const shown = post(FULL, { updated: "2026-11-01" });
    const [data] = dataOn(withPost(shown), "blog/spring-opening");
    expect(data).toMatchObject({ datePublished: "2026-11-10" });
    expect(data).not.toHaveProperty("dateModified");
  });

  it("takes its page's title when its own is empty, and a person as a personal site's publisher", () => {
    const shown = post({ title: { kind: "text", text: " " } });
    const personal = withPost(shown, {
      name: "Sam Jones",
      business: { type: "personal" },
      settings: {},
    });
    const [data] = dataOn(personal, "blog/spring-opening", "images/share/photo.jpg");
    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Spring opening",
      publisher: { "@type": "Person", name: "Sam Jones" },
    });
  });

  it("takes every item for a Blog's post only while the Blog is the only kind of collection", () => {
    expect(
      COLLECTION_PRESETS,
      "A new preset (Portfolio, Events: ADR 0025) must reach the snapshot, and structuredData " +
        "must choose its schema.org type rather than write BlogPosting for its items",
    ).toEqual(["blog"]);
  });

  it("writes none for a post kept from search engines, and nothing of the business", () => {
    const hidden = post(FULL, { hideFromSearch: true });
    expect(dataOn(withPost(hidden), "blog/spring-opening")).toEqual([]);
  });
});

/**
 * Where a `<script>` element's text ends, by the WHATWG tokeniser's script data states (13.2.5.4,
 * 13.2.5.20–13.2.5.31): `<!--` enters "escaped", `<script` there enters "double escaped", where
 * `</script>` only returns to "escaped". The index of the `</script` that ends the element, or -1.
 * From the security review's test for S14 (`docs/reviews/2026-10-30-security-review-tests/`).
 */
function scriptEnd(text: string): number {
  let state: "data" | "escaped" | "double" = "data";
  const at = (i: number, tag: string) =>
    text.slice(i, i + tag.length).toLowerCase() === tag &&
    /[\s/>]/.test(text[i + tag.length] ?? "");
  for (let i = 0; i < text.length; i++) {
    if (state === "data") {
      if (text.startsWith("<!--", i)) {
        state = "escaped";
        i += 3;
      } else if (at(i, "</script")) return i;
    } else if (text.startsWith("-->", i)) {
      state = "data";
      i += 2;
    } else if (state === "escaped") {
      if (at(i, "</script")) return i;
      if (at(i, "<script")) state = "double";
    } else if (at(i, "</script")) state = "escaped";
  }
  return -1;
}
