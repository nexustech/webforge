import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { CONTENT_WIDTHS, type ContentWidth, narrowerWidth } from "./frame.js";
import { EDITOR_RENDER_CONTEXT, fieldsHiddenBy } from "./library.js";
import { renderNodesToHtml } from "./render-static.js";
import type { RenderContext, ResolvedImage } from "./schema.js";

const photo: ResolvedImage = {
  sources: [{ type: "image/webp", srcset: "assets/img/photo-640.webp 640w" }],
  src: "assets/img/photo-640.jpg",
  fallback: { type: "image/jpeg", srcset: "assets/img/photo-640.jpg 640w" },
  width: 640,
  height: 427,
  alt: "Loaves",
};

const context: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  image: (id) => (id === "photo" ? photo : null),
};

const render = (nodes: NodeDoc[]) => renderNodesToHtml(nodes, siteLibrary, context);

/** Every kind of section, by type: the Header and Footer are the page's layout, not sections. */
const sections = Object.entries(siteLibrary.components)
  .filter(([, def]) => def.place === "section")
  .map(([type]) => type);

/** Each content width's class. */
const CLASS: Readonly<Record<ContentWidth, string>> = {
  narrow: "max-w-3xl",
  medium: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

/** The width each kind drew its content at before 3.21, in its first layout: its default now. */
const DEFAULTS: Readonly<Record<string, ContentWidth>> = {
  Section: "wide",
  Hero: "wide",
  TextSection: "narrow",
  TextImage: "wide",
  CallToAction: "narrow",
  Faq: "narrow",
  Features: "wide",
  Gallery: "wide",
  Logos: "wide",
  Pricing: "wide",
  Stats: "wide",
  Team: "wide",
  Testimonials: "wide",
  ContactDetails: "medium",
  Video: "medium",
  Map: "medium",
  ContactForm: "wide",
  Newsletter: "wide",
};

/** What a kind needs to draw its whole width: an image beside the text, a form beside it. */
const DRAWN: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  TextImage: { image: { mediaId: "photo" } },
  ContactForm: { variant: "split" },
  Newsletter: { variant: "split" },
};

