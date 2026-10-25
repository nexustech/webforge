import { t } from "@webforge/i18n";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import { siteLibrary } from "./index.js";

const defaults = siteLibrary.components.Pricing?.defaults ?? {};

/** The Pricing section with `props` over its defaults, as the export renders it. */
const render = (props: Record<string, unknown> = {}) =>
  renderNodesToHtml(
    [{ type: "Pricing", props: { id: "pricing", ...defaults, ...props } }],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page of `html`, to query. */
function page(html: string) {
  const happy = new Window();
  windows.push(happy);
  happy.document.body.innerHTML = html;
  return happy.document;
}

/** A plan with `props`. */
const plan = (id: string, props: Record<string, unknown> = {}) => ({
  type: "PricingPlan",
  props: { id, name: id, price: "£10", period: "a week", buttonLabel: "Book", ...props },
});

describe("the Pricing section", () => {
  it("renders with three plans, the middle one highlighted, as the Add panel places it", () => {
    const doc = page(render());

    expect(doc.querySelector(".site-pricing h2")?.textContent).toBe(t("starter.pricingTitle"));
    const plans = [...doc.querySelectorAll(".site-pricing-plan")];
    expect(plans.map((each) => each.querySelector("h3")?.textContent)).toEqual([
      t("starter.planNameBasic"),
      t("starter.planNameStandard"),
      t("starter.planNamePremium"),
    ]);
    expect(plans.map((each) => each.hasAttribute("data-featured"))).toEqual([false, true, false]);
    expect(plans[1]?.textContent).toContain(t("starter.planPriceStandard"));
    expect(plans[1]?.textContent).toContain(t("starter.planPeriod"));
  });

  it("highlights each plan set to it, in either layout, with a primary button; the others an outline one", () => {
    const items = [plan("one", { featured: true }), plan("two"), plan("three", { featured: true })];
    for (const variant of ["cards", "list"]) {
      const doc = page(render({ variant, items }));
      const plans = [...doc.querySelectorAll(".site-pricing-plan")];

      expect(
        plans.map((each) => each.hasAttribute("data-featured")),
        variant,
      ).toEqual([true, false, true]);
      expect(plans[0]?.className, variant).toContain("border-primary");
      expect(plans[0]?.querySelector("a")?.className, variant).not.toContain("btn-outline");
      expect(plans[1]?.className, variant).not.toContain("border-primary");
      expect(plans[1]?.querySelector("a")?.className, variant).toContain("btn-outline");
    }
  });

  it("lays its plans out as cards or as a price list", () => {
    const cards = page(render({ variant: "cards", items: [plan("one")] }));
    const list = page(render({ variant: "list", items: [plan("one")] }));

    expect(cards.querySelector(".grid")?.className).toContain("md:grid-cols-3");
    expect(cards.querySelector(".site-pricing-plan .text-4xl")?.textContent).toBe("£10");
    expect(list.querySelector(".grid")?.className).toContain("max-w-3xl");
    expect(list.querySelector(".site-pricing-plan")?.className).toContain("sm:flex-row");
    expect(list.querySelector(".site-pricing-plan a")?.className).toContain("btn-sm");
  });

  it("leaves the button out when its text is empty", () => {
    const doc = page(render({ items: [plan("menu", { buttonLabel: "  " })] }));

    expect(doc.querySelector(".site-pricing-plan a")).toBeNull();
    expect(doc.querySelector(".site-pricing-plan")?.textContent).toContain("£10");
  });

  it("casts a shadow under every plan when the section says so, and none unless it does", () => {
    const plain = page(render({ items: [plan("one")] }));
    const shadowed = page(render({ hover: "shadow" }));

    expect(plain.querySelector(".site-pricing-plan")?.className).not.toContain("hover:");
    for (const each of shadowed.querySelectorAll(".site-pricing-plan")) {
      expect(each.className).toContain("hover:shadow-lg");
    }
  });
});
