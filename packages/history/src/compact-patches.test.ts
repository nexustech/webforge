import fc from "fast-check";
import { applyPatches, enablePatches, type Patch } from "immer";
import { describe, expect, it } from "vitest";
import { compactPatches } from "./compact-patches.js";

enablePatches();

describe("compactPatches", () => {
  it("keeps only the last replace of a path", () => {
    const patches: Patch[] = [
      { op: "replace", path: ["a"], value: 1 },
      { op: "replace", path: ["b"], value: 2 },
      { op: "replace", path: ["a"], value: 3 },
    ];

    expect(compactPatches(patches)).toEqual([
      { op: "replace", path: ["b"], value: 2 },
      { op: "replace", path: ["a"], value: 3 },
    ]);
  });

  it("keeps a replace that a later write below its path depends on", () => {
    const patches: Patch[] = [
      { op: "replace", path: ["a"], value: {} },
      { op: "replace", path: ["a", "b"], value: 1 },
      { op: "replace", path: ["a"], value: { c: 1 } },
    ];

    expect(compactPatches(patches)).toEqual(patches);
    expect(applyPatches({ a: null }, compactPatches(patches))).toEqual({ a: { c: 1 } });
  });

  it("leaves sequences with add or remove untouched", () => {
    const patches: Patch[] = [
      { op: "add", path: ["list", 0], value: 1 },
      { op: "replace", path: ["a"], value: 1 },
      { op: "replace", path: ["a"], value: 2 },
    ];

    expect(compactPatches(patches)).toEqual(patches);
  });

  it("produces the same document as the original sequence", () => {
    const segment = fc.constantFrom("a", "b", "c");
    const leaf = fc.oneof(fc.integer(), fc.constant(null), fc.string({ maxLength: 3 }));
    const value = fc.oneof(leaf, fc.dictionary(segment, leaf, { maxKeys: 3 }));
    const replace = fc.record({
      op: fc.constant("replace" as const),
      path: fc.array(segment, { minLength: 1, maxLength: 2 }),
      value,
    });
    const doc = fc.dictionary(segment, fc.dictionary(segment, leaf), { maxKeys: 3 });

    fc.assert(
      fc.property(doc, fc.array(replace, { maxLength: 12 }), (start, patches) => {
        let expected: unknown;
        try {
          expected = applyPatches(start, patches);
        } catch {
          return; // the random sequence itself is invalid for this document
        }
        expect(applyPatches(start, compactPatches(patches))).toEqual(expected);
      }),
      { numRuns: 500 },
    );
  });
});
