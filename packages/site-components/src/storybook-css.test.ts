import { BOX_SIDES, SPACING_TOKENS } from "@webforge/model";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import previewCss from "../.storybook/preview.css?raw";
import { SECTION_PADDING } from "./frame.js";
import { boxClasses } from "./library.js";

/** Every class an `@source inline("…")` pattern stands for, its `{a,b}` groups expanded. */
function expand(pattern: string): string[] {
  const group = /\{([^{}]*)\}/.exec(pattern);
  if (group === null) return [pattern];
  const [whole, choices = ""] = group;
  return choices.split(",").flatMap((choice) => expand(pattern.replace(whole, choice)));
}

/** The classes the Storybook's CSS compiles whatever the stories' sources say. */
const inline = new Set(
  [...previewCss.matchAll(/@source inline\("([^"]*)"\)/g)].flatMap(([, pattern = ""]) =>
    expand(pattern),
  ),
);

const token = fc.option(fc.constantFrom(...SPACING_TOKENS), { nil: undefined });
const box = fc.record(Object.fromEntries(BOX_SIDES.map((side) => [side, token])), {
  requiredKeys: [],
});
/** A stored box: one for every device, or set per device. */
const stored = fc.oneof(
  box,
  fc.record({
    $responsive: fc.record(
      { desktop: box, tablet: box, mobile: box },
      { requiredKeys: ["desktop"] },
    ),
  }),
);

describe("the site Storybook's CSS", () => {
  it("compiles every spacing class boxClasses can give, as the export does for its pages", () => {
    expect(inline.size).toBeGreaterThan(0);
    fc.assert(
      fc.property(stored, fc.boolean(), (value, section) => {
        const classes = [
          boxClasses(value, "padding", section ? SECTION_PADDING : {}),
          boxClasses(value, "margin", {}, ["top", "bottom"]),
          boxClasses(value, "margin"),
        ]
          .join(" ")
          .split(" ")
          .filter((name) => name !== "");
        for (const name of classes) expect(inline).toContain(name);
      }),
      { numRuns: 500 },
    );
  });
});
