import {
  insertPage,
  type NodeDoc,
  type PageId,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SiteDoc,
} from "@webforge/model";
import { describe, expect, it } from "vitest";
import { element, findIn, siteWith } from "../test-site.test-helper.js";
import {
  businessDetailsRule,
  businessProfileRule,
  mainHeadingRule,
  pageDescriptionsRule,
  sameDescriptionsRule,
  sameTitlesRule,
  searchConsoleRule,
  searchHiddenRule,
} from "./found.js";

const ABOUT = "page-about" as PageId;
const MENU = "page-menu" as PageId;

/** A copy of `site` changed by `change`. */
function changed(site: SiteDoc, change: (draft: SiteDoc) => void): SiteDoc {
  const draft = JSON.parse(JSON.stringify(site)) as SiteDoc;
  change(draft);
  return draft;
}

/** The site's page `id`, to change in a draft. */
function pageOf(site: SiteDoc, id: PageId) {
  const page = site.pages[id];
  if (page === undefined) throw new Error(`no page ${id}`);
  return page;
}

/** A site with a home page holding `home`, an About page and a Menu page, each with a description. */
function site(home: NodeDoc[] = [], about: NodeDoc[] = []): SiteDoc {
  return changed(siteWith(home), (draft) => {
    insertPage(draft, ABOUT, "About");
    insertPage(draft, MENU, "Menu");
    pageOf(draft, ABOUT).doc.content = about;
    draft.settings.general.description = "Bread baked every morning.";
    pageOf(draft, ABOUT).settings.description = "Who bakes the bread.";
    pageOf(draft, MENU).settings.description = "What's on the counter today.";
  });
}

const heading = (id: string, size = "large", text = "Fresh bread") =>
  element("Heading", id, { size, text });

/** Every finding's page, in order. */
const pagesIn = (findings: readonly { readonly place: unknown }[]) =>
  findings.map(({ place }) => (place as { readonly pageId?: string }).pageId);

describe("the site hidden from search engines (3.17)", () => {
  it("says so, and then nothing else in the group finds anything", () => {
    const hidden = changed(site(), (draft) => {
      draft.settings.search.allowIndexing = false;
      pageOf(draft, ABOUT).settings.description = undefined;
      draft.settings.address.url = "https://rosasbakery.co.uk";
    });

    expect(findIn(searchHiddenRule, hidden)).toEqual([{ key: "site", place: { kind: "search" } }]);
    for (const rule of [pageDescriptionsRule, mainHeadingRule, businessProfileRule]) {
      expect(findIn(rule, hidden)).toEqual([]);
    }
    expect(findIn(searchHiddenRule, site())).toEqual([]);
  });
});

describe("page descriptions (3.17)", () => {
  it("finds a page without its own description", () => {
    const without = changed(site(), (draft) => {
      pageOf(draft, ABOUT).settings.description = "  ";
    });
    expect(findIn(pageDescriptionsRule, without)).toEqual([
      { key: ABOUT, place: { kind: "page", pageId: ABOUT } },
    ]);
    expect(findIn(pageDescriptionsRule, site())).toEqual([]);
  });

  it("counts the site's description on the home page, which takes it", () => {
    const none = changed(site(), (draft) => {
      draft.settings.general.description = undefined;
    });
    expect(pagesIn(findIn(pageDescriptionsRule, none))).toEqual([none.homePageId]);
  });

  it("leaves out pages hidden from search engines and the 'Page not found' page", () => {
    const hidden = changed(site(), (draft) => {
      pageOf(draft, ABOUT).settings.description = undefined;
      pageOf(draft, ABOUT).settings.hideFromSearch = true;
    });
    expect(findIn(pageDescriptionsRule, hidden)).toEqual([]);
    // The site's "Page not found" page has no description of its own either.
    expect(Object.values(hidden.pages).some((page) => page.kind === "not-found")).toBe(true);
  });
});

describe("the same title or description (3.17)", () => {
  it("finds pages with the same title, whatever its case and spaces, naming the other", () => {
    const same = changed(site(), (draft) => {
      pageOf(draft, MENU).title = " about ";
    });
    expect(findIn(sameTitlesRule, same)).toEqual([
      { key: ABOUT, place: { kind: "page", pageId: ABOUT }, values: { sameAs: "menu.html" } },
      { key: MENU, place: { kind: "page", pageId: MENU }, values: { sameAs: "about.html" } },
    ]);
    expect(findIn(sameTitlesRule, site())).toEqual([]);
  });

  it("leaves the home page out of titles: the export titles it with the site's name", () => {
    const same = changed(site(), (draft) => {
      pageOf(draft, ABOUT).title = pageOf(draft, draft.homePageId).title;
    });
    expect(findIn(sameTitlesRule, same)).toEqual([]);
  });

  it("finds pages with the same description, the home page's inherited one included", () => {
    const same = changed(site(), (draft) => {
      pageOf(draft, MENU).settings.description = "Bread baked  every morning.";
    });
    expect(pagesIn(findIn(sameDescriptionsRule, same))).toEqual([same.homePageId, MENU]);
    expect(findIn(sameDescriptionsRule, site())).toEqual([]);
  });

  it("leaves pages without a description to the description rule", () => {
    const none = changed(site(), (draft) => {
      pageOf(draft, ABOUT).settings.description = undefined;
      pageOf(draft, MENU).settings.description = undefined;
    });
    expect(findIn(sameDescriptionsRule, none)).toEqual([]);
  });
});

