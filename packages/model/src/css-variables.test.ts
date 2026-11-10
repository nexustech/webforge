import { describe, expect, it } from "vitest";
import { cssVariablesUsed } from "./css-variables.js";

describe("cssVariablesUsed (6.8)", () => {
  it("lists the custom properties the CSS reads, once each, sorted", () => {
    expect(
      cssVariablesUsed(
        ".a { font-size: var(--text-xl); line-height: var( --tw-leading, var(--text-xl--line-height)); }\n.b { color: var(--text-xl); --own: 1px; }",
      ),
    ).toEqual(["--text-xl", "--text-xl--line-height", "--tw-leading"]);
    expect(cssVariablesUsed(".a { color: red; }")).toEqual([]);
  });
});
