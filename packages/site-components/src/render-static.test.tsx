import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary, starterLayout, starterPage } from "./catalogue.js";
import { EDITOR_RENDER_CONTEXT, type RenderContext, type ResolvedImage } from "./library.js";
import {
  behavioursUsedBy,
  mediaUsedBy,
  renderNodesToHtml,
  UnknownComponentError,
  walkNodes,
} from "./render-static.js";

const heroImage: ResolvedImage = {
  sources: [{ type: "image/webp", srcset: "assets/img/hero-640.webp 640w" }],
  src: "assets/img/hero-640.jpg",
  fallback: { type: "image/jpeg", srcset: "assets/img/hero-640.jpg 640w" },
  width: 640,
  height: 427,
  alt: "Our bakery",
  objectPosition: "30% 50%",
};

const context: RenderContext = {
  navigation: [
    { label: "Home", href: "index.html", current: true },
    { label: "About", href: "about.html", current: false },
  ],
  link: (target) => `${target}.html`,
  image: (id) => (id === "hero" ? heroImage : null),
};

const faqNodes: NodeDoc[] = [
  {
    type: "Faq",
    props: {
      id: "faq",
      title: "Questions",
      items: [
        {
          type: "FaqItem",
          props: { id: "q1", question: "Open on Sunday?", answer: "<p>Yes, 9 to 5.</p>" },
        },
      ],
    },
  },
];

describe("renderNodesToHtml", () => {
  it("renders a page's sections and elements without editor wrappers", () => {
    const html = renderNodesToHtml(starterPage().content, siteLibrary, context);

    expect(html).toBe(
      '<section class="site-section mx-auto max-w-4xl space-y-6 px-4 py-16">' +
        '<h1 class="site-heading text-4xl font-bold md:text-5xl">Welcome to our business</h1>' +
        '<div class="site-text text-lg leading-relaxed [&amp;_a]:underline [&amp;_p+p]:mt-4">' +
        '<div class="contents"><p>Tell visitors what you do and why they will love it.</p></div>' +
        "</div></section>",
    );
  });

  it("sanitises rich text: scripts, event handlers and javascript: links are dropped", () => {
    const nodes: NodeDoc[] = [
      {
        type: "Text",
        props: {
          id: "t",
          text: '<p onclick="x()">Hi<script>alert(1)</script> <a href="javascript:alert(1)">a</a> <a href="https://example.com" style="color:red">b</a></p><style>body{}</style>',
        },
      },
    ];

    const html = renderNodesToHtml(nodes, siteLibrary, context);

    expect(html).toContain('<p>Hi <a>a</a> <a href="https://example.com">b</a></p>');
    expect(html).not.toMatch(/script|onclick|javascript|style=|<style/);
  });

  it("renders the header with navigation, the current page and the menu toggle", () => {
    const html = renderNodesToHtml(starterLayout("Rosa's Bakery").header, siteLibrary, context);

    expect(html).toContain('<a class="text-xl font-bold" href="index.html">Rosa&#x27;s Bakery</a>');
    expect(html).toContain('<nav aria-label="Main navigation">');
    expect(html).toContain('aria-controls="header-menu" data-wf-menu-toggle=""');
    expect(html).toContain('<ul id="header-menu"');
    expect(html).toContain('<a href="index.html" aria-current="page">Home</a>');
    expect(html).toContain('<a href="about.html">About</a>');
    expect(html).toContain('<span class="sr-only">Menu</span>');
  });

  it("links the site name to the home page, wherever it is in the navigation", () => {
    const reordered: RenderContext = { ...context, navigation: [...context.navigation].reverse() };

    const html = renderNodesToHtml(starterLayout("Bakery").header, siteLibrary, reordered);

    expect(html).toContain('<a class="text-xl font-bold" href="index.html">Bakery</a>');
  });

  it("renders a hero with a responsive image and a link to another page", () => {
    const nodes: NodeDoc[] = [
      {
        type: "Hero",
        props: {
          id: "hero",
          title: "Fresh bread",
          text: "Daily",
          buttonLabel: "About us",
          buttonLink: "about",
          alignment: "left",
          image: { mediaId: "hero", alt: "Loaves on a shelf" },
        },
      },
    ];

    const html = renderNodesToHtml(nodes, siteLibrary, context);

    expect(html).toContain(
      '<div class="hero-content max-w-6xl flex-col gap-10 lg:flex-row-reverse text-left">',
    );
    expect(html).toContain(
      '<source type="image/webp" srcSet="assets/img/hero-640.webp 640w" sizes="(min-width: 1024px) 50vw, 100vw"/>',
    );
    expect(html).toContain('alt="Loaves on a shelf" loading="eager" decoding="async"');
    // The focal point keeps the important part in view where CSS cuts the image (G14).
    expect(html).toContain('style="object-position:30% 50%"');
    expect(html).toContain('width="640" height="427"');
    expect(html).toContain('<a class="btn btn-primary" href="about.html">About us</a>');
  });

  it("leaves out the hero's image and button when they are not set", () => {
    const nodes: NodeDoc[] = [
      { type: "Hero", props: { id: "hero", title: "Hi", buttonLabel: "", image: "missing" } },
    ];

    const html = renderNodesToHtml(nodes, siteLibrary, EDITOR_RENDER_CONTEXT);

    expect(html).toContain("text-center");
    expect(html).not.toContain("<picture>");
    expect(html).not.toContain("btn");
  });

  it("renders an FAQ as native details elements", () => {
    const html = renderNodesToHtml(faqNodes, siteLibrary, context);

    expect(html).toContain('<h2 class="text-3xl font-bold">Questions</h2>');
    expect(html).toContain(
      '<summary class="collapse-title font-semibold">Open on Sunday?</summary>',
    );
    expect(html).toContain('<div class="contents"><p>Yes, 9 to 5.</p></div>');
  });

  it("renders the footer and section paddings", () => {
    const html = renderNodesToHtml(
      [
        ...starterLayout("x").footer,
        { type: "Section", props: { id: "s", padding: "large", content: "not a list" } },
      ],
      siteLibrary,
      context,
    );

    expect(html).toContain(
      '<footer class="site-footer footer footer-center bg-base-200 p-8 text-base-content"><p>Thanks for visiting.</p></footer>',
    );
    expect(html).toContain("py-24");
  });

  it("renders a section's per-device padding and gap, mobile first, and its full width", () => {
    const html = renderNodesToHtml(
      [
        {
          type: "Section",
          props: {
            id: "s",
            padding: { $responsive: { desktop: "large", mobile: "small" } },
            gap: { $responsive: { desktop: "medium", tablet: "none" } },
            fullWidth: true,
            content: [],
          },
        },
      ],
      siteLibrary,
      context,
    );

    expect(html).toContain(
      '<section class="site-section mx-auto space-y-0 lg:space-y-6 px-4 py-8 md:py-24">',
    );
  });

  it("throws for an unknown component type, even inside a slot", () => {
    const nodes: NodeDoc[] = [
      {
        type: "Section",
        props: { id: "s", content: [{ type: "Carousel", props: { id: "c" } }] },
      },
    ];

    expect(() => renderNodesToHtml(nodes, siteLibrary, context)).toThrow(UnknownComponentError);
    expect(() => renderNodesToHtml(nodes, siteLibrary, context)).toThrow('"Carousel"');
  });
});

