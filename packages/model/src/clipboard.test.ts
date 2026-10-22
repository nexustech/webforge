import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { copiedElementsSchema, pastedCopies } from "./clipboard.js";
import type { NodeDoc } from "./documents.js";

const section: NodeDoc = {
  type: "Section",
  props: {
    id: "s1",
    advanced: { anchorId: "menu", className: "mt-4" },
    content: [
      { type: "Heading", props: { id: "h1", text: "Cakes", bindings: { text: "contact.phone" } } },
      { type: "Hero", props: { id: "hero", image: { mediaId: "photo" } } },
    ],
  },
};

/** Every node id in `nodes` and their slots. */
function idsOf(nodes: readonly unknown[]): string[] {
  return nodes.flatMap((node) => {
    const { props } = node as NodeDoc;
    const nested = Object.values(props).filter(Array.isArray);
    return [props.id, ...nested.flatMap((list) => idsOf(list))];
  });
}

/** A tree of nodes, a few levels deep, with slots under any prop name. */
const tree = fc.letrec<{ node: NodeDoc }>((tie) => ({
  node: fc.record({
    type: fc.constantFrom("Section", "Heading", "Faq"),
    props: fc.record({
      id: fc.constantFrom("a", "b", "c"),
      text: fc.string({ maxLength: 5 }),
      content: fc.oneof(
        { maxDepth: 3, depthIdentifier: "tree" },
        fc.constant([]),
        fc.array(tie("node"), { minLength: 1, maxLength: 3 }),
      ),
    }),
  }),
})).node;

describe("pastedCopies", () => {
  it("gives every element, slots included, a new id and keeps everything else", () => {
    let next = 0;
    const [copy] = pastedCopies([section], new Set(), () => `new${++next}`);

    expect(copy).toEqual({
      type: "Section",
      props: {
        id: "new1",
        advanced: { anchorId: "menu", className: "mt-4" },
        content: [
          {
            type: "Heading",
            props: { id: "new2", text: "Cakes", bindings: { text: "contact.phone" } },
          },
          // The image keeps its Media id.
          { type: "Hero", props: { id: "new3", image: { mediaId: "photo" } } },
        ],
      },
    });
    // A copy, not the original.
    expect(section.props.id).toBe("s1");
  });

  it("leaves out an anchor the page already has, keeping the rest of the options", () => {
    const [copy] = pastedCopies([section], new Set(["menu"]));
    expect(copy?.props.advanced).toEqual({ className: "mt-4" });

    const bare: NodeDoc = { type: "Section", props: { id: "s", advanced: { anchorId: "menu" } } };
    expect(pastedCopies([bare], new Set(["menu"]))[0]?.props).not.toHaveProperty("advanced");
    // Two copies pasted at once: only the first keeps it.
    const [first, second] = pastedCopies([bare, bare]);
    expect(first?.props.advanced).toEqual({ anchorId: "menu" });
    expect(second?.props).not.toHaveProperty("advanced");
  });

  it("never repeats an id, within the copies or with the original", () => {
    fc.assert(
      fc.property(fc.array(tree, { minLength: 1, maxLength: 4 }), (nodes) => {
        const ids = idsOf(pastedCopies(nodes));
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.some((id) => idsOf(nodes).includes(id))).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});

describe("copiedElementsSchema", () => {
  it("accepts copied elements and refuses anything else", () => {
    const copied = { nodes: [section], media: [] };
    expect(copiedElementsSchema.parse(copied)).toEqual(copied);
    expect(copiedElementsSchema.safeParse({ nodes: [], media: [] }).success).toBe(false);
    expect(
      copiedElementsSchema.safeParse({ nodes: [{ type: "Heading" }], media: [] }).success,
    ).toBe(false);
    expect(
      copiedElementsSchema.safeParse(
        JSON.parse('{"nodes":[{"type":"Heading","props":{"id":"h","__proto__":{}}}],"media":[]}'),
      ).success,
    ).toBe(false);
  });
});
