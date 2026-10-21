import type { LayoutDoc, NodeDoc, PageDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import {
  composePage,
  isShared,
  isSharedRegion,
  sameNodes,
  sameOrder,
  splitPage,
} from "./shared-layout.js";

const node = (id: string, props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Box",
  props: { id, ...props },
});
const layout: LayoutDoc = {
  header: [node("header", { links: [node("link")] })],
  footer: [node("footer")],
};
const page: PageDoc = { root: { props: { title: "Home" } }, content: [node("a"), node("b")] };

describe("shared layout (F-ED-7)", () => {
  it("shows the Header, the page and the Footer as one list", () => {
    expect(composePage(page, layout).content.map((n) => n.props.id)).toEqual([
      "header",
      "a",
      "b",
      "footer",
    ]);
    expect(composePage(page, layout).root).toBe(page.root);
  });

  it("splits it back by the layout's ids, wherever Puck shows them", () => {
    // A section dropped above the Header still belongs to the page.
    const composed: PageDoc = {
      root: page.root,
      content: [node("new"), ...layout.header, node("a"), node("b"), ...layout.footer],
    };

    const split = splitPage(composed, layout);

    expect(split.page.content.map((n) => n.props.id)).toEqual(["new", "a", "b"]);
    expect(split.layout.header.map((n) => n.props.id)).toEqual(["header"]);
    expect(split.layout.footer.map((n) => n.props.id)).toEqual(["footer"]);
  });

  it("tells shared nodes, and the shared regions' own nodes, from the page's", () => {
    expect(isShared(layout, "header")).toBe(true);
    expect(isShared(layout, "link")).toBe(true);
    expect(isShared(layout, "a")).toBe(false);
    expect(isSharedRegion(layout, "footer")).toBe(true);
    expect(isSharedRegion(layout, "link")).toBe(false);
  });

  it("compares the order of top-level nodes", () => {
    const composed = composePage(page, layout);
    const moved: PageDoc = { ...composed, content: [...composed.content].reverse() };

    expect(sameOrder(composed, composePage(page, layout))).toBe(true);
    expect(sameOrder(composed, moved)).toBe(false);
  });

  it("notices an element moved into or out of the Header, at any depth", () => {
    const moved = [node("header", { links: [] })];

    expect(sameNodes(layout.header, [node("header", { links: [node("link")] })])).toBe(true);
    expect(sameNodes(layout.header, moved)).toBe(false);
    expect(sameNodes(page.content, [...page.content, node("link")])).toBe(false);
  });
});
