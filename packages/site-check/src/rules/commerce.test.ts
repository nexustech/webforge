import { describe, expect, it } from "vitest";
import { levelIn } from "../check.js";
import { element, findIn, siteWith } from "../test-site.test-helper.js";
import { buyButtonHttpsRule, buyButtonLinksRule } from "./commerce.js";

const buy = (id: string, link: unknown, more: Record<string, unknown> = {}) =>
  element("BuyButton", id, { label: "Buy now", price: "£12", link, ...more });

describe("Buy buttons' payment links (#858, M1)", () => {
  it("finds a Buy button with no payment link, wherever it is: Should fix, Must fix to publish", () => {
    const nested = element("Section", "shop", { content: [buy("gift", "  ")] });
    const site = siteWith([buy("cake", ""), nested, buy("bread", "https://buy.stripe.com/abc")]);
    const home = site.homePageId;

    expect(findIn(buyButtonLinksRule, site)).toEqual([
      { key: `${home}/cake/link`, place: { kind: "element", on: home, nodeId: "cake" } },
      { key: `${home}/gift/link`, place: { kind: "element", on: home, nodeId: "gift" } },
    ]);
    expect(levelIn(buyButtonLinksRule, "export")).toBe("should");
    expect(levelIn(buyButtonLinksRule, "publish")).toBe("must");
  });

  it("finds a payment link that isn't https, as Should fix even to publish", () => {
    const site = siteWith([
      buy("plain", "http://buy.stripe.com/abc"),
      buy("typed", "buy.stripe.com/abc"),
      buy("secure", " https://www.paypal.com/ncp/payment/XYZ "),
      buy("empty", ""),
    ]);
    const home = site.homePageId;

    expect(findIn(buyButtonHttpsRule, site).map((finding) => finding.place)).toEqual([
      { kind: "element", on: home, nodeId: "plain" },
      { kind: "element", on: home, nodeId: "typed" },
    ]);
    expect(levelIn(buyButtonHttpsRule, "publish")).toBe("should");
  });

  it("passes over a hidden Buy button, and a link that isn't text counts as none", () => {
    const site = siteWith([buy("hidden", "", { hidden: true }), buy("odd", 42)]);

    expect(findIn(buyButtonLinksRule, site).map((finding) => finding.key)).toEqual([
      `${site.homePageId}/odd/link`,
    ]);
    expect(findIn(buyButtonHttpsRule, site)).toEqual([]);
  });
});
