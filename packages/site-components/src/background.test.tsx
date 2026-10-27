import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BACKGROUND_FIELD_NAMES,
  BACKGROUND_FIELDS,
  backgroundClasses,
  overlayOf,
  SectionBackground,
  sectionOverlay,
} from "./background.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import type { RenderContext, ResolvedImage } from "./schema.js";

const shop: ResolvedImage = {
  src: "assets/img/shop-1920.jpg",
  sources: [
    {
      type: "image/webp",
      srcset: "assets/img/shop-640.webp 640w, assets/img/shop-1920.webp 1920w",
    },
  ],
  fallback: {
    type: "image/jpeg",
    srcset: "assets/img/shop-640.jpg 640w, assets/img/shop-1920.jpg 1920w",
  },
  width: 1920,
  height: 1280,
  alt: "Our shop front",
  objectPosition: "30% 60%",
};

/** What the export gives: the shop's photo in Media, nothing else. */
const context: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  image: (id) => (id === "shop" ? shop : null),
};

const draw = (values: Record<string, unknown>) =>
  renderToStaticMarkup(<SectionBackground values={values} context={context} />);

describe("BACKGROUND_FIELDS (2.26)", () => {
  it("are an image, an overlay's strength and its colour, in the Style group", () => {
    expect(BACKGROUND_FIELD_NAMES).toEqual(["backgroundImage", "overlay", "overlayColor"]);
    expect(Object.values(BACKGROUND_FIELDS).map((field) => [field.kind, field.group])).toEqual([
      ["media", "style"],
      ["slider", "style"],
      ["select", "style"],
    ]);
    expect(BACKGROUND_FIELDS.overlay.steps.map((step) => step.value)).toEqual([
      "0",
      "20",
      "40",
      "60",
      "80",
    ]);
  });
});

describe("SectionBackground (2.26)", () => {
  it("draws the image as a responsive picture behind the content, its focal point in view", () => {
    const html = draw({ backgroundImage: { mediaId: "shop" }, overlay: "60" });

    expect(html).toContain('<source type="image/webp" srcSet="assets/img/shop-640.webp 640w');
    expect(html).toContain('sizes="100vw"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("object-position:30% 60%");
    expect(html).toContain('class="absolute inset-0 -z-10 h-full w-full object-cover"');
    // Decorative: the section's content says what it's about.
    expect(html).toContain('alt=""');
    expect(html).toContain(
      '<div aria-hidden="true" class="absolute inset-0 -z-10 bg-base-100/60"></div>',
    );
    // No CSS background-image: the pipeline's sizes and lazy loading apply.
    expect(html).not.toContain("background-image");
  });

  it("lays the overlay in the neutral colour when asked, and none at 0", () => {
    expect(
      draw({ backgroundImage: { mediaId: "shop" }, overlay: "80", overlayColor: "neutral" }),
    ).toContain("bg-neutral/80");
    expect(draw({ backgroundImage: { mediaId: "shop" }, overlay: "0" })).not.toContain(
      "aria-hidden",
    );
  });

  it("draws nothing without an image, or for one deleted from Media", () => {
    expect(draw({})).toBe("");
    expect(draw({ backgroundImage: { mediaId: "gone" } })).toBe("");
    expect(draw({ backgroundImage: "shop" })).toBe("");
  });
});

describe("backgroundClasses (2.26)", () => {
  it("makes a stacking context cut to the section, and takes neutral's text colour over it", () => {
    expect(backgroundClasses({})).toBe("");
    expect(backgroundClasses({ backgroundImage: { mediaId: "shop" } })).toBe(
      " relative isolate overflow-hidden",
    );
    expect(
      backgroundClasses({ backgroundImage: { mediaId: "shop" }, overlayColor: "neutral" }),
    ).toBe(" relative isolate overflow-hidden text-neutral-content");
  });
});

describe("overlayOf and sectionOverlay (2.26)", () => {
  it("reads the overlay, a medium one in the page colour for a value it doesn't know", () => {
    expect(overlayOf({ overlay: "20", overlayColor: "neutral" })).toEqual({
      opacity: "20",
      color: "neutral",
    });
    expect(overlayOf({ overlay: "55", overlayColor: "pink" })).toEqual({
      opacity: "40",
      color: "base",
    });
  });

  it("gives the contrast check what the section draws, in its own colours", () => {
    expect(sectionOverlay({})).toBeNull();
    expect(
      sectionOverlay({ backgroundImage: { mediaId: "shop" }, overlay: "60", colors: "inverse" }),
    ).toEqual({ color: "base", opacity: 0.6, inverse: true });
  });
});
