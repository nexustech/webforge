import { t } from "@webforge/i18n/components";
import type { NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import { siteLibrary } from "./index.js";

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page of `nodes`, to query. */
function page(nodes: readonly NodeDoc[]) {
  const happy = new Window();
  windows.push(happy);
  happy.document.body.innerHTML = renderNodesToHtml(nodes, siteLibrary, EDITOR_RENDER_CONTEXT);
  return happy.document;
}

const ITEMS = [
  { id: "a1", title: "Allergies", text: "<p>Nuts and eggs.</p><p>And milk.</p>" },
  { id: "a2", title: "Delivery", text: "<p>Within five miles.</p>" },
].map((props) => ({ type: "AccordionItem", props }));

/** An Accordion with two items, with `props` over that. */
const accordion = (props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Accordion",
  props: { id: "acc", items: ITEMS, ...props },
});

describe("the Accordion (6.16a)", () => {
  it("starts with three items, each a closed <details> with its title and text", () => {
    const defaults = siteLibrary.components.Accordion?.defaults;
    const doc = page([{ type: "Accordion", props: { id: "accordion", ...defaults } }]);

    const items = [...doc.querySelectorAll(".site-accordion details.site-accordion-item")];
    expect(items.map((item) => item.querySelector("summary")?.textContent)).toEqual(
      [1, 2, 3].map((number) => t("starter.accordionItemTitle", { number })),
    );
    expect(items.every((item) => !item.hasAttribute("open"))).toBe(true);
    expect(items[0]?.textContent).toContain(t("starter.accordionItemText"));
  });

  it("lets each item open on its own unless only one may be open", () => {
    const doc = page([accordion()]);

    expect(doc.querySelectorAll("details.site-accordion-item")).toHaveLength(2);
    expect(doc.querySelector("details[name]")).toBeNull();
  });

  it("gives its items one name, its own on the page, when only one may be open", () => {
    const doc = page([
      accordion({ oneOpen: true }),
      { type: "Accordion", props: { id: "other", oneOpen: true, items: ITEMS } },
    ]);

    const names = [...doc.querySelectorAll("details.site-accordion-item")].map((item) =>
      item.getAttribute("name"),
    );
    expect(names).toEqual(["accordion-acc", "accordion-acc", "accordion-other", "accordion-other"]);
  });

  it("draws an item as the FAQ draws a question that opens: one markup for both", () => {
    const doc = page([
      accordion(),
      {
        type: "Faq",
        props: {
          id: "faq",
          items: [{ type: "FaqItem", props: { id: "q", question: "Q", answer: "<p>A</p>" } }],
        },
      },
    ]);

    const classesOf = (selector: string) => {
      const details = doc.querySelector(selector);
      return [
        details?.className.split(" ").slice(1).join(" "),
        details?.querySelector("summary")?.className,
        details?.querySelector("summary + div")?.className,
      ];
    };
    expect(classesOf("details.site-accordion-item")).toEqual(classesOf("details.site-faq-item"));
  });

  it("needs no script, with one open at a time too", () => {
    const behaviours = siteLibrary.components.Accordion?.behaviours;
    const values = { ...siteLibrary.components.Accordion?.defaults, oneOpen: true };

    expect(typeof behaviours === "function" ? behaviours(values) : behaviours).toEqual([]);
  });
});