describe("a section's content width (3.21, PF-4)", () => {
  it("is on every section, in its Style tab, with its kind's width before as its default", () => {
    expect(Object.keys(DEFAULTS).sort()).toEqual([...sections].sort());
    for (const type of sections) {
      const def = siteLibrary.components[type];
      const field = def?.fields.contentWidth;
      expect(field?.kind, type).toBe("select");
      expect(field?.group, type).toBe("style");
      expect(
        field?.kind === "select" ? field.options.map((option) => option.label) : [],
        type,
      ).toEqual(["Narrow", "Medium", "Wide", "Full"]);
      expect(def?.defaults.contentWidth, type).toBe(DEFAULTS[type]);
    }
    // The Header and Footer are unchanged.
    expect(siteLibrary.components.Header?.fields).not.toHaveProperty("contentWidth");
    expect(siteLibrary.components.Footer?.fields).not.toHaveProperty("contentWidth");
    // A Section's Full width toggle is now its Full.
    expect(siteLibrary.components.Section?.fields).not.toHaveProperty("fullWidth");
  });

  it("caps every section's content at each width, its background still across the page", () => {
    for (const type of sections) {
      for (const width of CONTENT_WIDTHS) {
        const html = render([
          {
            type,
            props: { ...siteLibrary.components[type]?.defaults, ...DRAWN[type], id: "s" },
          },
        ]);
        const own = render([
          {
            type,
            props: {
              ...siteLibrary.components[type]?.defaults,
              ...DRAWN[type],
              id: "s",
              contentWidth: width,
            },
          },
        ]);
        const frame = /^<section [^>]*>/.exec(own)?.[0] ?? "";
        // A Section at Medium on the page's colours is its own column, as before (see below).
        if (!(type === "Section" && width === "medium")) {
          expect(frame, `${type} ${width}`).not.toMatch(/max-w-/);
        }
        expect(own, `${type} ${width}`).toContain(` ${CLASS[width]}`);
        // Its default draws as it did, with no width saved.
        if (width === DEFAULTS[type]) expect(own, type).toBe(html);
      }
    }
  });

  it("lines up a new Section with a Features section: both Wide, inside the same padding", () => {
    const html = render([
      {
        type: "Section",
        props: {
          ...siteLibrary.components.Section?.defaults,
          id: "s",
          content: [{ type: "Heading", props: { id: "h", text: "Our story", size: "medium" } }],
        },
      },
      { type: "Features", props: { ...siteLibrary.components.Features?.defaults, id: "f" } },
    ]);

    expect(html).toContain(
      '<section class="site-section px-4 py-16"><div class="mx-auto max-w-6xl space-y-6">',
    );
    expect(html).toContain(
      '<section class="site-features bg-base-100 px-4 py-16"><div class="mx-auto max-w-6xl space-y-10">',
    );
  });

  it("keeps a Section at Medium on the page's colours as it was: the section its own column", () => {
    const section = (colors: string) =>
      render([
        { type: "Section", props: { id: "s", colors, contentWidth: "medium", content: [] } },
      ]);

    // 896 px with its padding, so a Section saved before 3.21 doesn't move.
    expect(section("page")).toBe(
      '<section class="site-section mx-auto max-w-4xl space-y-6 px-4 py-16"></section>',
    );
    // Reversed, its column was always inside the band's padding.
    expect(section("inverse")).toBe(
      '<section class="site-section px-4 py-16" data-theme="wf_inverse"><div class="mx-auto max-w-4xl space-y-6"></div></section>',
    );
  });

  it("keeps a reading measure no wider than the section's width", () => {
    expect(narrowerWidth("wide", "narrow")).toBe("narrow");
    expect(narrowerWidth("narrow", "medium")).toBe("narrow");
    expect(narrowerWidth("full", "medium")).toBe("medium");
    // Features' intro stays at its reading width inside a Full grid.
    const features = render([
      { type: "Features", props: { id: "f", title: "Why us", contentWidth: "full", items: [] } },
    ]);
    expect(features).toContain(
      '<div class="mx-auto max-w-none space-y-10"><div class="mx-auto max-w-3xl text-center">',
    );
    // Without an image yet, a Text and image's text in the Text section's measure at most.
    const textImage = (contentWidth: ContentWidth) =>
      render([{ type: "TextImage", props: { id: "t", title: "T", contentWidth } }]);
    expect(textImage("full")).toContain('<div class="mx-auto max-w-3xl">');
    // Beside nothing yet, a Map's text no wider than Medium, as stacked.
    const map = (contentWidth: ContentWidth) =>
      render([
        { type: "Map", props: { id: "m", variant: "split", title: "Find us", contentWidth } },
      ]);
    expect(map("wide")).toContain('<div class="mx-auto max-w-4xl space-y-8">');
    expect(map("narrow")).toContain('<div class="mx-auto max-w-3xl space-y-8">');
  });

  it("hides the setting on a stacked form, which keeps its own measure", () => {
    for (const type of ["ContactForm", "Newsletter"]) {
      const def = siteLibrary.components[type];
      if (def === undefined) throw new Error(`No ${type}`);
      expect(fieldsHiddenBy(def, { variant: "stacked" }), type).toContain("contentWidth");
      expect(fieldsHiddenBy(def, { variant: "split" }), type).not.toContain("contentWidth");
    }
  });

  it("sizes an Image for its Section's width, as wide as the screen in a Full one", () => {
    const image = (contentWidth: ContentWidth) =>
      render([
        {
          type: "Section",
          props: {
            id: "s",
            contentWidth,
            content: [{ type: "Image", props: { id: "i", image: { mediaId: "photo" } } }],
          },
        },
      ]);

    expect(image("medium")).toContain(
      'sizes="(min-width: 1024px) 896px, (min-width: 768px) 100vw, 100vw"',
    );
    expect(image("wide")).toContain(
      'sizes="(min-width: 1024px) 1152px, (min-width: 768px) 100vw, 100vw"',
    );
    expect(image("full")).toContain(
      'sizes="(min-width: 1024px) 100vw, (min-width: 768px) 100vw, 100vw"',
    );
  });

  it("sizes a centred Hero's image for its width", () => {
    const hero = (contentWidth: ContentWidth) =>
      render([
        {
          type: "Hero",
          props: { id: "h", variant: "centred", image: { mediaId: "photo" }, contentWidth },
        },
      ]);

    expect(hero("medium")).toContain('sizes="(min-width: 896px) 896px, 100vw"');
    expect(hero("wide")).toContain('sizes="(min-width: 1152px) 1152px, 100vw"');
    expect(hero("full")).toContain('sizes="100vw"');
  });
});
