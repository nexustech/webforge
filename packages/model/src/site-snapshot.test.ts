import { describe, expect, it } from "vitest";
import { type SiteSnapshot, siteSnapshotSchema } from "./site-snapshot.js";

const emptyPage = { root: { props: {} }, content: [] };

function site(overrides: Partial<SiteSnapshot> = {}): SiteSnapshot {
  return {
    name: "Rosa's Bakery",
    language: "en-GB",
    theme: { name: "cupcake" },
    layout: { header: [], footer: [] },
    pages: [
      { id: "home", path: "index", title: "Home", doc: emptyPage },
      {
        id: "web-design",
        path: "services/web-design",
        title: "Web design",
        description: "What we do",
        doc: emptyPage,
      },
    ],
    media: [
      { id: "abc123", name: "hero", mimeType: "image/jpeg", data: new Uint8Array([1, 2, 3]) },
    ],
    ...overrides,
  };
}

describe("siteSnapshotSchema", () => {
  it("accepts a valid site", () => {
    const snapshot = site();

    expect(siteSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("accepts the site's menu, and rejects one the model wouldn't (F-ED-17)", () => {
    const menu: SiteSnapshot["menu"] = {
      follows: "custom",
      items: [{ id: "home" as never, kind: "page", pageId: "home" as never, hidden: false }],
    };

    expect(siteSnapshotSchema.parse(site({ menu })).menu).toEqual(menu);
    expect(
      siteSnapshotSchema.safeParse(
        site({
          menu: { follows: "custom", items: [{ id: "x", kind: "group", label: "" }] } as never,
        }),
      ).success,
    ).toBe(false);
  });

  it("requires a home page", () => {
    const result = siteSnapshotSchema.safeParse(
      site({ pages: [{ id: "about", path: "about", title: "About", doc: emptyPage }] }),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "The site has no home page",
    );
  });

  it("rejects duplicate page paths", () => {
    const page = { id: "home", path: "index", title: "Home", doc: emptyPage };
    const result = siteSnapshotSchema.safeParse(site({ pages: [page, page] }));

    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "Duplicate page paths: index",
    );
  });

  it("rejects duplicate media ids", () => {
    const item = { id: "a", name: "hero", mimeType: "image/png" as const, data: new Uint8Array() };
    const result = siteSnapshotSchema.safeParse(site({ media: [item, item] }));

    expect(result.error?.issues.map((issue) => issue.message)).toContain("Duplicate media ids");
  });

  it.each(["About", "about us", "about.html", "../about", "/about", "about/", "assets/x", "a--b"])(
    "rejects the page path %j",
    (path) => {
      const pages = [
        { id: "home", path: "index", title: "Home", doc: emptyPage },
        { id: "bad", path, title: "Bad", doc: emptyPage },
      ];

      expect(siteSnapshotSchema.safeParse(site({ pages })).success).toBe(false);
    },
  );

  it("rejects two media items with the same name, which would share exported files", () => {
    const photo = (id: string) => ({
      id,
      name: "hero",
      mimeType: "image/jpeg" as const,
      data: new Uint8Array(),
    });
    const result = siteSnapshotSchema.safeParse(site({ media: [photo("a"), photo("b")] }));

    expect(result.error?.issues.map((issue) => issue.message)).toContain("Duplicate media names");
  });

  it("rejects media that is not raw bytes or has an unsafe name", () => {
    const bad = [
      { id: "a", name: "hero", mimeType: "image/jpeg", data: [1, 2, 3] },
      { id: "a", name: "../hero", mimeType: "image/jpeg", data: new Uint8Array() },
      { id: "a/b", name: "hero", mimeType: "image/jpeg", data: new Uint8Array() },
      { id: "a", name: "hero", mimeType: "image/gif", data: new Uint8Array() },
    ];
    for (const item of bad) {
      expect(siteSnapshotSchema.safeParse({ ...site(), media: [item] }).success).toBe(false);
    }
  });

  it("rejects an invalid language tag", () => {
    expect(siteSnapshotSchema.safeParse(site({ language: "English" })).success).toBe(false);
  });

  it("checks for unsafe keys without walking image bytes (#138)", () => {
    // A 20 MB photo: walking its indices one by one would take seconds and gigabytes.
    const photo = {
      id: "big",
      name: "photo",
      mimeType: "image/jpeg" as const,
      data: new Uint8Array(20 * 1024 * 1024),
    };
    const started = Date.now();

    expect(siteSnapshotSchema.safeParse(site({ media: [photo] })).success).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
