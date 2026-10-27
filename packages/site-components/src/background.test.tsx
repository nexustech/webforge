import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPEARANCE_FIELDS } from "./appearance.js";
import {
  BACKGROUND_FIELD_NAMES,
  BACKGROUND_FIELDS,
  backgroundClasses,
  overlayOf,
  SectionBackground,
  sectionOverlay,
} from "./background.js";
import { siteLibrary } from "./catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import { renderNodesToHtml, renderPage } from "./render-static.js";
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
  it("are an image, as content, and an overlay's strength and colour, as Appearance tokens", () => {
    expect(BACKGROUND_FIELD_NAMES).toEqual(["backgroundImage", "overlay", "overlayColor"]);
    expect(Object.values(BACKGROUND_FIELDS).map((field) => [field.kind, field.group])).toEqual([
      ["media", "content"],
      ["slider", "style"],
      ["select", "style"],
    ]);
    expect(BACKGROUND_FIELDS.overlay.optionGroup.id).toBe("appearance");
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
    const html = draw({
      backgroundImage: { mediaId: "shop", alt: "The shop" },
      overlay: "60",
    });

    expect(html).toContain('<source type="image/webp" srcSet="assets/img/shop-640.webp 640w');
    expect(html).toContain('sizes="100vw"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("object-position:30% 60%");
    expect(html).toContain('class="absolute inset-0 -z-10 h-full w-full object-cover"');
    // Decorative, its alt text left out: the section's content says what it's about.
    expect(html).toContain('alt=""');
    expect(html).not.toContain("The shop");
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
      "relative isolate overflow-hidden",
    );
    expect(
      backgroundClasses({ backgroundImage: { mediaId: "shop" }, overlayColor: "neutral" }),
    ).toBe("relative isolate overflow-hidden text-neutral-content");
  });
});

describe("overlayOf and sectionOverlay (2.26)", () => {
  it("reads the overlay, a strong one in the page colour for a value it doesn't know", () => {
    expect(overlayOf({ overlay: "20", overlayColor: "neutral" })).toEqual({
      opacity: "20",
      color: "neutral",
    });
    expect(overlayOf({ overlay: "55", overlayColor: "pink" })).toEqual({
      opacity: "60",
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

describe("the section frame's background (2.26)", () => {
  const sections = Object.entries(siteLibrary.components).filter(
    ([, def]) => def.place === "section",
  );

  it("is on every section, after the Appearance group, but the Hero, which draws its own", () => {
    for (const [type, def] of sections) {
      const names = Object.keys(def.fields);
      if (type === "Hero") {
        expect(
          names.some((name) => BACKGROUND_FIELD_NAMES.includes(name as never)),
          type,
        ).toBe(false);
        continue;
      }
      const at = names.indexOf("backgroundImage");
      expect(names.slice(at, at + 3), type).toEqual([...BACKGROUND_FIELD_NAMES]);
      expect(at, type).toBe(Object.keys(APPEARANCE_FIELDS).length);
    }
  });

  it("gives a new section a strong overlay in the page colour, so the panel shows it", () => {
    for (const [type, def] of sections) {
      if (type === "Hero") continue;
      expect(def.defaults, type).toMatchObject({ overlay: "60", overlayColor: "base" });
    }
  });

  it("loads the page's first section's image at once, every other one lazily", () => {
    const placed = (id: string, hidden = false) => ({
      type: "TextSection",
      props: { id, backgroundImage: { mediaId: "shop" }, ...(hidden ? { hidden: true } : {}) },
    });
    const { main } = renderPage(
      {
        header: [],
        content: [placed("hidden", true), placed("first"), placed("second")],
        footer: [],
      },
      siteLibrary,
      context,
    );

    // The hidden one isn't drawn, so the first shown is the first.
    expect(main.match(/loading="(eager|lazy)"/g)).toEqual(['loading="eager"', 'loading="lazy"']);
    // Rendered alone (on the canvas, or a Header), none is first.
    expect(renderNodesToHtml([placed("first")], siteLibrary, context)).toContain('loading="lazy"');
  });

  it("draws the image and overlay first in the section, behind its content", () => {
    const html = renderNodesToHtml(
      [
        {
          type: "TextSection",
          props: { id: "story", backgroundImage: { mediaId: "shop" }, overlay: "60" },
        },
      ],
      siteLibrary,
      context,
    );

    // The section's first child, so its content is drawn over it.
    expect(html).toMatch(
      /^<section class="site-text-section [^"]* relative isolate overflow-hidden"><picture>/,
    );
    expect(html).toContain("bg-base-100/60");
  });

  it("changes nothing without an image", () => {
    const html = renderNodesToHtml(
      [{ type: "TextSection", props: { id: "story", overlay: "60" } }],
      siteLibrary,
      context,
    );

    expect(html).not.toContain("isolate");
    expect(html).not.toContain("<picture>");
  });
});
