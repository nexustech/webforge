import { describe, expect, it } from "vitest";
import { createSite } from "./site-doc.js";
import { findUnderlinedText, hasUnderlinedNonLink, TEXT_MARK_CLASSES } from "./text-marks.js";

describe("text marks (2.25, ST-3)", () => {
  it("tells underlined text from underlined links", () => {
    expect(hasUnderlinedNonLink("<p>Plain <strong>text</strong></p>")).toBe(false);
    expect(hasUnderlinedNonLink("<p>Read <u>this</u> first</p>")).toBe(true);
    expect(hasUnderlinedNonLink('<p><a href="https://example.com"><u>A link</u></a></p>')).toBe(
      false,
    );
    expect(hasUnderlinedNonLink('<p><u><a href="https://example.com">A link</a></u></p>')).toBe(
      false,
    );
    expect(hasUnderlinedNonLink("<p><u> </u></p>")).toBe(false);
  });

  it("names a class for every role, highlight and colour alike, each once", () => {
    expect(TEXT_MARK_CLASSES).toHaveLength(8);
    expect(new Set(TEXT_MARK_CLASSES).size).toBe(8);
  });

  it("finds underlined text on pages, in the Header and Footer and in slots, as Site Check's tip", () => {
    const site = createSite({
      name: "Rosa's",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Not found",
      homeDoc: {
        root: { props: {} },
        content: [
          {
            type: "Section",
            props: {
              id: "section",
              content: [{ type: "Text", props: { id: "text", text: "<p><u>Fresh</u> bread</p>" } }],
            },
          },
          { type: "Text", props: { id: "linked", text: '<p><a href="#"><u>Menu</u></a></p>' } },
        ],
      },
      layout: {
        header: [],
        footer: [{ type: "Footer", props: { id: "footer", text: "<p><u>Thanks</u></p>" } }],
      },
    });

    expect(findUnderlinedText(site)).toEqual([
      { on: site.homePageId, nodeId: "text" },
      { on: "footer", nodeId: "footer" },
    ]);
  });
});
