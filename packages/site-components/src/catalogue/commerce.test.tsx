import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext, ResolvedImage } from "../schema.js";
import { siteLibrary } from "./index.js";

const buy = (props: Record<string, unknown>): NodeDoc => ({
  type: "BuyButton",
  props: { id: "buy", ...siteLibrary.components.BuyButton?.defaults, ...props },
});
const html = (node: NodeDoc, context: RenderContext = EDITOR_RENDER_CONTEXT) =>
  renderNodesToHtml([node], siteLibrary, context);

const cake: ResolvedImage = {
  sources: [],
  src: "assets/img/cake.jpg",
  fallback: { type: "image/jpeg", srcset: "assets/img/cake.jpg 800w" },
  width: 800,
  height: 600,
  alt: "A birthday cake",
};

describe("the Buy button (2.11, F-CM-2)", () => {
  it("is a plain link to its https payment page, in a new tab, with its price", () => {
    const drawn = html(buy({ link: "https://buy.stripe.com/test_00abc", price: "£24" }));

    expect(drawn).toContain('class="site-buy-button');
    expect(drawn).toContain("£24");
    expect(drawn).toContain(
      'href="https://buy.stripe.com/test_00abc" target="_blank" rel="noopener noreferrer" aria-describedby="buy-price">Buy now</a>',
    );
    expect(drawn).toContain('<p class="font-heading text-lg font-semibold" id="buy-price">£24</p>');
    // No script of its own.
    expect(siteLibrary.components.BuyButton?.behaviours).toBeTypeOf("function");
  });

  it("takes only an https link: without one, no button in the export, a disabled one on the canvas", () => {
    const canvas: RenderContext = { ...EDITOR_RENDER_CONTEXT, elementHint: () => "Add a link" };
    for (const link of ["", "http://example.com/pay", "javascript:alert(1)", "not a link"]) {
      const exported = html(buy({ link }));
      const shown = html(buy({ link }), canvas);

      // A button that does nothing would leave visitors stuck (#389 review): its price stays.
      expect(exported, link).not.toContain("<a");
      expect(exported, link).not.toContain("Buy now");
      expect(exported, link).toContain("£12");
      expect(shown, link).toContain("btn-disabled");
      expect(shown, link).not.toContain("<a");
    }
  });

  it("tells one Buy button's link from another by its price and image", () => {
    const context: RenderContext = { ...EDITOR_RENDER_CONTEXT, image: () => cake };

    const drawn = html(
      buy({ link: "https://paypal.me/rosas", price: "£8", image: { mediaId: "cake" } }),
      context,
    );

    expect(drawn).toContain('aria-describedby="buy-price buy-image"');
    expect(drawn).toContain('id="buy-image"');
  });

  it("says on the canvas what to add while its link is missing", () => {
    const canvas: RenderContext = {
      ...EDITOR_RENDER_CONTEXT,
      elementHint: (missing) => `Missing: ${missing}`,
    };

    expect(html(buy({}), canvas)).toContain("Missing: paymentLink");
    expect(html(buy({ link: "https://paypal.me/rosasbakery" }), canvas)).not.toContain("Missing");
  });

  it("shows its image, with the placement's alt text", () => {
    const context: RenderContext = { ...EDITOR_RENDER_CONTEXT, image: () => cake };

    const drawn = html(buy({ image: { mediaId: "cake", alt: "Our lemon cake" } }), context);

    expect(drawn).toContain('src="assets/img/cake.jpg"');
    expect(drawn).toContain('alt="Our lemon cake"');
  });

  it("moves its button only under motion-safe when it lifts on hover", () => {
    const drawn = html(buy({ link: "https://buy.stripe.com/x", hover: "lift" }));

    expect(drawn).toContain("motion-safe:hover:-translate-y-1");
  });
});
