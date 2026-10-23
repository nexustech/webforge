// @vitest-environment happy-dom
import {
  expandSharedCopies,
  type LayoutDoc,
  type NodeDoc,
  type PageDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
  type SharedSectionsDoc,
} from "@webforge/model";
import {
  EDITOR_RENDER_CONTEXT,
  type RenderContext,
  type ResolvedImage,
  renderPage,
  siteLibrary,
  starterLayout,
  starterNotFoundPage,
  starterPage,
} from "@webforge/site-components";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanvasEngine } from "../canvas-engine.js";
import { createPuckEngine } from "./puck-engine.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A site with every component of the library: the starter pages and layout, a page with a Hero
 * (linking to another page, showing an image) and an FAQ, and a page with a linked copy of a shared
 * section and a copy hidden in Layers.
 */
const layout = starterLayout("Rosa's Bakery");
const more: PageDoc = {
  root: { props: {} },
  content: [
    {
      type: "Hero",
      props: {
        id: "hero",
        title: "Baked fresh every morning",
        buttonLabel: "About us",
        buttonLink: { kind: "page", pageId: "about" },
        image: { mediaId: "photo", alt: "Our shop" },
      },
    },
    {
      type: "Faq",
      props: {
        id: "faq",
        title: "Questions",
        items: [
          {
            type: "FaqItem",
            props: { id: "q1", question: "Open on Sunday?", answer: "<p>No</p>" },
          },
        ],
      },
    },
  ],
};
const HOURS = "shared-hours" as SharedSectionId;
const shared: SharedSectionsDoc = {
  [HOURS]: {
    id: HOURS,
    name: "Opening hours",
    section: {
      type: "Section",
      props: {
        id: "s",
        advanced: { anchorId: "hours" },
        content: [{ type: "Heading", props: { id: "t", text: "Open daily" } }],
      },
    },
  },
};
const withCopies: PageDoc = {
  root: { props: {} },
  content: [
    { type: SHARED_COPY_TYPE, props: { id: "c1", sharedSectionId: HOURS } },
    {
      type: SHARED_COPY_TYPE,
      props: { id: "c2", sharedSectionId: HOURS, anchorSuffix: "2", hidden: true },
    },
  ],
};
const pages = [starterPage(), starterNotFoundPage(), more, withCopies];

const photo: ResolvedImage = {
  sources: [{ type: "image/webp", srcset: "assets/img/shop-640.webp 640w" }],
  src: "assets/img/shop-640.jpg",
  fallback: { type: "image/jpeg", srcset: "assets/img/shop-640.jpg 640w" },
  width: 640,
  height: 427,
  alt: "Our shop",
};

/**
 * A context like the export's: links to pages go to their files, the Hero's image is found, and
 * settings have values.
 */
const context: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  image: (id) => (id === "photo" ? photo : null),
  link: (value) => `${value}.html`,
  href: (link) => (link.kind === "page" ? `${link.pageId}.html` : "#"),
  setting: () => "Rosa's Bakery",
};

describe("renderStatic (ADR 0005)", () => {
  let engine: CanvasEngine;
  let element: HTMLDivElement;

  beforeEach(async () => {
    element = document.createElement("div");
    document.body.append(element);
    engine = createPuckEngine({ iframe: false });
    await act(async () =>
      engine.mount(element, { library: siteLibrary, theme: { name: "light" } }),
    );
  });

  afterEach(async () => {
    await act(async () => engine.destroy());
    element.remove();
  });

  it("renders every page exactly as the export does, Header and Footer included", () => {
    for (const page of pages) {
      for (const shown of [layout, { header: [], footer: layout.footer } satisfies LayoutDoc]) {
        // The export gets each page with its copies inline already (siteToSnapshot).
        const content = expandSharedCopies(page.content, shared);
        const exported = renderPage(
          { header: shown.header, content, footer: shown.footer },
          siteLibrary,
          context,
        );

        const html = engine.renderStatic(page, shown, shared, context);

        expect(html).toBe(`${exported.header}${exported.main}${exported.footer}`);
        expect(html).not.toContain("data-puck");
      }
    }
    const html = engine.renderStatic(more, layout, shared, context);
    expect(html).toContain("Baked fresh every morning");
    expect(html).toContain('href="about.html"');
    expect(html).toContain("site-header");
    expect(html).toContain('<picture><source type="image/webp"');
    expect(html).toContain("assets/img/shop-640.webp 640w");
    // The copy shows its section, with the copy's ids; the copy hidden in Layers shows nothing.
    const copies = engine.renderStatic(withCopies, { header: [], footer: [] }, shared, context);
    expect(copies.match(/Open daily/g)).toHaveLength(1);
    expect(copies).toContain('id="hours"');
    expect(copies).not.toContain('id="hours-2"');
  });

  it("leaves hidden elements out, as the export does, and links nowhere by default", () => {
    const content: NodeDoc[] = [
      { type: "Heading", props: { id: "shown", text: "Shown" } },
      { type: "Heading", props: { id: "gone", text: "Hidden", hidden: true } },
      ...more.content,
    ];

    const html = engine.renderStatic({ root: { props: {} }, content }, { header: [], footer: [] });

    expect(html).toContain(">Shown<");
    expect(html).not.toContain("Hidden");
    expect(html).toContain('href="#"');
  });
});
