import { describe, expect, it } from "vitest";
import { CARD_ROWS } from "./card-rows.js";

describe("CARD_ROWS", () => {
  it.each(Object.entries(CARD_ROWS))(
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
});
