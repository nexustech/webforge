import { describe, expect, it } from "vitest";
import type { NodeDoc } from "./documents.js";
import { findNode, findParent, removeNode } from "./node-tree.js";

const tree = (): NodeDoc[] => [
  {
    type: "Section",
    props: {
      id: "section",
      content: [
        { type: "Heading", props: { id: "heading", text: "Hello" } },
        { type: "Text", props: { id: "text", text: "<p>Hi</p>" } },
      ],
    },
  },
  { type: "Faq", props: { id: "faq", items: [{ id: "q1", question: "Why?" }] } },
];

describe("the page tree (4.8)", () => {
  it("finds a node anywhere in the tree, in document order", () => {
    expect(findNode(tree(), (node) => node.props.id === "text")?.type).toBe("Text");
    expect(findNode(tree(), (node) => node.type === "Section")?.props.id).toBe("section");
    expect(findNode(tree(), (node) => node.props.id === "nowhere")).toBeUndefined();
  });

  it("finds the node whose slot holds a node, and none for a node at the top (6.16c)", () => {
    expect(findParent(tree(), "text")?.props.id).toBe("section");
    expect(findParent(tree(), "section")).toBeUndefined();
    // A list's plain item isn't a node, so nothing holds one as such.
    expect(findParent(tree(), "q1")).toBeUndefined();
    expect(findParent(tree(), "nowhere")).toBeUndefined();
  });

  it("removes a node from its slot, and leaves a list's plain items alone", () => {
    const nodes = tree();
    expect(removeNode(nodes, "heading")).toBe(true);
    expect(findNode(nodes, (node) => node.props.id === "heading")).toBeUndefined();
    expect(removeNode(nodes, "q1")).toBe(false);
    expect(removeNode(nodes, "faq")).toBe(true);
    expect(nodes.map((node) => node.props.id)).toEqual(["section"]);
  });
});
