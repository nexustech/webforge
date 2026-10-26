import { describe, expect, it } from "vitest";
import { newId } from "./ids.js";
import { insertPage, pageSlugFor, pageTitle } from "./pages.js";
import { createSite } from "./site-doc.js";

const site = () =>
  createSite({ name: "Rosa's", language: "en", homeTitle: "Home", notFoundTitle: "Not found" });

describe("adding pages (4.8)", () => {
  it("trims a page's title to what can be saved", () => {
    expect(pageTitle("  About us  ")).toBe("About us");
    expect(pageTitle("x".repeat(500)).length).toBe(200);
  });

  it("adds a page before the last 'Page not found', with a free slug, in the menu", () => {
    const draft = site();
    const first = newId("page");
    const second = newId("page");
    insertPage(draft, first, "About us");
    insertPage(draft, second, "About us");

    expect(draft.pages[first]?.slug).toBe("about-us");
    expect(draft.pages[second]?.slug).toBe("about-us-2");
    const last = draft.pageOrder.at(-1);
    expect(last === undefined ? undefined : draft.pages[last]?.kind).toBe("not-found");
    expect(draft.menu.items.map((item) => "pageId" in item && item.pageId)).toEqual([
      draft.homePageId,
      first,
      second,
    ]);
    expect(pageSlugFor(draft, "About us", undefined, first)).toBe("about-us");
  });
});
