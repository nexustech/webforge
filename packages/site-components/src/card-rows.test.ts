import { describe, expect, it } from "vitest";
import { CARD_ROWS } from "./card-rows.js";

/** The rows that are flex rows at every width, each card a column wide. */
const FLEX_ROWS = Object.entries(CARD_ROWS).filter(([name]) => name !== "threeGap6EveryRow");

describe("CARD_ROWS", () => {
  it.each(FLEX_ROWS)(
    "%s takes out exactly its gaps, in the theme's spacing unit (#1372)",
    (_name, classes) => {
      const gap = Number(/(?:^| )gap-(\d+)(?: |$)/.exec(classes)?.[1]);
      const widths = [
        ...classes.matchAll(/\*:w-\[calc\(\(100%-var\(--spacing\)\*(\d+)\)\/(\d+)\)\]/g),
      ];
      expect(gap).toBeGreaterThan(0);
      expect(widths.length).toBeGreaterThan(0);
      // A rem width doesn't follow a theme's Spacing: with roomy spacing the gaps grow past it
      // and the last of three cards wraps under the others.
      expect(classes).not.toMatch(/rem\)/);
      for (const [, taken, columns] of widths) {
        expect(Number(taken)).toBe(gap * (Number(columns) - 1));
      }
    },
  );

  it("threeGap6EveryRow is a grid of three across from md, rows alike, a last row centred (#1511)", () => {
    const classes = CARD_ROWS.threeGap6EveryRow.split(" ");
    // Below md, the flex row threeGap6 is, one card across; flex-wrap takes drops both ways.
    expect(classes.slice(0, 5)).toEqual(CARD_ROWS.threeGap6.split(" ").slice(0, 5));
    expect(classes).toContain("flex-wrap");
    // From md, six columns, each card two, every row as tall as the tallest.
    expect(classes).toEqual(
      expect.arrayContaining(["md:grid", "md:grid-cols-6", "md:*:col-span-2", "md:auto-rows-fr"]),
    );
    expect(classes.some((each) => each.startsWith("md:*:w-"))).toBe(false);
    // One card alone in the last row starts at the third column, the first of two at the second.
    expect(classes).toEqual(
      expect.arrayContaining([
        "md:[&>:last-child:nth-child(3n+1)]:col-start-3",
        "md:[&>:nth-last-child(2):nth-child(3n+1)]:col-start-2",
      ]),
    );
  });
});
