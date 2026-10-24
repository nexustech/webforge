import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { slotsOverfull } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext, ResolvedImage } from "../schema.js";
import { columnLayoutsFor, MAX_COLUMNS, MIN_COLUMNS } from "./column-layouts.js";
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
    expect(render("Image", { image: { mediaId: "shop" }, width: "small" })).toContain(
      'sizes="(min-width: 1024px) 320px, (min-width: 768px) min(320px, 100vw), min(320px, 100vw)"',
    );
  });

  it("asks for no wider a file than its column, side by side or stacked", () => {
    const inColumns = (layout: unknown, width = "full") =>
      render("Columns", {
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

    expect(slotsOverfull(siteLibrary, inSection(columns(MAX_COLUMNS)))).toBe(false);
    expect(slotsOverfull(siteLibrary, inSection(columns(MAX_COLUMNS + 1)))).toBe(true);
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
