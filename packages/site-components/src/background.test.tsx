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
import { EDITOR_RENDER_CONTEXT, fieldsHiddenBy } from "./library.js";
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
    // The steps offered, and the Hero's 70% from before HH-3 in its place, kept but not offered.
    const steps = BACKGROUND_FIELDS.overlay.steps;
    expect(steps.filter((step) => !("kept" in step)).map((step) => step.value)).toEqual([
      "0",
      "20",
      "40",
      "60",
      "80",
    ]);
    expect(steps.map((step) => step.value)).toEqual(["0", "20", "40", "60", "70", "80"]);
    expect(steps[4]).toEqual({ label: "As before", value: "70", kept: true });
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
    ).toEqual({ color: "base", opacity: 0.6, inverse: true, text: [undefined] });
  });

  it("gives the check the text its layout draws where the person set none (#544)", () => {
    const placed = { backgroundImage: { mediaId: "shop" } };

    expect(sectionOverlay(placed, "neutral-content")?.text).toEqual(["neutral-content"]);
    expect(
      sectionOverlay({ ...placed, lookColor: "primary-700" }, "neutral-content")?.text,
    ).toEqual(["primary-700"]);
    // What each section's frame draws: a Call to action Banner sets neutral-content; others none.
    const { CallToAction, TextSection } = siteLibrary.components;
    expect(CallToAction?.sectionText?.({ variant: "banner" })).toBe("neutral-content");
    expect(CallToAction?.sectionText?.({ variant: "split" })).toBeUndefined();
    expect(TextSection?.sectionText?.({})).toBeUndefined();
    // A Reversed Banner draws the reversed surface, as any section does, with no text of its own
    // (#1257).
    expect(CallToAction?.sectionText?.({ variant: "banner", colors: "inverse" })).toBeUndefined();
  });

  it("gives the check the text colour the person set, on each device where they set it", () => {
    const placed = { backgroundImage: { mediaId: "shop" } };

    expect(sectionOverlay({ ...placed, lookColor: "primary-700" })?.text).toEqual(["primary-700"]);
    expect(sectionOverlay({ ...placed, lookColor: "default" })?.text).toEqual([undefined]);
    // Mobile's own, the larger devices keeping the section's.
    expect(
      sectionOverlay({
        ...placed,
        lookColor: { $responsive: { desktop: "default", mobile: "accent" } },
      })?.text,
    ).toEqual(["accent", undefined, undefined]);
  });
});

