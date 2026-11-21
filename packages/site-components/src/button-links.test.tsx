import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import { renderNodesToHtml } from "./render-static.js";
import type { RenderContext } from "./schema.js";

/** The canvas's context: every element hint shown as `[its key]`. */
const canvas: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  elementHint: (missing) => `[${missing}]`,
};

/** Each kind of button, labelled "Order now", with `link` as its link (#1256). */
const buttons = (link: unknown): readonly NodeDoc[] => [
  {
    type: "Hero",
    props: { id: "hero", title: "Cakes", buttonLabel: "Order now", buttonLink: link },
  },
  {
    type: "CallToAction",
    props: { id: "cta", title: "Cakes", buttonLabel: "Order now", buttonLink: link },
  },
  { type: "Button", props: { id: "button", label: "Order now", link } },
  {
    type: "Pricing",
    props: {
      id: "plans",
      items: [
        {
          type: "PricingPlan",
          props: { id: "plan", name: "Basic", buttonLabel: "Order now", link },
        },
      ],
    },
  },
];

const html = (node: NodeDoc, context: RenderContext = EDITOR_RENDER_CONTEXT) =>
  renderNodesToHtml([node], siteLibrary, context);

describe("a button with text and no link (#1256)", () => {
  it("is left out of the export, never a link to #", () => {
    for (const link of [undefined, "", "   "]) {
      for (const node of buttons(link)) {
        const exported = html(node);
        expect(exported, node.type).not.toContain("Order now");
        expect(exported, node.type).not.toContain('href="#"');
      }
    }
  });

  it("is drawn disabled on the canvas, with a hint to add its link", () => {
    for (const node of buttons("")) {
      const shown = html(node, canvas);
      expect(shown, node.type).toMatch(
        /<span class="[^"]*btn[^"]* btn-disabled"[^>]*aria-disabled="true"[^>]*>Order now<\/span>/,
      );
      expect(shown, node.type).toContain("[buttonLink]");
      expect(shown, node.type).not.toContain("<a ");
    }
  });

  it("is a link as before once it has one, with no hint", () => {
    for (const node of buttons({ kind: "url", href: "https://example.com/order" })) {
      const shown = html(node, canvas);
      // The editor's context draws every link to `#`, as the canvas doesn't follow them.
      expect(shown, node.type).toMatch(/<a class="[^"]*btn[^"]*"[^>]*>Order now<\/a>/);
      expect(shown, node.type).not.toContain("[buttonLink]");
      expect(shown, node.type).not.toContain("btn-disabled");
    }
  });

  it("shows nothing, nor a hint, while it has no text", () => {
    const blank = html({ type: "Button", props: { id: "button", label: " ", link: "" } }, canvas);
    expect(blank).not.toContain("[buttonLink]");
    expect(blank).not.toContain("btn");
  });
});
