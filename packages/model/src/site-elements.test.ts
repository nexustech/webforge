import { describe, expect, it } from "vitest";
import type { NodeDoc } from "./documents.js";
import type { CollectionId, SharedSectionId } from "./ids.js";
import { createSite } from "./site-doc.js";
import { designAt, eachElement, elementsAt } from "./site-elements.js";

const HOURS = "shared-hours" as SharedSectionId;
const BLOG = "blog" as CollectionId;

const node = (id: string, props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Section",
  props: { id, ...props },
});

/** A site with an element in each place, a hidden one, and elements in slots. */
function site() {
  const base = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
    layout: { header: [node("header")], footer: [node("footer")] },
    homeDoc: {
      root: { props: {} },
      content: [
        node("outer", {
          content: [node("inner"), node("hidden", { hidden: true, content: [node("under")] })],
        }),
      ],
    },
  });
  return {
    ...base,
    sharedSections: { [HOURS]: { id: HOURS, name: "Hours", section: node("shared") } },
    collections: {
      [BLOG]: {
        id: BLOG,
        preset: "blog" as const,
        name: "Blog",
        folder: "blog",
        fields: [],
        design: {
          before: [node("design-top", { content: [node("design-title")] })],
          after: [node("design-bottom")],
        },
      },
    },
  };
}

describe("eachElement", () => {
  it("visits the Header, the Footer, each page, each shared section and each design once, slots after their element", () => {
    const visited: string[] = [];
    const doc = site();
    eachElement(doc, (each, on) => visited.push(`${on}:${each.props.id}`));

    const home = doc.homePageId;
    expect(visited).toEqual([
      "header:header",
      "footer:footer",
      `${home}:outer`,
      `${home}:inner`,
      `${home}:hidden`,
      `${home}:under`,
      `${HOURS}:shared`,
      // The Blog's design once (#936), not once for each post: above each post, then below.
      `${BLOG}:design-top`,
      `${BLOG}:design-title`,
      `${BLOG}:design-bottom`,
    ]);
  });

  it("leaves out hidden elements and what they hold, as the export does, when asked", () => {
    const visited: string[] = [];
    eachElement(site(), (each) => visited.push(each.props.id), { skipHidden: true });

    expect(visited).toEqual([
      "header",
      "footer",
      "outer",
      "inner",
      "shared",
      "design-top",
      "design-title",
      "design-bottom",
    ]);
  });
});

describe("elementsAt (#936)", () => {
  it("gives the top-level elements kept at each place, and none at a place there isn't", () => {
    const doc = site();
    const ids = (on: string) => elementsAt(doc, on).map((each) => each.props.id);

    expect(ids("header")).toEqual(["header"]);
    expect(ids("footer")).toEqual(["footer"]);
    expect(ids(doc.homePageId)).toEqual(["outer"]);
    expect(ids(HOURS)).toEqual(["shared"]);
    expect(ids(BLOG)).toEqual(["design-top", "design-bottom"]);
    expect(ids("constructor")).toEqual([]);
    expect(designAt(doc, BLOG)?.name).toBe("Blog");
    expect(designAt(doc, HOURS)).toBeUndefined();
  });
});
