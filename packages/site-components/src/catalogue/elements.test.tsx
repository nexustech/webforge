import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { fieldsHiddenBy, holdsOverfullSlot, overfillsSlots } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext, ResolvedImage } from "../schema.js";
import { columnLayoutsFor, imageSizes, MAX_COLUMNS, MIN_COLUMNS } from "./column-layouts.js";
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

/** `type` in a Section at Medium, 896 px wide, whose width an Image's `sizes` reads (3.21). */
const inSection = (type: string, props: Record<string, unknown>) =>
  render("Section", {
    contentWidth: "medium",
    content: [{ type, props: { id: "inside", ...props } }],
  });

describe("the Image element (2.9)", () => {
  it("shows its Media image with its focal point in view, its alt text and its caption", () => {
    const html = inSection("Image", {
      image: { mediaId: "shop", alt: "The window" },
      caption: " On Mill Street ",
      rounded: true,
    });

    expect(html).toContain('<figure class="site-image w-full mx-auto max-w-none">');
    // As wide as a section's column on Desktop, the window below (X2).
    expect(html).toContain('sizes="(min-width: 1024px) 896px, (min-width: 768px) 100vw, 100vw"');
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
    expect(html).toContain('<figure class="site-image w-full ml-auto max-w-none md:max-w-md">');
    expect(html).toContain('alt="Our shop"');
    expect(html).not.toContain("<figcaption");
  });

  it("is full width above a device where it is narrower", () => {
    const html = render("Image", {
      image: { mediaId: "shop" },
      width: { $responsive: { desktop: "full", mobile: "small" } },
    });

    expect(html).toContain('<figure class="site-image w-full mx-auto max-w-xs md:max-w-none">');
  });

  it("shows a hint on the canvas without its image, and nothing in the export", () => {
    expect(render("Image", {})).toBe("");
    expect(render("Image", { image: { mediaId: "gone" } })).toBe("");

    const html = render("Image", {}, { ...context, emptyImage: () => "Choose an image" });
    expect(html).toContain("border-dashed");
    expect(html).toContain("Choose an image");
  });
});

describe("an Image's sizes (2.9, X2)", () => {
  it("asks for no wider a file than its width token", () => {
    expect(inSection("Image", { image: { mediaId: "shop" }, width: "small" })).toContain(
      'sizes="(min-width: 1024px) 320px, (min-width: 768px) min(320px, 100vw), min(320px, 100vw)"',
    );
  });

  it("asks for no wider a file than its column, side by side or stacked", () => {
    const inColumns = (layout: unknown, width = "full") =>
      inSection("Columns", {
        layout,
        columns: [
          {
            type: "Column",
            props: {
              id: "c1",
              content: [{ type: "Image", props: { id: "i", image: { mediaId: "shop" }, width } }],
            },
          },
        ],
      });

    // Half the section on Tablet and Desktop, the window on Mobile, where they stack.
    expect(inColumns({ $responsive: { desktop: "equal", mobile: "stacked" } })).toContain(
      'sizes="(min-width: 1024px) 448px, (min-width: 768px) 50vw, 100vw"',
    );
    // A wide column is two thirds; a small image never more than its width token.
    expect(inColumns("wideFirst")).toContain(
      'sizes="(min-width: 1024px) 597px, (min-width: 768px) 67vw, 67vw"',
    );
    expect(inColumns("wideFirst", "small")).toContain(
      'sizes="(min-width: 1024px) 320px, (min-width: 768px) min(320px, 67vw), min(320px, 67vw)"',
    );
  });
});

