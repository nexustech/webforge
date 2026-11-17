import { t } from "@webforge/i18n";
import type { NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import { siteLibrary } from "./index.js";

/** The Menu's HTML with `props` over its defaults, as the export renders it. */
function renderMenu(props: Readonly<Record<string, unknown>> = {}): string {
  const defaults = siteLibrary.components.Menu?.defaults;
  return renderNodesToHtml(
    [{ type: "Menu", props: { id: "menu", ...defaults, ...props } }],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );
}

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

/** A dish with `props`. */
const dish = (id: string, props: Readonly<Record<string, unknown>> = {}): NodeDoc => ({
  type: "MenuItem",
  props: { id, name: id, price: "£4.50", description: `<p>About ${id}</p>`, ...props },
});

describe("the Food and drink menu (6.17a, #1137)", () => {
  it("starts with a café's breakfast and drinks, each group under its heading", () => {
    const doc = page(renderMenu());

    expect(doc.querySelector(".site-food-menu h2")?.textContent).toBe(t("starter.menuTitle"));
    expect([...doc.querySelectorAll(".site-food-menu h3")].map((each) => each.textContent)).toEqual(
      [t("starter.menuGroupFood"), t("starter.menuGroupDrinks")],
    );
    const names = [...doc.querySelectorAll(".site-food-menu-name")].map((each) => each.textContent);
    expect(names).toEqual([
      t("starter.menuEggs"),
      t("starter.menuPorridge"),
      t("starter.menuCoffee"),
      t("starter.menuTea"),
    ]);
    expect(doc.querySelector(".site-food-menu-price")?.textContent).toBe(
      t("starter.menuEggsPrice"),
    );
    expect(doc.querySelector(".site-food-menu-item")?.textContent).toContain(
      t("starter.menuEggsText"),
    );
  });

  it("joins each name to its price with dots, hidden from screen readers", () => {
    const doc = page(renderMenu({ items: [dish("Scone")] }));
    const row = doc.querySelector(".site-food-menu-item > div");
    const leader = row?.querySelector(".site-food-menu-leader");

    // In order: the name, the dots that fill the space between, then the price.
    expect([...(row?.children ?? [])].map((each) => each.className.split(" ")[0])).toEqual([
      "site-food-menu-name",
      "site-food-menu-leader",
      "site-food-menu-price",
    ]);
    // On a long name's last line, at the text's size.
    expect(row?.className).toContain("items-baseline-last");
    expect(row?.className.split(" ")).toContain("text-body");
    expect(leader?.getAttribute("aria-hidden")).toBe("true");
    expect(leader?.className).toContain("border-dotted");
    expect(leader?.className).toContain("flex-1");
    // A screen reader reads the name, then the price, apart.
    expect(row?.textContent?.replace(/\s+/g, " ")).toBe("Scone £4.50");
  });

  it("starts a group only where a dish has a heading", () => {
    const doc = page(
      renderMenu({
        items: [
          dish("Soup", { heading: "Lunch" }),
          dish("Sandwich", { heading: "  " }),
          dish("Lemonade", { heading: "Cold drinks" }),
        ],
      }),
    );
    const items = [...doc.querySelectorAll(".site-food-menu-item")];

    expect(items.map((each) => each.querySelector("h3")?.textContent ?? null)).toEqual([
      "Lunch",
      null,
      "Cold drinks",
    ]);
    // The heading comes before its first dish.
    expect(items[0]?.firstElementChild?.className).toContain("site-food-menu-heading");
  });

  it("leaves the dots out on the site when a dish has no price", () => {
    const doc = page(renderMenu({ items: [dish("Specials", { price: " " })] }));

    expect(doc.querySelector(".site-food-menu-leader")).toBeNull();
    expect(doc.querySelector(".site-food-menu-price")).toBeNull();
    expect(doc.querySelector(".site-food-menu-name")?.textContent).toBe("Specials");
  });

  it("has no button or period, unlike Pricing's plans", () => {
    const doc = page(renderMenu());

    expect(doc.querySelector(".site-food-menu a")).toBeNull();
    expect(Object.keys(siteLibrary.components.MenuItem?.fields ?? {})).toEqual([
      "heading",
      "name",
      "price",
      "description",
    ]);
  });

  it("has a class of its own, apart from the Header's menu on a phone", () => {
    const doc = page(renderMenu());

    expect(doc.querySelector("section")?.classList.contains("site-food-menu")).toBe(true);
    expect(doc.querySelector(".site-menu")).toBeNull();
  });

  it("takes only dishes and drinks in its list, so the Edit panel edits them as one", () => {
    const items = siteLibrary.components.Menu?.fields.items;

    expect(items?.kind === "slot" ? items.allow : undefined).toEqual(["MenuItem"]);
  });
});
