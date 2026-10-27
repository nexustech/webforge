import { BOX_SIDES, SHADE_STEPS, SPACING_TOKENS } from "@webforge/model";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import sourcesCss from "../.storybook/sources.css?raw";
import { APPEARANCE_FIELDS, appearanceBoxClasses } from "./appearance.js";
import { COLUMN_LAYOUT_CLASS, COLUMN_LAYOUTS } from "./catalogue/column-layouts.js";
import { SECTION_PADDING } from "./frame.js";
import { boxClasses, responsiveClasses } from "./library.js";

/** Every class an `@source inline("…")` pattern stands for, its `{a,b}` groups expanded. */
function expand(pattern: string): string[] {
  const group = /\{([^{}]*)\}/.exec(pattern);
  if (group === null) return [pattern];
  const [whole, choices = ""] = group;
  return choices.split(",").flatMap((choice) => expand(pattern.replace(whole, choice)));
}

/** The classes the Storybook's CSS compiles whatever the stories' sources say. */
const inline = new Set(
  [...sourcesCss.matchAll(/@source inline\("([^"]*)"\)/g)].flatMap(([, pattern = ""]) =>
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

  it("compiles every class the Columns layouts can give per device (2.9)", () => {
    const layout = fc.constantFrom(...COLUMN_LAYOUTS);
    const stored = fc.oneof(
      layout,
      fc.record({
        $responsive: fc.record(
          { desktop: layout, tablet: layout, mobile: layout },
          { requiredKeys: ["desktop"] },
        ),
      }),
    );
    fc.assert(
      fc.property(stored, (value) => {
        const classes = responsiveClasses(value, (each) => COLUMN_LAYOUT_CLASS[each]).split(" ");
        for (const name of classes) expect(inline).toContain(name);
      }),
      { numRuns: 200 },
    );
  });

  it("compiles every theme colour the Appearance group offers, with each shade (2.22)", () => {
    const colours = ["lookColor", "lookBackground", "lookBorderColor"] as const;
    for (const name of colours) {
      for (const { value } of APPEARANCE_FIELDS[name].options) {
        for (const shade of ["", ...SHADE_STEPS.map((step) => `-${step}`)]) {
          const classes = appearanceBoxClasses({ [name]: `${value}${shade}` });
          for (const each of classes.split(" ").filter((part) => part !== "")) {
            expect(inline, `${name} ${value}${shade}`).toContain(each);
          }
        }
      }
    }
  });
});