describe("an Image's sizes under a shape (3.19)", () => {
  const medium = () => 448;
  const portrait = () => ({ ratio: 3 / 4 });
  // In a Section at Medium (3.21).
  const section = 896;

  it("asks for the width a picture wider than its frame shows at, to cover the frame's height", () => {
    // A 16:9 photo in a Medium Portrait frame, 448 × 597, shows 1062 px wide, never upscaled.
    const sizes = imageSizes(medium, null, section, portrait, 16 / 9);
    expect(sizes).toBe(
      "(min-width: 1024px) 1062px, (min-width: 768px) min(1062px, 238vw), min(1062px, 238vw)",
    );
    const desktop = /^\(min-width: 1024px\) (?<px>\d+)px,/.exec(sizes)?.groups?.px;
    expect(Number(desktop)).toBeGreaterThanOrEqual(((448 * 4) / 3) * (16 / 9));
  });

  it("asks for the frame's width where the picture is narrower in proportion than it", () => {
    expect(imageSizes(medium, null, section, portrait, 2 / 3)).toBe(
      imageSizes(medium, null, section),
    );
    expect(imageSizes(medium, null, section, () => ({ ratio: 1 }), 1)).toBe(
      imageSizes(medium, null, section),
    );
  });

  it("asks under a set height for at least that height × the picture's proportions", () => {
    // A 3:2 picture 480 px high is 720 px wide, more than a Small frame's 320 px.
    expect(
      imageSizes(
        () => 320,
        null,
        section,
        () => ({ height: 480 }),
        3 / 2,
      ),
    ).toBe(
      "(min-width: 1024px) 720px, (min-width: 768px) max(min(320px, 100vw), 720px), max(min(320px, 100vw), 720px)",
    );
    // As wide as a section's column, the frame covers it already on Desktop.
    expect(
      imageSizes(
        () => undefined,
        null,
        section,
        () => ({ height: 240 }),
        3 / 2,
      ),
    ).toBe("(min-width: 1024px) 896px, (min-width: 768px) max(100vw, 360px), max(100vw, 360px)");
  });

  it("follows the shape on each device, in Columns too", () => {
    const shape = (breakpoint: string) => (breakpoint === "mobile" ? { ratio: 1 } : null);
    expect(imageSizes(() => undefined, "equal", section, shape, 16 / 9)).toBe(
      "(min-width: 1024px) 448px, (min-width: 768px) 50vw, 89vw",
    );
  });
});

