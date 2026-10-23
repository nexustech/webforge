// @vitest-environment happy-dom
import type { LayoutDoc, NodeDoc, PageDoc } from "@webforge/model";
import {
  EDITOR_RENDER_CONTEXT,
  type RenderContext,
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
 * A site with every component of the library: the starter pages and layout, and a page with a
 * Hero linking to another page and an FAQ.
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
const pages = [starterPage(), starterNotFoundPage(), more];

/** A context like the export's: links to pages go to their files, settings have values. */
const context: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
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
        const exported = renderPage(
          { header: shown.header, content: page.content, footer: shown.footer },
          siteLibrary,
          context,
        );

        const html = engine.renderStatic(page, shown, {}, context);

        expect(html).toBe(`${exported.header}${exported.main}${exported.footer}`);
        expect(html).not.toContain("data-puck");
      }
    }
    const html = engine.renderStatic(more, layout, {}, context);
    expect(html).toContain("Baked fresh every morning");
    expect(html).toContain('href="about.html"');
    expect(html).toContain("site-header");
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
