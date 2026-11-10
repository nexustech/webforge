import { describe, expect, it } from "vitest";
import { cssRules, matchesNothing, selectorNeeds, unusedCssRules } from "./css-rules.js";

const used = { classes: new Set(["btn", "hero", "md:flex"]), ids: new Set(["about"]) };

describe("cssRules (6.8)", () => {
  it("finds rules at the top level and in grouping at-rules, where their selectors are", () => {
    const css = [
      "/* a { } */",
      '@import url("x.css");',
      ".btn, .hero > p { color: red; }",
      "@media (min-width: 40rem) {",
      '  #about::before { content: "}"; }',
      "}",
      "@font-face { font-family: X; src: url(x.woff2); }",
      "@keyframes spin { from { opacity: 0 } 50% { opacity: 1 } }",
      ".card { & .title { color: blue; } }",
    ].join("\n");
    const rules = cssRules(css);

    expect(rules.map((rule) => rule.selectors)).toEqual([
      [".btn", ".hero > p"],
      ["#about::before"],
      [".card"],
    ]);
    const [first] = rules;
    expect(css.slice(first?.from, first?.to)).toBe(".btn, .hero > p");
  });

  it("says what a selector needs, leaving out what it can match without", () => {
    expect(selectorNeeds(".btn.big:hover > #about a[href='#x']")).toEqual({
      classes: ["btn", "big"],
      ids: ["about"],
    });
    expect(selectorNeeds(".md\\:flex:not(.hidden) :is(.a, .b)")).toEqual({
      classes: ["md:flex"],
      ids: [],
    });
    expect(selectorNeeds("body, *, :root")).toEqual({ classes: [], ids: [] });
  });

  it("reports a rule only when none of its selectors can match", () => {
    expect(matchesNothing(".btn", used)).toBe(false);
    expect(matchesNothing(".buton", used)).toBe(true);
    expect(matchesNothing("#contact", used)).toBe(true);
    expect(
      unusedCssRules(".buton { } .btn, .gone { } section p { } .md\\:flex { }", used).map(
        (rule) => rule.selector,
      ),
    ).toEqual([".buton"]);
  });
});
