import { describe, expect, it } from "vitest";
import themeCss from "./theme.css?raw";

/** The declarations of theme.css's reduced-motion rule, by property. */
function reducedMotion(): ReadonlyMap<string, string> {
  const start = themeCss.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(start).toBeGreaterThan(-1);
  const open = themeCss.indexOf("{", themeCss.indexOf("{", start) + 1);
  // Without its comments, whose `noImportantStyles:` reads as a declaration.
  const block = themeCss
    .slice(open + 1, themeCss.indexOf("}", open))
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const declarations = new Map<string, string>();
  for (const [, property = "", value = ""] of block.matchAll(
    /([\w-]+):\s*([^;]+?)\s*!important;/g,
  )) {
    declarations.set(property, value);
  }
  return declarations;
}

/** A CSS time in milliseconds: "0s" → 0, "0.01ms" → 0.01. */
function ms(time: string | undefined): number {
  const match = /^([\d.]+)(ms|s)$/.exec(time ?? "");
  if (match === null) return Number.NaN;
  return Number(match[1]) * (match[2] === "s" ? 1000 : 1);
}

describe("the editor's reduced-motion rule (#1497)", () => {
  it("gives no element a transition: a duration on every element would make every property one", () => {
    const rule = reducedMotion();
    expect(ms(rule.get("transition-duration"))).toBe(0);
    expect(ms(rule.get("transition-delay"))).toBe(0);
  });

  it("ends every animation at once, but still ends it, as Radix's closings wait for animationend", () => {
    const rule = reducedMotion();
    const duration = ms(rule.get("animation-duration"));
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(0.01);
    expect(ms(rule.get("animation-delay"))).toBe(0);
    expect(rule.get("animation-iteration-count")).toBe("1");
  });
});
