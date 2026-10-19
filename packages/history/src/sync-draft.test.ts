import fc from "fast-check";
import { enablePatches, produceWithPatches } from "immer";
import { describe, expect, it } from "vitest";
import { syncDraft } from "./sync-draft.js";

enablePatches();

const sync = <T extends object>(base: T, next: T) =>
  produceWithPatches(base, (draft) => {
    syncDraft(draft as T, next);
  });

describe("syncDraft", () => {
  const page = {
    root: { props: { title: "Home" } },
    content: [
      { type: "Heading", props: { id: "a", text: "Hello" } },
      { type: "Text", props: { id: "b", text: "World" } },
    ],
  };

  it("produces one replace patch for one changed leaf", () => {
    const next = JSON.parse(JSON.stringify(page)) as typeof page;
    next.content[1] = { type: "Text", props: { id: "b", text: "There" } };

    const [result, patches] = sync(page, next);

    expect(result).toEqual(next);
    expect(patches).toEqual([
      { op: "replace", path: ["content", 1, "props", "text"], value: "There" },
    ]);
  });

  it("produces no patches when nothing changed", () => {
    const [result, patches] = sync(page, JSON.parse(JSON.stringify(page)) as typeof page);

    expect(patches).toEqual([]);
    expect(result).toBe(page);
  });

  it("skips subtrees that are the same objects", () => {
    const next = { ...page, root: { props: { title: "About" } } };

    const [, patches] = sync(page, next);

    expect(patches).toEqual([{ op: "replace", path: ["root", "props", "title"], value: "About" }]);
  });

  it("adds, removes and replaces keys and array items", () => {
    const base = { list: [1, 2, 3], gone: true, kind: { a: 1 } as unknown };
    const next = { list: [1, 4], added: "yes", kind: [1] as unknown };

    const [result] = sync<Record<string, unknown>>(base, next);

    expect(result).toEqual(next);
  });

  it("grows arrays", () => {
    const [result] = sync({ list: [1] }, { list: [1, 2, 3] });

    expect(result).toEqual({ list: [1, 2, 3] });
  });

  it("always ends equal to the target value", () => {
    const json = fc.jsonValue({ maxDepth: 3 });
    const doc = fc.dictionary(fc.string({ maxLength: 2 }), json, { maxKeys: 4 });

    fc.assert(
      fc.property(doc, doc, (base, next) => {
        const [result] = sync(base, next);
        expect(result).toEqual(next);
      }),
      { numRuns: 300 },
    );
  });
});
