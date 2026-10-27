import { describe, expect, it } from "vitest";
import type { NodeDoc } from "./documents.js";
import type { SharedSectionId } from "./ids.js";
import { createSite } from "./site-doc.js";
import { eachElement } from "./site-elements.js";

const HOURS = "shared-hours" as SharedSectionId;

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
  };
}

describe("eachElement", () => {
  it("visits the Header, the Footer, each page and each shared section, slots after their element", () => {
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
    ]);
  });

  it("leaves out hidden elements and what they hold, as the export does, when asked", () => {
    const visited: string[] = [];
    eachElement(site(), (each) => visited.push(each.props.id), { skipHidden: true });

    expect(visited).toEqual(["header", "footer", "outer", "inner", "shared"]);
  });
});