describe("the section frame's background (2.26)", () => {
  const sections = Object.entries(siteLibrary.components).filter(
    ([, def]) => def.place === "section",
  );
  /** The Hero, which draws its own, and the Contact buttons (6.16d), which have no band to fill. */
  const withoutBackground = new Set(["Hero", "ContactButtons"]);

  it("is on every section but those without one: its image first, its overlay before the look", () => {
    for (const [type, def] of sections) {
      const names = Object.keys(def.fields);
      if (withoutBackground.has(type)) {
        // The Hero has the overlay's fields, for the picture it draws behind its text (HH-3).
        expect(
          names.filter((name) => BACKGROUND_FIELD_NAMES.includes(name as never)),
          type,
        ).toEqual(type === "Hero" ? ["overlay", "overlayColor"] : []);
        continue;
      }
      // Its image first, as the Content tab shows it; its overlay straight before the rest of the
      // Appearance group, so the Style tab shows a section's background before its text (F23).
      expect(names[0], type).toBe("backgroundImage");
      const at = names.indexOf("overlay");
      const look = names.findIndex((name) => Object.hasOwn(APPEARANCE_FIELDS, name));
      expect(names.slice(at, at + 2), type).toEqual(["overlay", "overlayColor"]);
      expect(look, type).toBe(at + 2);
    }
  });

  it("hides the overlay's controls until the section has an image to lay it over", () => {
    const text = siteLibrary.components.TextSection;
    if (text === undefined) throw new Error("No Text section");

    const hidden = fieldsHiddenBy(text, text.defaults);
    expect(hidden.has("overlay")).toBe(true);
    expect(hidden.has("overlayColor")).toBe(true);
    const shown = fieldsHiddenBy(text, { ...text.defaults, backgroundImage: { mediaId: "shop" } });
    expect(shown.has("overlay")).toBe(false);
    expect(shown.has("overlayColor")).toBe(false);
    // The Hero's, only over its picture behind its text (HH-3).
    const hero = siteLibrary.components.Hero;
    if (hero === undefined) throw new Error("No Hero");
    const heroHides = (values: Record<string, unknown>) =>
      fieldsHiddenBy(hero, { ...hero.defaults, ...values });
    const photo = { image: { mediaId: "shop" } };
    expect(heroHides(photo).has("overlay")).toBe(true);
    expect(heroHides({ variant: "background" }).has("overlayColor")).toBe(true);
    expect(heroHides({ variant: "background", ...photo }).has("overlay")).toBe(false);
    expect(heroHides({ variant: "background", ...photo }).has("overlayColor")).toBe(false);
  });

  it("starts a new Hero at Strong in Neutral, the step nearest the 70% it had (HH-3)", () => {
    expect(siteLibrary.components.Hero?.defaults).toMatchObject({
      overlay: "60",
      overlayColor: "neutral",
    });
  });

  it("gives a new section a strong overlay in the page colour, so the panel shows it", () => {
    for (const [type, def] of sections) {
      if (withoutBackground.has(type)) continue;
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

  it("draws a gradient over the image and under the overlay, half see-through (CT-12, CT-14)", () => {
    const story = (props: Record<string, unknown>) =>
      renderNodesToHtml(
        [
          {
            type: "TextSection",
            props: {
              id: "story",
              backgroundImage: { mediaId: "shop" },
              overlay: "40",
              lookGradientDirection: "toRight",
              lookGradientFrom: "primary",
              lookGradientTo: "secondary",
              ...props,
            },
          },
        ],
        siteLibrary,
        context,
      );
    const layer = (opacity: string) =>
      `<div aria-hidden="true" class="absolute inset-0 -z-10 bg-linear-to-r! from-primary! to-secondary! ${opacity}"></div>`;

    // 50% while unset, so the picture shows at once.
    const html = story({});
    expect(html).toContain(layer("opacity-50"));
    // Drawn in this order: the picture, the gradient, the overlay, then the content.
    expect(html.indexOf("</picture>")).toBeLessThan(html.indexOf(layer("opacity-50")));
    expect(html.indexOf(layer("opacity-50"))).toBeLessThan(html.indexOf("bg-base-100/40"));
    // Its own opacity, per device; on the layer only, never on the section.
    expect(story({ lookGradientOpacity: "100" })).toContain(layer("opacity-100"));
    expect(
      story({ lookGradientOpacity: { $responsive: { desktop: "25", mobile: "75" } } }),
    ).toContain(layer("max-md:opacity-75 md:opacity-25"));
    expect(story({ lookGradientOpacity: "25" })).toMatch(/^<section class="[^"]*"/);
    expect(
      story({ lookGradientOpacity: "25" }).match(/^<section class="([^"]*)"/)?.[1],
    ).not.toContain("opacity");
  });

  it("offers Gradient opacity only with a direction and a picture behind (CT-14)", () => {
    const section = siteLibrary.components.TextSection;
    const hero = siteLibrary.components.Hero;
    if (section === undefined || hero === undefined) throw new Error("no TextSection or Hero");
    const shown = (def: typeof section, values: Record<string, unknown>) =>
      !fieldsHiddenBy(def, { ...def.defaults, ...values }).has("lookGradientOpacity");
    const picture = { backgroundImage: { mediaId: "shop" } };

    expect(shown(section, { ...picture, lookGradientDirection: "toRight" })).toBe(true);
    expect(shown(section, { lookGradientDirection: "toRight" })).toBe(false);
    expect(shown(section, { ...picture, lookGradientDirection: "default" })).toBe(false);
    // A Hero's picture is behind its text in its background layout only.
    const heroPicture = { image: { mediaId: "shop" }, lookGradientDirection: "toBottom" };
    expect(shown(hero, { ...heroPicture, variant: "background" })).toBe(true);
    expect(shown(hero, { ...heroPicture, variant: "split" })).toBe(false);
  });

  it("draws a gradient on the section itself without an image, as before (CT-4)", () => {
    const html = renderNodesToHtml(
      [
        {
          type: "TextSection",
          props: {
            id: "story",
            lookGradientDirection: "toRight",
            lookGradientFrom: "primary",
            lookGradientTo: "accent",
          },
        },
      ],
      siteLibrary,
      context,
    );

    expect(html).toMatch(/^<section class="[^"]*bg-linear-to-r! from-primary! to-accent!/);
    expect(html).not.toContain("aria-hidden");
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