describe("the Image element's shapes (3.19)", () => {
  const tall: ResolvedImage = { ...shop, width: 400, height: 600 };
  const of = (image: ResolvedImage): RenderContext => ({ ...context, image: () => image });

  it("draws as before with its picture's own shape, an existing Image reading as Original", () => {
    const before = render("Image", { image: { mediaId: "shop" }, rounded: true });
    expect(before).toContain('class="h-auto w-full rounded-box"');
    expect(before).not.toContain("object-cover");
    expect(render("Image", { image: { mediaId: "shop" }, rounded: true, shape: "original" })).toBe(
      before,
    );
  });

  it.each([
    ["square", "aspect-square"],
    ["landscape", "aspect-4/3"],
    ["wide", "aspect-video"],
    ["portrait", "aspect-3/4"],
  ])("cuts its picture to fill a %s frame around its focal point", (shape, aspect) => {
    for (const image of [shop, tall]) {
      const html = render("Image", { image: { mediaId: "it" }, shape, rounded: true }, of(image));
      expect(html).toContain(`class="w-full object-cover h-auto ${aspect} rounded-box"`);
      expect(html).toContain('style="object-position:30% 50%"');
    }
  });

  it("fills its width at a set height, per device", () => {
    const html = render("Image", {
      image: { mediaId: "shop" },
      shape: { $responsive: { desktop: "height", mobile: "square" } },
      height: { $responsive: { desktop: "large", tablet: "small" } },
    });
    expect(html).toContain(
      'class="w-full object-cover h-auto aspect-square md:aspect-auto md:h-60 lg:aspect-auto lg:h-120"',
    );
  });

  it("keeps the crop from Media on the devices it is Original on, on the canvas", () => {
    const cropped: ResolvedImage = { ...shop, aspectRatio: "1 / 1" };
    const html = render(
      "Image",
      { image: { mediaId: "it" }, shape: { $responsive: { desktop: "wide", mobile: "original" } } },
      of(cropped),
    );
    expect(html).toContain(
      'class="w-full object-cover h-auto aspect-[var(--picture-ratio,auto)] md:h-auto md:aspect-video"',
    );
    expect(html).toContain('style="object-position:30% 50%;--picture-ratio:1 / 1"');
    // Without a shape of its own, the crop is its inline shape, as before.
    expect(render("Image", { image: { mediaId: "it" } }, of(cropped))).toContain(
      'style="object-position:30% 50%;aspect-ratio:1 / 1;object-fit:cover"',
    );
  });

  it("asks for a file as wide as its cut picture shows", () => {
    const html = inSection("Image", {
      image: { mediaId: "shop" },
      width: "medium",
      shape: "portrait",
    });
    // 448 px wide and 597 high, a 640 × 427 picture shows 896 px wide, 200vw on a phone.
    expect(html).toContain(
      'sizes="(min-width: 1024px) 896px, (min-width: 768px) min(896px, 200vw), min(896px, 200vw)"',
    );
  });

  it("shows Height only while its Shape is Set height on some device", () => {
    const def = siteLibrary.components.Image;
    if (def === undefined) throw new Error("no Image");
    expect(fieldsHiddenBy(def, { ...def.defaults }).has("height")).toBe(true);
    expect(fieldsHiddenBy(def, { shape: "height" }).has("height")).toBe(false);
    expect(
      fieldsHiddenBy(def, { shape: { $responsive: { desktop: "wide", mobile: "height" } } }).has(
        "height",
      ),
    ).toBe(false);
    // The Spacer's Height is its own.
    const spacer = siteLibrary.components.Spacer;
    expect(spacer && fieldsHiddenBy(spacer, { ...spacer.defaults }).has("height")).toBe(false);
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

  it("takes the theme's button style unless the person chose one (PH2-14, #423)", () => {
    const def = siteLibrary.components.Button;
    expect(def?.defaults.style).toBe("theme");
    const style = def?.fields.style;
    expect(style?.kind === "select" ? style.options.map((option) => option.label) : []).toEqual([
      "Theme's style",
      "Filled",
      "Second colour",
      "Outline",
    ]);
    // The theme's: the main buttons' classes, which the theme's CSS styles.
    expect(render("Button", { label: "Order", style: "theme" })).toContain(
      'class="btn btn-primary"',
    );
    // Filled, as every Button was before: marked, so no theme's style reaches it.
    expect(render("Button", { label: "Order", style: "primary" })).toContain(
      'class="btn btn-primary wf-filled"',
    );
    // The Booking button is a Button with the theme's style too.
    const booking = def?.presets?.find((preset) => preset.id === "booking");
    expect({ ...def?.defaults, ...booking?.values }.style).toBe("theme");
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
    expect(render("Divider", {})).toBe('<hr class="site-divider my-4 border-base-content/10"/>');
    expect(render("Divider", { text: "or" })).toBe('<div class="site-divider divider">or</div>');
  });
});

describe("the Columns element (2.9)", () => {
  const twoColumns = [0, 1].map((index) => ({
    type: "Column",
    props: {
      id: `c${index}`,
      content: [{ type: "Text", props: { id: `t${index}`, text: "<p>Hi</p>" } }],
    },
  }));

  it("lays its columns out in a grid of its own, stacked on Mobile at first", () => {
    const defaults = siteLibrary.components.Columns?.defaults;
    const html = render("Columns", { ...defaults, columns: twoColumns });

    expect(html).toMatch(/^<div class="site-columns"><div class="grid grid-flow-row /);
    expect(html).toContain(" md:grid-flow-col md:auto-cols-fr ");
    expect(html).toContain(" gap-8");
    expect(
      html.match(/<div class="site-column min-w-0"><div class="flex flex-col gap-4">/g),
    ).toHaveLength(2);
  });

  it("starts with two columns, each with a text, whose ids a placed copy replaces", () => {
    const defaults = siteLibrary.components.Columns?.defaults;
    const columns = defaults?.columns as NodeDoc[] | undefined;
    expect(columns?.map((node) => node.type)).toEqual(["Column", "Column"]);
    expect(columns?.[0]?.props.content).toEqual([expect.objectContaining({ type: "Text" })]);
  });

  it("holds four columns at most, wherever it is (2.9)", () => {
    const columns = (count: number): NodeDoc => ({
      type: "Columns",
      props: {
        id: `cols-${count}`,
        columns: Array.from({ length: count }, (_, index) => ({
          type: "Column",
          props: { id: `${count}-${index}`, content: [] },
        })),
      },
    });
    const inSection = (node: NodeDoc): NodeDoc[] => [
      { type: "Section", props: { id: "s", content: [node] } },
    ];

    // A fifth added, or a Columns of five arriving: refused; four are fine.
    expect(overfillsSlots(siteLibrary, [], inSection(columns(MAX_COLUMNS)))).toBe(false);
    expect(overfillsSlots(siteLibrary, [], inSection(columns(MAX_COLUMNS + 1)))).toBe(true);
  });

  it("counts only the slots a change fills, not one already over its limit (#375)", () => {
    const column = (id: string): NodeDoc => ({ type: "Column", props: { id, content: [] } });
    const columns = (id: string, count: number): NodeDoc => ({
      type: "Columns",
      props: { id, columns: Array.from({ length: count }, (_, index) => column(`${id}${index}`)) },
    });
    const section = (...content: NodeDoc[]): NodeDoc[] => [
      { type: "Section", props: { id: "s", content } },
    ];
    // "over" holds five, as an old file might.
    const before = section(columns("over", MAX_COLUMNS + 1), columns("full", MAX_COLUMNS));
    const overfills = (...after: NodeDoc[]) =>
      overfillsSlots(siteLibrary, before, section(...after));

    // A fifth in "full", or a sixth in "over": refused, whatever else the page holds.
    expect(overfills(columns("over", MAX_COLUMNS + 1), columns("full", MAX_COLUMNS + 1))).toBe(
      true,
    );
    expect(overfills(columns("over", MAX_COLUMNS + 2), columns("full", MAX_COLUMNS))).toBe(true);
    // Anything else, and moves that leave "over" as full as it was: fine.
    const heading: NodeDoc = { type: "Heading", props: { id: "h" } };
    expect(overfills(columns("over", MAX_COLUMNS + 1), columns("full", MAX_COLUMNS), heading)).toBe(
      false,
    );
    expect(overfills(columns("full", MAX_COLUMNS), columns("over", MAX_COLUMNS + 1))).toBe(false);
    // Taking a column out of "over" is fine too.
    expect(overfills(columns("over", MAX_COLUMNS), columns("full", MAX_COLUMNS))).toBe(false);

    // What already holds a slot over its limit, which a copy of can't fix (#384).
    expect(holdsOverfullSlot(siteLibrary, section(columns("over", MAX_COLUMNS + 1)))).toBe(true);
    expect(holdsOverfullSlot(siteLibrary, section(columns("full", MAX_COLUMNS)))).toBe(false);
  });

  it("offers 2.17's presets for each number of columns", () => {
    expect(columnLayoutsFor(1)).toEqual(["equal", "stacked"]);
    expect(columnLayoutsFor(2)).toEqual(["equal", "wideFirst", "wideLast", "stacked"]);
    expect(columnLayoutsFor(3)).toEqual([
      "equal",
      "wideFirst",
      "wideMiddle",
      "wideLast",
      "stacked",
    ]);
    expect(columnLayoutsFor(MAX_COLUMNS)).toEqual(["equal", "stacked"]);
    expect([MIN_COLUMNS, MAX_COLUMNS]).toEqual([1, 4]);
  });
});

describe("the List element (2.9)", () => {
  const items = ["Bread", "Cakes"].map((text, index) => ({
    type: "ListItem",
    props: { id: `i${index}`, text },
  }));

  it("is a list of its items, with no element between them", () => {
    const html = render("List", { items });
    expect(html).toMatch(/^<ul class="site-list [^"]*list-disc space-y-2 pl-6">/);
    expect(html).toMatch(
      /"><li class="site-list-item">Bread<\/li><li class="site-list-item">Cakes<\/li><\/ul>$/,
    );
    expect(render("List", { items, style: "numbers" })).toMatch(
      /^<ol class="site-list [^"]* list-decimal/,
    );
    expect(render("List", { items, style: "plain" })).toContain("list-none space-y-2");
  });

  it("stays a list for Safari's screen reader without markers", () => {
    expect(render("List", { items, style: "plain" })).toMatch(/^<ul class="[^"]*" role="list">/);
    expect(render("List", { items })).not.toContain('role="list"');
  });
});

describe("icons (2.9b, F-ED-22)", () => {
  it("draws an Icon as inline SVG, with no icon font or request (C8)", () => {
    const html = render("Icon", { icon: "phone", size: "large", color: "primary" });

    expect(html).toMatch(
      /^<div class="site-icon flex justify-start"><svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 24 24"/,
    );
    expect(html).toContain('class="size-12 text-primary" aria-hidden="true"><path d="');
    expect(html).not.toMatch(/<link|<img|@font-face|<use /);
  });

  it("names an Icon for screen readers only when it has a label", () => {
    expect(render("Icon", { icon: "phone", label: " Phone " })).toContain(
      'role="img" aria-label="Phone"',
    );
    expect(render("Icon", { icon: "phone" })).toContain('aria-hidden="true"');
  });

  it("draws an Icon's own icon for a name Lucide doesn't have, and no icon on a Button", () => {
    // As any field reads what it can't use: the Icon's default, a star.
    expect(render("Icon", { icon: "not-an-icon" })).toBe(render("Icon", { icon: "star" }));
    expect(render("Button", { label: "Call", icon: "not-an-icon" })).not.toContain("<svg");
  });

  it("puts a Button's icon before its text", () => {
    const html = render("Button", { label: "Call us", icon: "phone" });

    expect(html).toContain('<a class="btn btn-primary"');
    expect(html).toContain('class="size-[1em]" aria-hidden="true">');
    expect(html).toMatch(/<\/svg>Call us<\/a><\/div>$/);
  });

  it("shows a List's icon before each item instead of its markers", () => {
    const items = ["Bread", "Cakes"].map((text, index) => ({
      type: "ListItem",
      props: { id: `i${index}`, text },
    }));
    const html = render("List", { items, style: "numbers", icon: "check" });

    expect(html).toMatch(/^<ul class="site-list [^"]*list-none space-y-2" role="list">/);
    expect(html.match(/<li class="site-list-item flex items-start gap-2"><svg/g)).toHaveLength(2);
    expect(html).toContain("<span>Bread</span>");
  });
});

describe("a List's style while it has an icon (2.9b)", () => {
  const unavailable = (values: Record<string, unknown>) =>
    siteLibrary.components.List?.fields.style?.unavailable?.(values);

  it("is unavailable while an icon takes the place of its markers, saying why", () => {
    expect(unavailable({ icon: "check" })).toBe(
      "The list's icon takes the place of its markers. Remove the icon to choose a style.",
    );
    expect(unavailable({})).toBeUndefined();
    // A name Lucide doesn't have draws no icon, so the markers, and their style, stay.
    expect(unavailable({ icon: "not-an-icon" })).toBeUndefined();
  });
});

describe("Social links (2.9b, PH2-4)", () => {
  const profiles: RenderContext["socialProfiles"] = [
    { network: "facebook", url: "https://www.facebook.com/ourbakery" },
    { network: "linkedin", url: "https://www.linkedin.com/company/ourbakery" },
    { network: "custom", url: "https://www.mastodon.social/@ourbakery" },
  ];

  it("links to each Site Settings profile by its logo, named for screen readers", () => {
    const html = render(
      "SocialLinks",
      { color: "primary" },
      { ...context, socialProfiles: profiles },
    );

    expect(html).toMatch(
      /^<ul class="site-social flex flex-wrap gap-3 justify-start [^"]*" role="list">/,
    );
    expect(html).toContain(
      '<a href="https://www.facebook.com/ourbakery" rel="me" aria-label="Facebook" title="Facebook"><svg',
    );
    expect(html).toContain(
      'fill="currentColor" class="size-6 text-primary" aria-hidden="true"><path d="M9.101',
    );
    // LinkedIn and other sites have no logo here: a globe, named by the network or host (PH2-12).
    expect(html).toContain('aria-label="LinkedIn"');
    expect(html).toContain('aria-label="mastodon.social"');
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).not.toMatch(/<link|<img|@font-face|<use /);
  });

  it("shows nothing in the export without profiles, and the canvas's hint there", () => {
    expect(render("SocialLinks", {}, { ...context, socialProfiles: [] })).toBe("");
    expect(render("SocialLinks", {})).toBe("");
    expect(
      render("SocialLinks", {}, { ...context, socialHint: () => "Add your social profiles" }),
    ).toBe(
      '<div class="site-social flex flex-wrap gap-3 justify-start">Add your social profiles</div>',
    );
  });
});
