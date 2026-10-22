import {
  expandSharedCopies,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
} from "@webforge/model";
import { describe, expect, it } from "vitest";
import { siteLibrary, starterLayout, starterPage } from "./catalogue.js";
import { EDITOR_RENDER_CONTEXT, type RenderContext, type ResolvedImage } from "./library.js";
import {
  behavioursUsedBy,
  documentsLinkedBy,
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
    expect(html).toContain(
      '<nav aria-label="Main navigation" class="[&amp;:not([data-wf-ready]):focus-within&gt;ul]:flex">',
    );
    expect(html).toContain('aria-controls="header-menu" data-wf-menu-toggle=""');
    expect(html).toContain('<ul id="header-menu"');
    expect(html).toContain('<a href="index.html" aria-current="page">Home</a>');
    expect(html).toContain('<a href="about.html">About</a>');
    expect(html).toContain('<span class="sr-only">Menu</span>');
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

    // The dropdown: a button that says whether it is open, controlling its own list.
    expect(html).toContain(
      'aria-expanded="false" aria-controls="header-menu-0" data-wf-submenu-toggle="">Visit us',
    );
    expect(html).toContain('<ul id="header-menu-0" class="hidden data-open:block');
    expect(html).toContain('<a href="index.html#questions">Questions</a>');
    expect(html).toContain(
      '<a href="https://example.com/map" target="_blank" rel="noopener">Find us</a>',
    );
    expect(html).toContain(
      '<a href="about.html" class="btn btn-primary btn-sm md:ml-2">Order a cake</a>',
    );
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
    expect(behavioursUsedBy(starterLayout("x").header, siteLibrary)).toEqual(["menu"]);
    expect(behavioursUsedBy(starterPage().content, siteLibrary)).toEqual([]);
  });
});
