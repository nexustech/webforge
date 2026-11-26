import { describe, expect, it } from "vitest";
import { levelIn } from "../check.js";
import { element, findIn, siteWith } from "../test-site.test-helper.js";
import { buttonLinksRule } from "./content.js";

const PAGE_LINK = { kind: "url", href: "https://example.com/order" };

describe("buttons without a link (#1256)", () => {
  it("finds each kind of button with text and no link: Should fix, even to publish", () => {
    const site = siteWith([
      element("Hero", "hero", { buttonLabel: "Book a table", buttonLink: "" }),
      element("CallToAction", "cta", { buttonLabel: "Download for Windows" }),
      element("Section", "box", {
        content: [element("Button", "button", { label: "Order now", link: "   " })],
      }),
      element("Pricing", "plans", {
        items: [element("PricingPlan", "plan", { name: "Basic", buttonLabel: "Choose" })],
      }),
    ]);
    const home = site.homePageId;
    const at = (nodeId: string) => ({ kind: "element", on: home, nodeId });

    expect(findIn(buttonLinksRule, site)).toEqual([
      { key: `${home}/hero/buttonLink`, place: at("hero") },
      { key: `${home}/cta/buttonLink`, place: at("cta") },
      { key: `${home}/button/link`, place: at("button") },
      { key: `${home}/plan/link`, place: at("plan") },
    ]);
    expect(levelIn(buttonLinksRule, "export")).toBe("should");
    expect(levelIn(buttonLinksRule, "publish")).toBe("should");
  });

  it("finds a Hero's second button with text and no link, as its first (HH-5)", () => {
    const site = siteWith([
      element("Hero", "hero", {
        buttonLabel: "Book a table",
        buttonLink: PAGE_LINK,
        secondButtonLabel: "See the menu",
        secondButtonLink: "",
      }),
      element("Hero", "empty", {
        buttonLabel: "Book",
        buttonLink: PAGE_LINK,
        secondButtonLabel: "",
      }),
    ]);
    const home = site.homePageId;

    expect(findIn(buttonLinksRule, site)).toEqual([
      {
        key: `${home}/hero/secondButtonLink`,
        place: { kind: "element", on: home, nodeId: "hero" },
      },
    ]);
  });

  it("passes a button with a link, one with no text, and a hidden one", () => {
    const site = siteWith([
      element("Hero", "linked", { buttonLabel: "Book", buttonLink: PAGE_LINK }),
      element("CallToAction", "typed", { buttonLabel: "Call", buttonLink: "tel:+441234567890" }),
      element("CallToAction", "untitled", { buttonLabel: "  ", buttonLink: "" }),
      element("Hero", "hidden", { buttonLabel: "Book", buttonLink: "", hidden: true }),
    ]);

    expect(findIn(buttonLinksRule, site)).toEqual([]);
  });
});
