import { describe, expect, it } from "vitest";
import type { NodeDoc } from "./documents.js";
import { findNode, removeNode } from "./node-tree.js";

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

  it("removes a node from its slot, and leaves a list's plain items alone", () => {
    const nodes = tree();
    expect(removeNode(nodes, "heading")).toBe(true);
    expect(findNode(nodes, (node) => node.props.id === "heading")).toBeUndefined();
    expect(removeNode(nodes, "q1")).toBe(false);
    expect(removeNode(nodes, "faq")).toBe(true);
    expect(nodes.map((node) => node.props.id)).toEqual(["section"]);
  });
});
