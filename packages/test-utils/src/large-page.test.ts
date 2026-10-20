import { pageDocSchema } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { countNodes, largePage } from "./large-page.js";

describe("largePage", () => {
  it("has more than 200 nodes by default and is a valid page", () => {
    const page = largePage();

    expect(pageDocSchema.parse(page)).toEqual(page);
    expect(page.content).toHaveLength(25);
    expect(countNodes(page)).toBe(225);
  });

  it("scales with its options and keeps ids unique", () => {
    const page = largePage({ sections: 3, questionsPerSection: 2 });
    const ids: string[] = [];
    const collect = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(collect);
      else if (typeof value === "object" && value !== null) {
        const { props } = value as { props?: Record<string, unknown> };
        if (typeof props?.id === "string") ids.push(props.id);
        Object.values(props ?? {}).forEach(collect);
      }
    };
    collect(page.content);

    expect(countNodes(page)).toBe(3 * (1 + 1 + 2 + 1 + 2));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("counts an empty page as zero nodes", () => {
    expect(countNodes({ root: { props: {} }, content: [] })).toBe(0);
  });

  it("counts only nodes in array props, not other values", () => {
    const page = {
      root: { props: {} },
      content: [{ type: "Gallery", props: { id: "g", tags: ["a", "b"], items: [{ src: "x" }] } }],
    };

    expect(countNodes(page)).toBe(1);
  });
});
