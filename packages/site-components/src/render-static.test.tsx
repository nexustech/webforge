import {
  expandSharedCopies,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
} from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary, starterLayout, starterPage } from "./catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import {
  behavioursUsedBy,
  documentsLinkedBy,
  mediaUsedBy,
  renderNodesToHtml,
  UnknownComponentError,
  walkNodes,
} from "./render-static.js";
import type { RenderContext, ResolvedImage } from "./schema.js";

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
  href: (link) => (link.kind === "page" ? `${link.pageId}.html` : "#"),
  image: (id) => (id === "hero" ? heroImage : null),
  setting: (key) => (key === "general.name" ? "Rosa's Bakery" : undefined),
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

  it("keeps a paragraph's alignment, and no other style (F-ED-3)", () => {
    const nodes: NodeDoc[] = [
      {
        type: "Text",
        props: {
          id: "t",
          text: '<p style="text-align: center; color: red">Hi</p><p style="font-size: 40px">Big</p><p style="text-align: url(x)">Odd</p>',
        },
      },
    ];

    const html = renderNodesToHtml(nodes, siteLibrary, context);

    expect(html).toContain('<p style="text-align:center">Hi</p><p>Big</p><p>Odd</p>');
  });

  // Hostile input a future sanitize-html upgrade must keep refusing (#160 review).
  it.each([
    ['<p style="text-align: url(x)">a</p>', "<p>a</p>"],
    [
      '<p style="text-align: center; text-align: expression(alert(1))">a</p>',
      '<p style="text-align:center">a</p>',
    ],
    // A CSS escape: `\63 enter` is "center".
    ['<p style="text-align: \\63 enter">a</p>', "<p>a</p>"],
    ['<p style="TEXT-ALIGN: CENTER">a</p>', "<p>a</p>"],
    ['<p style="text-align: center;}body{color:red">a</p>', '<p style="text-align:center">a</p>'],
    ['<p style="background: url(javascript:alert(1))">a</p>', "<p>a</p>"],
    ['<ul><li style="text-align: center">a</li></ul>', "<ul><li>a</li></ul>"],
    ['<p><a href="javascript:alert(1)">a</a></p>', "<p><a>a</a></p>"],
    ['<p><a href=" JavaScript:alert(1)">a</a></p>', "<p><a>a</a></p>"],
    ['<p><a href="data:text/html,x">a</a></p>', "<p><a>a</a></p>"],
    ['<p><a href="//evil.example/x">a</a></p>', "<p><a>a</a></p>"],
  ])("refuses hostile rich text: %s", (text, expected) => {
    const nodes: NodeDoc[] = [{ type: "Text", props: { id: "t", text } }];

    expect(renderNodesToHtml(nodes, siteLibrary, context)).toContain(
      `<div class="contents">${expected}</div>`,
    );
  });

  it("points rich text's links to the site's pages at their files, new tabs as the dialog makes them", () => {
    const nodes: NodeDoc[] = [
      {
        type: "Text",
        props: {
          id: "t",
          text:
            '<p><a href="webforge:page/page-about">About</a> ' +
            '<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">Web</a> ' +
            '<a target="_top" rel="opener" href="https://example.com/x">Top</a></p>',
        },
      },
    ];

    expect(renderNodesToHtml(nodes, siteLibrary, context)).toContain(
      '<p><a href="page-about.html">About</a> ' +
        '<a href="https://example.com" target="_blank" rel="noopener">Web</a> ' +
        '<a href="https://example.com/x">Top</a></p>',
    );
  });

  it("points rich text's links to documents at their files, saved when so set (1.28)", () => {
    const documents: RenderContext = {
      ...context,
      href: (link) =>
        link.kind === "file" && link.mediaId === "menu" ? `files/${link.mediaId}.pdf` : "#",
    };
    const nodes: NodeDoc[] = [
      {
        type: "Text",
        props: {
          id: "t",
          text:
            '<p><a target="_blank" href="webforge:file/menu">Menu</a> ' +
            '<a href="webforge:file/menu?download">Save</a> ' +
            '<a href="webforge:file/gone?download">Gone</a> ' +
            '<a href="https://example.com" download="evil.exe">Web</a> ' +
            '<a href="about.html" download>Page</a></p>',
        },
      },
    ];

    expect(renderNodesToHtml(nodes, siteLibrary, documents)).toContain(
      '<p><a href="files/menu.pdf" target="_blank" rel="noopener">Menu</a> ' +
        '<a href="files/menu.pdf" download>Save</a> ' +
        // `download` only on a document's file: never on `#` (a deleted document), a web address
        // or a page, where it would save that page instead.
        '<a href="#">Gone</a> ' +
        '<a href="https://example.com">Web</a> ' +
        '<a href="about.html">Page</a></p>',
    );
  });

  it("renders the header with navigation, the current page and the menu toggle", () => {
    const html = renderNodesToHtml(starterLayout("Rosa's Bakery").header, siteLibrary, context);

    expect(html).toContain('<a class="text-xl font-bold" href="index.html">Rosa&#x27;s Bakery</a>');
    expect(html).toContain('<nav aria-label="Main navigation">');
    // A row on wide screens; on small ones a menu that opens without the script too (2.6).
    expect(html).toContain('<ul class="menu menu-horizontal hidden p-0 md:flex">');
    expect(html).toContain('<details class="site-menu md:hidden" data-wf-menu="">');
    expect(html).toContain('<span class="sr-only">Menu</span></summary>');
    expect(html.match(/<a href="index.html" aria-current="page">Home<\/a>/g)).toHaveLength(2);
    expect(html).toContain('<a href="about.html">About</a>');
  });

  it("renders the menu's buttons, new tabs and dropdowns (F-ED-17)", () => {
    const html = renderNodesToHtml(starterLayout("Rosa's Bakery").header, siteLibrary, {
      ...context,
      navigation: [
        {
          label: "Visit us",
          current: false,
          children: [
            { label: "Questions", href: "index.html#questions", current: false },
            { label: "Find us", href: "https://example.com/map", current: false, newTab: true },
          ],
        },
        { label: "Order a cake", href: "about.html", current: false, button: true },
      ],
    });

    // The dropdown: a <details>, which opens and says whether it is open without the script too.
    expect(html).toContain(
      '<details class="site-submenu" data-wf-dropdown=""><summary>Visit us</summary><ul class="md:z-20 md:w-48"',
    );
    expect(html).toContain('<a href="index.html#questions">Questions</a>');
    expect(html).toContain(
      '<a href="https://example.com/map" target="_blank" rel="noopener">Find us</a>',
    );
    expect(html).toContain(
      '<a href="about.html" class="btn btn-primary btn-sm md:ml-2">Order a cake</a>',
    );
  });

  it("holds the same links in the row on wide screens as in the menu on small ones (2.6)", () => {
    const [header] = starterLayout("Bakery").header;
    if (header === undefined) throw new Error("No Header");
    const navigation: RenderContext["navigation"] = [
      { label: "Home", href: "index.html", current: true },
      {
        label: "Visit us",
        current: false,
        children: [
          { label: "Questions", href: "index.html#questions", current: false },
          { label: "Find us", href: "https://example.com/map", current: false, newTab: true },
        ],
      },
      { label: "Book now", href: "about.html", current: false, button: true },
    ];
    /** The links (their whole tags) between `start` and `end` in `html`, in order. */
    const linksIn = (html: string, start: string, end: string) => {
      const from = html.indexOf(start);
      return html.slice(from, html.indexOf(end, from)).match(/<a [^>]*>[^<]*<\/a>/g) ?? [];
    };

    for (const variant of ["left", "centred", "split"]) {
      const html = renderNodesToHtml(
        [{ ...header, props: { ...header.props, variant } }],
        siteLibrary,
        { ...context, navigation },
      );
      const row = linksIn(html, '<ul class="menu menu-horizontal', '<details class="site-menu');
      const menu = linksIn(html, '<details class="site-menu', "</nav>");
      // The split layout draws its last link as a button beside the row instead.
      const beside = linksIn(html, "</nav>", "</header>");
      const plain = (tag: string) => tag.replace(/ class="[^"]*"/, "");

      expect(menu, variant).toHaveLength(4);
      expect([...row, ...beside].map(plain), variant).toEqual(menu.map(plain));
    }
  });

  it("draws the split Header's last link as a button beside the row, still in the menu (2.6)", () => {
    const [header] = starterLayout("Bakery").header;
    if (header === undefined) throw new Error("No Header");
    const split: NodeDoc = { ...header, props: { ...header.props, variant: "split" } };

    const html = renderNodesToHtml([split], siteLibrary, {
      ...context,
      navigation: [
        { label: "Home", href: "index.html", current: false },
        { label: "Book now", href: "about.html", current: true },
      ],
    });

    // The button keeps saying it's the page you're on.
    expect(html).toContain(
      '<a href="about.html" aria-current="page" class="btn btn-primary hidden md:inline-flex">Book now</a>',
    );
    // Once beside the row and once in the menu on small screens: not in the row as well.
    expect(html.match(/>Book now<\/a>/g)).toHaveLength(2);
    expect(html.match(/>Home<\/a>/g)).toHaveLength(2);
  });

  it("puts the centred Header's site name above its menu, with no wrapper (2.6)", () => {
    const [header] = starterLayout("Bakery").header;
    if (header === undefined) throw new Error("No Header");

    const html = renderNodesToHtml(
      [{ ...header, props: { ...header.props, variant: "centred" } }],
      siteLibrary,
      context,
    );

    expect(html).toContain("md:flex-col md:justify-center");
    expect(html).toMatch(/<header [^>]*><a class="text-xl font-bold"/);
    expect(html).not.toContain("btn-primary hidden");
  });

  it("lists the menu's links, dropdowns' too, in the Footer's columns (2.6)", () => {
    const html = renderNodesToHtml(
      [{ type: "Footer", props: { id: "footer", text: "Thanks.", variant: "columns" } }],
      siteLibrary,
      {
        ...context,
        navigation: [
          { label: "Home", href: "index.html", current: true },
          {
            label: "Visit us",
            current: false,
            children: [
              { label: "Find us", href: "https://example.com/map", current: false, newTab: true },
            ],
          },
        ],
      },
    );

    expect(html).toContain('<nav aria-label="Footer navigation"');
    expect(html).toContain(
      '<a href="index.html" aria-current="page" class="link link-hover">Home</a>',
    );
    expect(html).toContain(
      '<a href="https://example.com/map" class="link link-hover" target="_blank" rel="noopener">Find us</a>',
    );
    expect(html).not.toContain("Visit us");
  });

  it("links the site name to the home page, wherever it is in the navigation", () => {
    const reordered: RenderContext = { ...context, navigation: [...context.navigation].reverse() };

    const html = renderNodesToHtml(starterLayout("Bakery").header, siteLibrary, reordered);

    // The starter Header shows Site Settings' name, not the text it was created with (1.17).
    expect(html).toContain('<a class="text-xl font-bold" href="index.html">Rosa&#x27;s Bakery</a>');
  });

  it("shows a field's own text until it is bound, and leaves an empty binding out", () => {
    const footer = (props: Record<string, unknown>): NodeDoc[] => [
      { type: "Footer", props: { id: "footer", text: "Thanks for visiting.", ...props } },
    ];

    expect(renderNodesToHtml(footer({}), siteLibrary, context)).toContain(
      "<p>Thanks for visiting.</p>",
    );
    // contact.phone is empty here: the export leaves it out, with no empty paragraph or heading.
    const empty = renderNodesToHtml(
      footer({ bindings: { text: "contact.phone" } }),
      siteLibrary,
      context,
    );
    expect(empty).toContain("site-footer");
    expect(empty).not.toContain("<p>");
    expect(
      renderNodesToHtml(
        [
          {
            type: "Heading",
            props: { id: "h", text: "Call", bindings: { text: "contact.phone" } },
          },
        ],
        siteLibrary,
        context,
      ),
    ).toBe("");
    // The canvas shows a hint instead.
    expect(
      renderNodesToHtml(footer({ bindings: { text: "contact.phone" } }), siteLibrary, {
        ...context,
        emptySetting: (key) => `Add ${key}`,
      }),
    ).toContain("<p>Add contact.phone</p>");
    // A binding to a setting that does not exist is ignored.
    expect(
      renderNodesToHtml(footer({ bindings: { text: "contact.fax" } }), siteLibrary, context),
    ).toContain("<p>Thanks for visiting.</p>");
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

  describe("the Hero's layouts (2.6)", () => {
    const heroIn = (variant: string, props: Record<string, unknown> = {}) =>
      renderNodesToHtml(
        [
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
              variant,
              ...props,
            },
          },
        ],
        siteLibrary,
        context,
      );

    it("centres the text with the image below it, whatever the alignment", () => {
      const html = heroIn("centred");

      expect(html).toContain('<div class="hero-content max-w-4xl flex-col gap-10 text-center">');
      expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("<picture>"));
      expect(html).toContain('sizes="(min-width: 896px) 896px, 100vw"');
    });

    it("sets the text over the image, which fills the section with its focal point in view", () => {
      const html = heroIn("background");

      expect(html).toContain(
        '<section class="site-hero relative flex min-h-[28rem] items-center justify-center',
      );
      expect(html).toContain('sizes="100vw"');
      expect(html).toContain(
        'class="absolute inset-0 h-full w-full object-cover" style="object-position:30% 50%"',
      );
      // The overlay comes after the image, the text after both: drawn in that order.
      expect(html.indexOf("<picture>")).toBeLessThan(html.indexOf("bg-neutral/70"));
      expect(html).toContain(
        '<div class="hero-content relative max-w-6xl text-neutral-content text-left">',
      );
    });

    it("shows text only, leaving out an image it was given", () => {
      const html = heroIn("minimal", { alignment: "centre" });

      expect(html).not.toContain("<picture>");
      expect(html).toContain('<div class="mx-auto max-w-3xl text-center">');
      expect(html).toContain('<a class="btn btn-primary" href="about.html">About us</a>');
    });
  });

  it("renders a Text section: its title and formatted text in a readable column (2.6)", () => {
    const html = renderNodesToHtml(
      [
        {
          type: "TextSection",
          props: { id: "story", title: "Our story", text: "<p>Since 1998.</p><p>In Hightown.</p>" },
        },
      ],
      siteLibrary,
      context,
    );

    expect(html).toContain(
      '<div class="mx-auto max-w-3xl"><h2 class="text-3xl font-bold">Our story</h2>',
    );
    expect(html).toContain("<p>Since 1998.</p><p>In Hightown.</p>");
  });

  it("puts Text + Image's image right or left, its text first in the page either way (2.6)", () => {
    const textImage = (variant: string) =>
      renderNodesToHtml(
        [
          {
            type: "TextImage",
            props: {
              id: "what",
              title: "What we bake",
              text: "<p>Bread.</p>",
              image: { mediaId: "hero" },
              variant,
            },
          },
        ],
        siteLibrary,
        context,
      );

    const right = textImage("imageRight");
    const left = textImage("imageLeft");

    expect(right.indexOf("<h2")).toBeLessThan(right.indexOf("<picture>"));
    expect(right).not.toContain("md:order-first");
    expect(left.indexOf("<h2")).toBeLessThan(left.indexOf("<picture>"));
    expect(left).toContain('<div class="md:order-first"><picture>');
    // The image's own alt text, as the section doesn't set one.
    expect(left).toContain('alt="Our bakery" loading="lazy"');
  });

  it("draws a Call to action as a banner or with its button beside the text (2.6)", () => {
    const cta = (variant: string, buttonLabel = "Book a table") =>
      renderNodesToHtml(
        [
          {
            type: "CallToAction",
            props: {
              id: "cta",
              title: "Come and see us",
              text: "Open every day.",
              buttonLabel,
              buttonLink: "about",
              variant,
            },
          },
        ],
        siteLibrary,
        context,
      );

    expect(cta("banner")).toContain('<section class="site-cta bg-neutral text-neutral-content');
    expect(cta("banner")).toContain(
      '<a class="btn btn-primary btn-lg mt-8" href="about.html">Book a table</a>',
    );
    expect(cta("split")).toContain("md:flex-row md:items-center md:justify-between");
    expect(cta("split")).toContain(
      '<a class="btn btn-primary btn-lg shrink-0" href="about.html">Book a table</a>',
    );
    expect(cta("banner", "")).not.toContain("<a ");
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

  it("puts an element's Advanced-mode classes, attributes and anchor on its root element", () => {
    const html = renderNodesToHtml(
      [
        {
          type: "Heading",
          props: {
            id: "h",
            text: "Prices",
            size: "medium",
            advanced: { className: "shadow-lg", anchorId: "prices", attributes: { role: "note" } },
          },
        },
      ],
      siteLibrary,
      context,
    );

    expect(html).toBe(
      '<h2 class="site-heading text-3xl font-bold shadow-lg" role="note" id="prices">Prices</h2>',
    );
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

  it("renders a page saved before 1.32 exactly as before, and its box form the same (1.32)", () => {
    const page = (first: unknown, second: unknown): NodeDoc[] => [
      {
        type: "Hero",
        props: { id: "h", title: "Rosa's Bakery", text: "Fresh bread", buttonLabel: "" },
      },
      {
        type: "Section",
        props: {
          id: "a",
          padding: first,
          content: [{ type: "Heading", props: { id: "t", text: "Hi", size: "small" } }],
        },
      },
      { type: "Section", props: { id: "b", padding: second } },
      { type: "Section", props: { id: "c" } },
    ];
    const legacy = page("medium", { $responsive: { desktop: "large", mobile: "small" } });
    const html = renderNodesToHtml(legacy, siteLibrary, context);

    expect(html).toContain('<section class="site-hero hero bg-base-200 px-4 py-16">');
    expect(html).toContain(
      '<section class="site-section mx-auto max-w-4xl space-y-6 px-4 py-16"><h3 class="site-heading text-xl font-semibold">Hi</h3></section>',
    );
    expect(html).toContain(
      '<section class="site-section mx-auto max-w-4xl space-y-6 px-4 py-8 md:py-24"></section>',
    );
    expect(html).toContain(
      '<section class="site-section mx-auto max-w-4xl space-y-6 px-4 py-16"></section>',
    );

    const box = page(
      { top: "m", bottom: "m" },
      { $responsive: { desktop: { top: "l", bottom: "l" }, mobile: { top: "s", bottom: "s" } } },
    );
    expect(renderNodesToHtml(box, siteLibrary, context)).toBe(html);
  });

  it("renders the padding and margin set per side (1.32)", () => {
    const margin = { $responsive: { desktop: { top: "s" }, mobile: { top: "xl" } } };
    const html = renderNodesToHtml(
      [
        {
          type: "Hero",
          props: { id: "h", title: "T", padding: { left: "none", top: "xl" }, margin },
        },
        {
          type: "Section",
          props: {
            id: "s",
            padding: { top: "none", right: "s", bottom: "none", left: "s" },
            margin: { bottom: "l" },
            content: [
              { type: "Heading", props: { id: "t", text: "Hi", size: "small", margin } },
              { type: "Text", props: { id: "x", text: "<p>a</p>", margin: { bottom: "m" } } },
              { type: "Faq", props: { id: "f", title: "Q", margin: { top: "s", bottom: "s" } } },
            ],
          },
        },
      ],
      siteLibrary,
      context,
    );

    expect(html).toContain(
      '<section class="site-hero hero bg-base-200 pl-0 pr-4 pt-32 pb-16 max-md:mt-24 md:mt-4">',
    );
    expect(html).toContain(
      '<section class="site-section mx-auto max-w-4xl space-y-6 px-8 py-0 mb-16">',
    );
    expect(html).toContain(
      '<h3 class="site-heading text-xl font-semibold max-md:mt-24 md:mt-4">Hi</h3>',
    );
    expect(html).toContain(
      '<div class="site-text text-lg leading-relaxed [&amp;_a]:underline [&amp;_p+p]:mt-4 mb-8">',
    );
    expect(html).toContain('<div class="site-faq space-y-4 my-4">');
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

  it("renders a link field's value, opening a new tab safely (F-ED-18)", () => {
    const hero = (buttonLink: unknown): NodeDoc => ({
      type: "Hero",
      props: { id: "h", title: "Hi", buttonLabel: "Go", buttonLink },
    });
    const render = (link: unknown) => renderNodesToHtml([hero(link)], siteLibrary, context);

    expect(render({ kind: "page", pageId: "about" })).toContain('href="about.html"');
    expect(render({ kind: "page", pageId: "about", newTab: true })).toContain(
      'href="about.html" target="_blank" rel="noopener"',
    );
    // A page path typed before link fields, and no link at all.
    expect(render("about")).toContain('href="about.html"');
    expect(render(undefined)).toContain('href="#"');
  });

  it("documentsLinkedBy finds the documents link fields and rich text point to (1.28)", () => {
    const nodes: NodeDoc[] = [
      { type: "Text", props: { id: "t", text: '<p><a href="webforge:file/menu">Menu</a></p>' } },
      { type: "Hero", props: { id: "a", buttonLink: { kind: "file", mediaId: "prices" } } },
      { type: "Hero", props: { id: "b", buttonLink: { kind: "url", href: "https://a.b" } } },
      // Not a link field: a document id elsewhere isn't a link.
      { type: "Hero", props: { id: "c", image: { mediaId: "menu" } } },
    ];

    expect([...documentsLinkedBy(nodes, siteLibrary)]).toEqual(["menu", "prices"]);
  });

  it("mediaUsedBy finds media ids in media fields only", () => {
    const nodes: NodeDoc[] = [
      { type: "Hero", props: { id: "a", image: { mediaId: "hero" }, title: "hero2" } },
      { type: "Hero", props: { id: "b", image: "old-style id" } },
      { type: "Hero", props: { id: "c" } },
    ];

    expect([...mediaUsedBy(nodes, siteLibrary)]).toEqual(["hero"]);
  });

  it("leaves a copy of a shared section hidden in Layers out of the export (F-ED-12, F-ED-23)", () => {
    const id = "shared-hours" as SharedSectionId;
    const section: NodeDoc = {
      type: "Section",
      props: { id: "s", content: [{ type: "Heading", props: { id: "h", text: "Opening hours" } }] },
    };
    const shared = { [id]: { id, name: "Hours", section } };
    const copy = (copyId: string, hidden: boolean): NodeDoc => ({
      type: SHARED_COPY_TYPE,
      props: { id: copyId, sharedSectionId: id, ...(hidden ? { hidden } : {}) },
    });

    const html = renderNodesToHtml(
      expandSharedCopies([copy("c1", true), copy("c2", false)], shared),
      siteLibrary,
      context,
    );

    expect(html.match(/Opening hours/g)).toHaveLength(1);
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

  it("includes hidden nodes when asked, for the canvas's styles (#142)", () => {
    const nodes: NodeDoc[] = [
      {
        type: "Hero",
        props: { id: "hero", title: "Hidden hero", image: { mediaId: "hero" }, hidden: true },
      },
      {
        type: "Section",
        props: {
          id: "s",
          hidden: true,
          content: [{ type: "Heading", props: { id: "h", text: "Inside a hidden section" } }],
        },
      },
    ];

    const html = renderNodesToHtml(nodes, siteLibrary, context, { includeHidden: true });

    expect(html).toContain("Hidden hero");
    expect(html).toContain("Inside a hidden section");
    const visited: string[] = [];
    walkNodes(nodes, siteLibrary, (node) => visited.push(node.props.id), { includeHidden: true });
    expect(visited).toEqual(["hero", "s", "h"]);
    // The export's default still leaves them out.
    expect(renderNodesToHtml(nodes, siteLibrary, context)).toBe("");
  });

  it("skips unknown component types with includeHidden, so the canvas styles the rest", () => {
    const nodes: NodeDoc[] = [
      { type: "Gone", props: { id: "old", hidden: true } },
      {
        type: "Section",
        props: {
          id: "s",
          content: [
            { type: "Removed", props: { id: "r" } },
            { type: "Heading", props: { id: "h", text: "Still styled" } },
          ],
        },
      },
    ];

    const html = renderNodesToHtml(nodes, siteLibrary, context, { includeHidden: true });

    expect(html).toContain("site-section");
    expect(html).toContain("Still styled");
    // The export still fails on an unknown type it would export (X5).
    expect(() => renderNodesToHtml(nodes, siteLibrary, context)).toThrow(UnknownComponentError);
  });

  it("behavioursUsedBy lists the scripts the components need", () => {
    const [header] = starterLayout("x").header;
    if (header === undefined) throw new Error("No Header");
    expect(behavioursUsedBy([header], siteLibrary)).toEqual(["menu"]);
    // Only a sticky Header needs the sticky script (2.6).
    expect(
      behavioursUsedBy([{ ...header, props: { ...header.props, sticky: true } }], siteLibrary),
    ).toEqual(["menu", "sticky"]);
    expect(behavioursUsedBy(starterPage().content, siteLibrary)).toEqual([]);
  });
});
