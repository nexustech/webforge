import type { NodeDoc, SitePage, SiteSnapshot } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { businessDataSchema, structuredData, websiteDataSchema } from "./structured-data.js";

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
    expect(tags.join("\n")).toContain("Rosa<\\/script><script>x");

    // A profile address the checks refuse: no business rather than a wrong one.
    const refused = site({ socialProfiles: [{ network: "custom", url: "not an address" }] });
    expect(dataOn(refused, "index")).toEqual([expect.objectContaining({ "@type": "WebSite" })]);
  });
});
