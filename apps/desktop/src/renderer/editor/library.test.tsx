import type { ComponentDef } from "@webforge/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { spikeLibrary, starterPage } from "./library.js";

const render = (def: ComponentDef | undefined, values: Record<string, unknown>, slots = {}) =>
  renderToStaticMarkup(def?.render({ id: "x", values, slots }));

describe("spikeLibrary", () => {
  const { Section, Heading, Text } = spikeLibrary.components;

  it("names components with glossary terms", () => {
    expect([Section?.label, Heading?.label, Text?.label]).toEqual(["Section", "Heading", "Text"]);
  });

  it("renders a heading at the chosen size", () => {
    expect(render(Heading, { text: "Hi", size: "large" })).toBe('<h1 class="site-heading">Hi</h1>');
    expect(render(Heading, { text: "Hi", size: "small" })).toBe('<h3 class="site-heading">Hi</h3>');
    expect(render(Heading, { text: "Hi" })).toBe('<h1 class="site-heading">Hi</h1>');
  });

  it("renders text and sections with their content", () => {
    const Slot = () => <p>inside</p>;

    expect(render(Text, { text: "Body" })).toBe('<div class="site-text">Body</div>');
    expect(render(Section, {}, { content: Slot })).toBe(
      '<section class="site-section"><p>inside</p></section>',
    );
  });

  it("starts with a section holding a heading and text", () => {
    const page = starterPage();

    expect(page.content.map((node) => node.type)).toEqual(["Section"]);
    expect(
      (page.content[0]?.props.content as { type: string }[] | undefined)?.map((n) => n.type),
    ).toEqual(["Heading", "Text"]);
  });
});
