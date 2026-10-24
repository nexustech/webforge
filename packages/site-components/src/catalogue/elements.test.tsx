import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext, ResolvedImage } from "../schema.js";
import { siteLibrary } from "./index.js";

const shop: ResolvedImage = {
  sources: [{ type: "image/webp", srcset: "assets/img/shop-640.webp 640w" }],
  src: "assets/img/shop-640.jpg",
  fallback: { type: "image/jpeg", srcset: "assets/img/shop-640.jpg 640w" },
  width: 640,
  height: 427,
  alt: "Our shop",
  objectPosition: "30% 50%",
};

/** The export's context: the image `shop`, and links to pages' files. */
const context: RenderContext = {
  navigation: [],
  link: (target) => `${target}.html`,
  href: () => "#",
  image: (id) => (id === "shop" ? shop : null),
  setting: () => undefined,
};

const render = (type: string, props: Record<string, unknown>, on: RenderContext = context) =>
  renderNodesToHtml([{ type, props: { id: "it", ...props } } as NodeDoc], siteLibrary, on);

describe("the Image element (2.9)", () => {
  it("shows its Media image with its focal point in view, its alt text and its caption", () => {
    const html = render("Image", {
      image: { mediaId: "shop", alt: "The window" },
      caption: " On Mill Street ",
      rounded: true,
    });

    expect(html).toContain('<figure class="site-image w-full mx-auto">');
    expect(html).toContain('alt="The window"');
    expect(html).toContain('style="object-position:30% 50%"');
    expect(html).toContain('class="h-auto w-full rounded-box"');
    expect(html).toContain(
      '<figcaption class="mt-2 text-center text-sm">On Mill Street</figcaption>',
    );
  });

  it("is as wide as its width token per device, where its alignment puts it", () => {
    const html = render("Image", {
      image: { mediaId: "shop" },
      width: { $responsive: { desktop: "medium", mobile: "full" } },
      alignment: "right",
    });

    // Mobile first: full width on Mobile, at most medium from Tablet up.
    expect(html).toContain('<figure class="site-image w-full ml-auto md:max-w-md">');
    expect(html).toContain('alt="Our shop"');
    expect(html).not.toContain("<figcaption");
  });

  it("shows a hint on the canvas without its image, and nothing in the export", () => {
    expect(render("Image", {})).toBe("");
    expect(render("Image", { image: { mediaId: "gone" } })).toBe("");

    const html = render("Image", {}, { ...context, emptyImage: () => "Choose an image" });
    expect(html).toContain("border-dashed");
    expect(html).toContain("Choose an image");
  });
});

describe("the Button element (2.9)", () => {
  it("draws its link with the button classes of its style and size", () => {
    expect(render("Button", { label: "Order", link: "about" })).toBe(
      '<div class="site-button flex justify-start"><a class="btn btn-primary" href="about.html">Order</a></div>',
    );
    expect(
      render("Button", { label: "Order", style: "outline", size: "large", alignment: "right" }),
    ).toContain(
      '<div class="site-button flex justify-end"><a class="btn btn-outline btn-primary btn-lg"',
    );
    expect(render("Button", { label: "Order", style: "secondary", size: "small" })).toContain(
      'class="btn btn-secondary btn-sm"',
    );
  });

  it("draws no link without its text", () => {
    expect(render("Button", { label: "  ", link: "about" })).toBe(
      '<div class="site-button flex justify-start"></div>',
    );
  });
});

describe("the Spacer and Divider elements (2.9)", () => {
  it("takes up its height per device, hidden from screen readers", () => {
    expect(
      render("Spacer", { height: { $responsive: { desktop: "xlarge", mobile: "small" } } }),
    ).toBe('<div class="site-spacer h-4 md:h-24" aria-hidden="true"></div>');
  });

  it("is a thematic break, or daisyUI's divider with its word read out", () => {
    expect(render("Divider", {})).toBe('<hr class="site-divider my-4 border-base-300"/>');
    expect(render("Divider", { text: "or" })).toBe('<div class="site-divider divider">or</div>');
  });
});
