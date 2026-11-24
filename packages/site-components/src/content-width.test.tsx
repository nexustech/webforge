import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { imageSizes } from "./catalogue/column-layouts.js";
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
  // New with 3.21's widths in place (6.4): across the page.
  AnnouncementBar: "full",
  // New in 6.10b: the Blog's posts in cards across a wide column.
  LatestPosts: "wide",
  // New in 6.16d (#1136): its row on the canvas; on the site it keeps to the screen's corner.
  ContactButtons: "full",
  // New in 6.16b (#1134): its steps side by side across a wide column.
  Steps: "wide",
  // New in 6.17a (#1137): one column, so the dots join each name to its price.
  Menu: "narrow",
};

/** What a kind needs to draw its whole width: an image beside the text, a form beside it. */
const DRAWN: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  TextImage: { image: { mediaId: "photo" } },
  ContactForm: { variant: "split" },
  Newsletter: { variant: "split" },
  ContactButtons: { phone: "01632 960123" },
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
    // The Header and Footer have the same field, at Full by default (HF-10): see below.
    for (const type of ["Header", "Footer"]) {
      const def = siteLibrary.components[type];
      expect(def?.fields.contentWidth, type).toBe(siteLibrary.components.Hero?.fields.contentWidth);
      expect(def?.defaults.contentWidth, type).toBe("full");
    }
    // A Section's Full width toggle is now its Full.
    expect(siteLibrary.components.Section?.fields).not.toHaveProperty("fullWidth");
  });

  // One test for each kind, each with its own time: all twenty at once ran past 5 s in a full,
  // parallel run (#1093).
  it.for(sections)(
    "caps a %s's content at each width, its background still across the page",
    (type) => {
      // With no width saved: the same at every width.
      const html = render([
        {
          type,
          props: { ...siteLibrary.components[type]?.defaults, ...DRAWN[type], id: "s" },
        },
      ]);
      for (const width of CONTENT_WIDTHS) {
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
    },
  );

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

  it("keeps a Section's content at Medium on the page's colours where it was, in a band (#643)", () => {
    const section = (colors: string) =>
      render([
        { type: "Section", props: { id: "s", colors, contentWidth: "medium", content: [] } },
      ]);

    // A band, so its background spans the page; its column 896 px with its padding, so a Section
    // saved before 3.21 doesn't move.
    expect(section("page")).toBe(
      '<section class="site-section"><div class="site-section-column mx-auto max-w-4xl px-4 py-16 space-y-6"></div></section>',
    );
    // Its background colour is the band's, across the page, as at every other width.
    const coloured = render([
      {
        type: "Section",
        props: { id: "s", contentWidth: "medium", lookBackground: "base-200", content: [] },
      },
    ]);
    expect(coloured).toMatch(
      /^<section class="site-section [^"]*bg-base-200[^"]*"><div class="site-section-column /,
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
    // Full: as wide as the screen.
    expect(image("full")).toContain(
      'sizes="(min-width: 1024px) 100vw, (min-width: 768px) 100vw, 100vw"',
    );
  });

  it("sizes a shaped Image in a Full section as the screen, widened to cover its frame", () => {
    const shaped = (width: string) =>
      render([
        {
          type: "Section",
          props: {
            id: "s",
            contentWidth: "full",
            content: [
              {
                type: "Image",
                props: { id: "i", image: { mediaId: "photo" }, width, shape: "portrait" },
              },
            ],
          },
        },
      ]);

    // A 640 × 427 picture in a 3:4 frame shows twice the frame's width to cover its height.
    expect(shaped("full")).toContain(
      'sizes="(min-width: 1024px) 200vw, (min-width: 768px) 200vw, 200vw"',
    );
    // At Medium (448 px), at most that frame's 896 px, on Desktop too.
    expect(shaped("medium")).toContain(
      'sizes="(min-width: 1024px) min(896px, 200vw), (min-width: 768px) min(896px, 200vw), min(896px, 200vw)"',
    );
  });

  it("gives imageSizes the section's width, in Columns and with the Image's own cap", () => {
    const none = () => undefined;
    // Half of a Wide section's 1152 px, and of a Full one's screen.
    expect(imageSizes(none, "equal", 1152)).toBe(
      "(min-width: 1024px) 576px, (min-width: 768px) 50vw, 50vw",
    );
    expect(imageSizes(none, "equal", undefined)).toBe(
      "(min-width: 1024px) 50vw, (min-width: 768px) 50vw, 50vw",
    );
    // The Image's own width token is the cap when it is narrower.
    expect(imageSizes(() => 448, null, undefined)).toBe(
      "(min-width: 1024px) min(448px, 100vw), (min-width: 768px) min(448px, 100vw), min(448px, 100vw)",
    );
    expect(imageSizes(() => 448, null, 768)).toBe(
      "(min-width: 1024px) 448px, (min-width: 768px) min(448px, 100vw), min(448px, 100vw)",
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

describe("the Header's and the Footer's content width (HF-10)", () => {
  const header = (props: Readonly<Record<string, unknown>>) =>
    render([
      {
        type: "Header",
        props: {
          ...siteLibrary.components.Header?.defaults,
          id: "h",
          siteName: "Rosa's",
          ...props,
        },
      },
    ]);
  const footer = (props: Readonly<Record<string, unknown>>) =>
    render([
      {
        type: "Footer",
        props: { ...siteLibrary.components.Footer?.defaults, id: "f", text: "Thanks", ...props },
      },
    ]);
  const column = {
    type: "FooterColumn",
    props: { id: "c", content: [{ type: "Text", props: { id: "t", text: "<p>Open daily</p>" } }] },
  };
  const capped = CONTENT_WIDTHS.filter((width) => width !== "full");

  it("draws both at Full as before they had one, with no bar inside", () => {
    // A site saved before has no width: Full, and the same HTML (the golden tests check the export).
    expect(header({ contentWidth: "full" })).toBe(header({ contentWidth: undefined }));
    expect(header({})).toMatch(
      /^<header class="site-header relative z-30 navbar gap-2 px-4 bg-base-100 shadow-sm">/,
    );
    expect(header({})).not.toContain("site-header-bar");
    expect(footer({ contentWidth: "full" })).toBe(footer({ contentWidth: undefined }));
    expect(footer({})).toMatch(
      /^<footer class="site-footer footer footer-center bg-base-200 p-8 text-base-content"><p>/,
    );
    expect(footer({})).not.toContain("site-footer-content");
  });

  it.for(capped)(
    "caps the Header's bar at %s in every layout, the <header> across the page",
    (width) => {
      const bars: Readonly<Record<string, string>> = {
        left: "navbar gap-2 px-0",
        centred: "flex items-center justify-between gap-2 py-3 md:flex-col md:justify-center",
        split: "navbar gap-2 px-0",
      };
      for (const [variant, bar] of Object.entries(bars)) {
        const html = header({ variant, contentWidth: width });
        // The page's padding on the <header>, as a section's, so the bar lines up with one's content.
        expect(html, variant).toMatch(
          new RegExp(
            `^<header class="site-header relative z-30 px-4 bg-base-100 shadow-sm"><div class="site-header-bar mx-auto w-full ${CLASS[width]} ${bar}">`,
          ),
        );
        // The phone menu is placed against the <header>, across the page: the bar isn't positioned.
        expect(html, variant).toContain('<ul class="menu absolute inset-x-0 top-full');
        expect(/<div class="site-header-bar [^"]*"/.exec(html)?.[0], variant).not.toMatch(
          /relative|absolute|sticky/,
        );
      }
    },
  );

  it("keeps a sticky Header's scroll style on the <header>, and Shrink on the bar it shrinks", () => {
    for (const scrollStyle of ["shadow", "solid", "none"]) {
      const html = header({ sticky: true, scrollStyle, contentWidth: "wide" });
      expect(html, scrollStyle).toMatch(
        /^<header class="site-header relative z-30 px-4 sticky top-0 [^"]*" data-wf-sticky="">/,
      );
      expect(html, scrollStyle).not.toContain("in-data-scrolled");
    }
    const shrink = header({ sticky: true, scrollStyle: "shrink", contentWidth: "wide" });
    expect(shrink).toMatch(
      /^<header class="site-header relative z-30 px-4 sticky top-0 bg-base-100 shadow-sm \[:root:has\(&amp;\)\]:scroll-pt-20" data-wf-sticky=""><div class="site-header-bar mx-auto w-full max-w-6xl navbar gap-2 px-0 transition-\[min-height,padding\] in-data-scrolled:min-h-12 in-data-scrolled:py-1">/,
    );
    // At Full, on the <header> as before.
    expect(header({ sticky: true, scrollStyle: "shrink" })).toContain(
      "transition-[min-height,padding] data-scrolled:min-h-12 data-scrolled:py-1",
    );
  });

  it.for(capped)(
    "caps the Footer's content at %s in both layouts, with and without columns",
    (width) => {
      const grids: readonly [Readonly<Record<string, unknown>>, string][] = [
        [{ variant: "columns", columns: [] }, "footer sm:footer-horizontal"],
        [{ variant: "columns", columns: [column] }, "footer"],
        [{ variant: "centred", columns: [] }, "footer footer-center"],
        [{ variant: "centred", columns: [column] }, "footer footer-center grid-flow-row"],
      ];
      for (const [props, grid] of grids) {
        const html = footer({ ...props, contentWidth: width });
        const name = JSON.stringify(props);
        expect(html, name).toMatch(
          new RegExp(
            `^<footer class="site-footer bg-base-200 p-8 text-base-content"><div class="site-footer-content mx-auto ${CLASS[width]} ${grid}">`,
          ),
        );
        // The same parts as at Full, inside it: its columns and the bottom line under them (HF-5).
        const full = footer({ ...props, contentWidth: "full" });
        const inner = (markup: string) =>
          markup.replace(/^<footer [^>]*>(?:<div class="site-footer-content [^"]*">)?/, "");
        expect(inner(html).replace(/<\/div><\/footer>$/, "</footer>"), name).toBe(inner(full));
      }
    },
  );
});
