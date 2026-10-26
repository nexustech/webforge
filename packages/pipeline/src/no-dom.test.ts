import { describe, expect, it } from "vitest";

// The pipeline runs in Node, in a utility process (R16): it has no "dom" lib, so browser globals
// are type errors in its code. The typecheck fails if either line below starts to compile.
function usesTheBrowser(): unknown[] {
  return [
    // @ts-expect-error: no document in the pipeline.
    document.title,
    // @ts-expect-error: no window either.
    window.location,
  ];
}

describe("the pipeline's types (R16)", () => {
  it("have no document or window: the lines above are type errors", () => {
    expect(() => usesTheBrowser()).toThrow(ReferenceError);
  });
});