describe("tree helpers", () => {
  it("walkNodes visits nodes in document order, including slots", () => {
    const types: string[] = [];
    walkNodes([...starterPage().content, ...faqNodes], siteLibrary, (node) =>
      types.push(node.type),
    );

    expect(types).toEqual(["Section", "Heading", "Text", "Faq", "FaqItem"]);
  });

  it("uses the image's own alt text when the placement has none (G15)", () => {
    const html = renderNodesToHtml(
      [{ type: "Hero", props: { id: "hero", title: "Fresh bread", image: { mediaId: "hero" } } }],
      siteLibrary,
      context,
    );

    expect(html).toContain('alt="Our bakery"');
  });

  it("mediaUsedBy finds media ids in media fields only", () => {
    const nodes: NodeDoc[] = [
      { type: "Hero", props: { id: "a", image: { mediaId: "hero" }, title: "hero2" } },
      { type: "Hero", props: { id: "b", image: "old-style id" } },
      { type: "Hero", props: { id: "c" } },
    ];

    expect([...mediaUsedBy(nodes, siteLibrary)]).toEqual(["hero"]);
  });

  it("leaves hidden nodes, and everything in them, out of the export (F-ED-12)", () => {
    const nodes: NodeDoc[] = [
      {
        type: "Section",
        props: {
          id: "s",
          content: [
            { type: "Heading", props: { id: "shown", text: "Shown" } },
            { type: "Heading", props: { id: "gone", text: "Hidden heading", hidden: true } },
          ],
        },
      },
      {
        type: "Hero",
        props: { id: "hero", title: "Hidden hero", image: { mediaId: "hero" }, hidden: true },
      },
      { type: "Section", props: { id: "s2", hidden: true, content: starterLayout("x").header } },
      // A hidden node isn't rendered, so its unknown type doesn't fail the build either.
      { type: "Gone", props: { id: "old", hidden: true } },
    ];

    const html = renderNodesToHtml(nodes, siteLibrary, context);

    expect(html).toContain("Shown");
    expect(html).not.toContain("Hidden heading");
    expect(html).not.toContain("Hidden hero");
    expect(html).not.toContain("hero-640");
    expect([...mediaUsedBy(nodes, siteLibrary)]).toEqual([]);
    expect(behavioursUsedBy(nodes, siteLibrary)).toEqual([]);
    const visited: string[] = [];
    walkNodes(nodes, siteLibrary, (node) => visited.push(node.props.id));
    expect(visited).toEqual(["s", "shown"]);
  });

  it("behavioursUsedBy lists the scripts the components need", () => {
    expect(behavioursUsedBy(starterLayout("x").header, siteLibrary)).toEqual(["menu"]);
    expect(behavioursUsedBy(starterPage().content, siteLibrary)).toEqual([]);
  });
});
