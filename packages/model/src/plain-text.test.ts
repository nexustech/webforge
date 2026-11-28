import { describe, expect, it } from "vitest";
import { graphemes } from "./plain-text.js";

describe("graphemes (#1452)", () => {
  it("counts a character made of several code points as one", () => {
    expect(graphemes("cafe\u0301.jpg")).toEqual(["c", "a", "f", "e\u0301", ".", "j", "p", "g"]);
    expect(graphemes("👩‍🍳.png")).toEqual(["👩‍🍳", ".", "p", "n", "g"]);
  });

  it("gives nothing for nothing, and joins back to the text", () => {
    expect(graphemes("")).toEqual([]);
    expect(graphemes("riverside terrace.jpg").join("")).toBe("riverside terrace.jpg");
  });
});