describe("main headings (3.17)", () => {
  /** The pages `mainHeadingRule` finds, each with its count. */
  const counts = (checked: SiteDoc) =>
    findIn(mainHeadingRule, checked).map(({ key, values }) => [key, values?.headings]);

  it("finds a page with no main heading, or several, and not one with one", () => {
    const checked = site([heading("h1")], [heading("a"), heading("b")]);
    expect(counts(checked)).toEqual([
      [ABOUT, 2],
      [MENU, 0],
    ]);
  });

  it("counts a Hero's title and Custom Code's own headings, at any depth", () => {
    const hero = element("Hero", "hero", { title: "Rosa's Bakery" });
    const code = element("CustomCode", "code", { code: "<h1>Prices</h1><H1 class='x'>Cakes</H1>" });
    const nested = element("Section", "s", { content: [heading("deep")] });
    expect(counts(site([hero], [nested, code]))).toEqual([
      [ABOUT, 3],
      [MENU, 0],
    ]);
  });

  it("leaves out smaller headings, empty ones and hidden ones", () => {
    const home = [
      heading("h1"),
      heading("small", "medium"),
      heading("empty", "large", "<br>"),
      { ...heading("hidden"), props: { ...heading("hidden").props, hidden: true } },
    ];
    expect(counts(site(home, [heading("a")]))).toEqual([[MENU, 0]]);
  });

  it("counts the Header and Footer, unless the page hides them, and shared sections' copies", () => {
    const withLayout = changed(site([], [heading("a")]), (draft) => {
      draft.layout.header = [heading("logo")];
      const intro = "shared-intro" as SharedSectionId;
      draft.sharedSections[intro] = {
        id: intro,
        name: "Intro",
        section: element("Section", "intro", { content: [heading("intro")] }),
      };
      pageOf(draft, MENU).doc.content = [
        element(SHARED_COPY_TYPE, "copy", { sharedSectionId: intro }),
      ];
      pageOf(draft, MENU).settings.hideHeader = true;
    });
    expect(counts(withLayout)).toEqual([[ABOUT, 2]]);
  });
});

describe("business details (3.17)", () => {
  const business = (change: (draft: SiteDoc) => void = () => undefined) =>
    changed(site(), (draft) => {
      draft.settings.general.businessType = "food";
      change(draft);
    });

  it("finds each detail missing once the business type is set", () => {
    expect(findIn(businessDetailsRule, business())).toEqual([
      { key: "address", place: { kind: "contact", field: "address" } },
      { key: "phone", place: { kind: "contact", field: "phone" } },
      { key: "openingHours", place: { kind: "contact", field: "openingHours" } },
    ]);
  });

  it("finds nothing with every detail, without a type, or for a personal site", () => {
    const full = business((draft) => {
      draft.settings.contact.address = "1 High Street, Bath";
      draft.settings.contact.phone = "+44 1225 000000";
      draft.settings.contact.openingHours = [{ days: ["mon"], opens: "08:00", closes: "17:00" }];
    });
    expect(findIn(businessDetailsRule, full)).toEqual([]);
    expect(findIn(businessDetailsRule, site())).toEqual([]);
    const personal = business((draft) => {
      draft.settings.general.businessType = "personal";
    });
    expect(findIn(businessDetailsRule, personal)).toEqual([]);
  });
});

describe("the one-time tips (3.17)", () => {
  const online = (change: (draft: SiteDoc) => void = () => undefined) =>
    changed(site(), (draft) => {
      draft.settings.address.url = "https://rosasbakery.co.uk";
      change(draft);
    });

  it("appear only once the web address is set", () => {
    expect(findIn(businessProfileRule, site())).toEqual([]);
    expect(findIn(searchConsoleRule, site())).toEqual([]);
    expect(findIn(businessProfileRule, online())).toEqual([
      { key: "businessProfile", place: { kind: "guide", guide: "businessProfile" } },
    ]);
    expect(findIn(searchConsoleRule, online())).toEqual([
      { key: "searchConsole", place: { kind: "guide", guide: "searchConsole" } },
    ]);
  });

  it("leave out the profile for a personal site, and Search Console once its code is set", () => {
    const personal = online((draft) => {
      draft.settings.general.businessType = "personal";
    });
    expect(findIn(businessProfileRule, personal)).toEqual([]);
    const verified = online((draft) => {
      draft.settings.search.verification = { google: "abcdefgh1234" };
    });
    expect(findIn(searchConsoleRule, verified)).toEqual([]);
  });
});
