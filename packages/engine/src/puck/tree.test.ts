import type { PageDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { allNodes, findNode, nodeAt, ROOT_ZONE, zoneContent } from "./tree.js";

const page: PageDoc = {
  root: { props: {} },
  content: [
    {
      type: "Section",
      props: {
        id: "s1",
        content: [
          { type: "Heading", props: { id: "h1" } },
          {
            type: "Section",
            props: { id: "s2", content: [{ type: "Text", props: { id: "t1" } }] },
          },
        ],
        notNodes: [1, 2],
      },
    },
    { type: "Text", props: { id: "t2" } },
  ],
};

describe("tree helpers", () => {
  it("finds nodes at any depth", () => {
    expect(findNode(page, "t1")?.type).toBe("Text");
    expect(findNode(page, "s1")?.type).toBe("Section");
    expect(findNode(page, "missing")).toBeUndefined();
  });

  it("resolves Puck zones to node lists", () => {
    expect(zoneContent(page)).toBe(page.content);
    expect(zoneContent(page, ROOT_ZONE)).toBe(page.content);
    expect(zoneContent(page, "s2:content").map((node) => node.props.id)).toEqual(["t1"]);
    expect(zoneContent(page, "missing:content")).toEqual([]);
    expect(zoneContent(page, "s1:notNodes")).toEqual([]);
  });

  it("finds the node at a position in a zone", () => {
    expect(nodeAt(page, "s1:content", 0)?.props.id).toBe("h1");
    expect(nodeAt(page, undefined, 1)?.props.id).toBe("t2");
    expect(nodeAt(page, undefined, 9)).toBeUndefined();
  });

  it("lists every node in document order", () => {
    expect(allNodes(page).map((node) => node.props.id)).toEqual(["s1", "h1", "s2", "t1", "t2"]);
  });
});
