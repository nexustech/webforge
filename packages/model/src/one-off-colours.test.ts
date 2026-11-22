import { describe, expect, it } from "vitest";
import type { NodeDoc } from "./documents.js";
import { oneOffColours } from "./one-off-colours.js";
import { createSite } from "./site-doc.js";

const node = (id: string, props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Heading",
  props: { id, ...props },
});

/** A site whose home page holds `content`, with `header` above it. */
const siteWith = (content: NodeDoc[], header: NodeDoc[] = []) =>
  createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
    layout: { header, footer: [] },
    homeDoc: { root: { props: {} }, content },
  });

describe("the site's one-off colours (TC-2, #1219)", () => {
  it("lists each one-off colour once, the most used first, wherever it is", () => {
    const site = siteWith(
      [
        node("a", { color: "[#c0392b]" }),
        node("b", { lookBackground: "[#1a7f5a]/50", lookColor: "[#C0392B]" }),
        node("box", {
          content: [node("inner", { color: { $responsive: { desktop: "[#1a7f5a]" } } })],
        }),
        node("c", { color: "[#1a7f5a]" }),
      ],
      [node("logo", { color: "[#222222]" })],
    );

    expect(oneOffColours(site)).toEqual(["#1a7f5a", "#c0392b", "#222222"]);
  });

  it("leaves out the theme's colours, the person's own, and anything that isn't a colour", () => {
    const site = siteWith([
      node("a", {
        color: "primary-300/50",
        lookColor: "own-sky",
        title: "[#c0392b] in words",
        text: "<p>#c0392b</p>",
        items: ["[#c0392b]"],
      }),
    ]);

    expect(oneOffColours(site)).toEqual([]);
  });

  it("offers at most 12", () => {
    const content = Array.from({ length: 15 }, (_, at) =>
      node(`n${at}`, { color: `[#0000${(at + 16).toString(16)}]` }),
    );

    expect(oneOffColours(siteWith(content))).toHaveLength(12);
  });
});
