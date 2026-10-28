import { DEFAULT_THEME, type Oklch } from "@webforge/model";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contrastRatio, hexToOklch, inverseColors } from "./colors.js";
import { AA_LARGE, AA_TEXT } from "./contrast.js";
import {
  brandedTheme,
  brandFromImage,
  type ImageColour,
  imageColours,
  reversedBrand,
} from "./image-palette.js";
import { themePreset } from "./presets.js";

/** RGBA pixels: `count` of each `[r, g, b, a]`, in order. */
function pixels(
  ...runs: readonly (readonly [readonly [number, number, number, number], number])[]
) {
  return Uint8ClampedArray.from(
    runs.flatMap(([pixel, count]) => Array.from({ length: count }, () => pixel).flat()),
  );
}

const RED = [220, 30, 40, 255] as const;
const BLUE = [20, 60, 200, 255] as const;
const WHITE = [255, 255, 255, 255] as const;
const CLEAR = [0, 0, 0, 0] as const;

const near = (a: Oklch, b: Oklch) => Math.abs(a.l - b.l) < 0.02 && Math.abs(a.c - b.c) < 0.02;

describe("an image's main colours (PG-2)", () => {
  it("finds its colours, the commonest first, leaving clear pixels out", () => {
    const colours = imageColours(pixels([RED, 60], [BLUE, 30], [CLEAR, 500]), 2);

    expect(colours.map((colour) => colour.share)).toEqual([60 / 90, 30 / 90]);
    expect(near(colours[0]?.color as Oklch, hexToOklch("#dc1e28"))).toBe(true);
    expect(near(colours[1]?.color as Oklch, hexToOklch("#143cc8"))).toBe(true);
  });

  it("has none for an image that is all clear, and gives the same colours every time", () => {
    expect(imageColours(pixels([CLEAR, 10]))).toEqual([]);
    const image = pixels([RED, 7], [BLUE, 11], [WHITE, 5]);
    expect(imageColours(image)).toEqual(imageColours(image));
  });
});

/** Whether every pair the proposal makes reads as the contrast guideline asks, on `surface`. */
function readable(proposal: NonNullable<ReturnType<typeof brandFromImage>>, surface: Oklch) {
  return (
    contrastRatio(proposal.primary, surface) >= AA_TEXT &&
    contrastRatio(proposal.secondary, surface) >= AA_LARGE &&
    contrastRatio(proposal.accent, surface) >= AA_LARGE &&
    contrastRatio(proposal["primary-content"], proposal.primary) >= AA_TEXT &&
    contrastRatio(proposal["secondary-content"], proposal.secondary) >= AA_TEXT &&
    contrastRatio(proposal["accent-content"], proposal.accent) >= AA_TEXT
  );
}

const colour = fc.record({
  l: fc.double({ min: 0, max: 1, noNaN: true }),
  c: fc.double({ min: 0, max: 0.3, noNaN: true }),
  h: fc.double({ min: 0, max: 359.9, noNaN: true }),
});

describe("brand colours from an image (PG-2, F-DS-7)", () => {
  it("takes the commonest colourful colour as Brand, and others of different hues as accents", () => {
    const proposal = brandFromImage(
      imageColours(pixels([WHITE, 50], [RED, 30], [BLUE, 20])),
      DEFAULT_THEME,
    );

    // Brand stays red, Accent blue: each darkened only as far as the page needs.
    expect(Math.abs((proposal?.primary.h ?? 0) - hexToOklch("#dc1e28").h)).toBeLessThan(3);
    expect(Math.abs((proposal?.secondary.h ?? 0) - hexToOklch("#143cc8").h)).toBeLessThan(3);
    expect(readable(proposal ?? never(), DEFAULT_THEME.colors["base-100"])).toBe(true);
  });

  it("turns a one-colour logo's hue for the accents", () => {
    const proposal = brandFromImage(imageColours(pixels([RED, 10], [CLEAR, 10])), DEFAULT_THEME);
    const hue = proposal?.primary.h ?? 0;

    expect(Math.round(((proposal?.secondary.h ?? 0) - hue + 360) % 360)).toBe(120);
    expect(Math.round(((proposal?.accent.h ?? 0) - hue + 360) % 360)).toBe(240);
  });

  it("proposes nothing for an image with no colours", () => {
    expect(brandFromImage([], DEFAULT_THEME)).toBeUndefined();
  });

  it("always reads as the guideline asks, on a light theme and a dark one", () => {
    const dark = themePreset("dark");
    if (dark === undefined) throw new Error("no dark preset");
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ color: colour, share: fc.double({ min: 0.01, max: 1, noNaN: true }) }),
          {
            minLength: 1,
            maxLength: 6,
          },
        ),
        fc.boolean(),
        (colours: ImageColour[], light) => {
          const theme = light ? DEFAULT_THEME : dark;
          const proposal = brandFromImage(colours, theme);
          expect(proposal).toBeDefined();
          expect(readable(proposal ?? never(), theme.colors["base-100"])).toBe(true);
        },
      ),
    );
  });
});

describe("reversed sections' brand colours from an image (#462 review)", () => {
  it("keep the proposal's hues, readable on the reversed surface, with their text", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ color: colour, share: fc.double({ min: 0.01, max: 1, noNaN: true }) }),
          {
            minLength: 1,
            maxLength: 6,
          },
        ),
        (colours: ImageColour[]) => {
          const proposal = brandFromImage(colours, DEFAULT_THEME) ?? never();
          const reversed = reversedBrand(proposal, DEFAULT_THEME) ?? never();
          expect(readable(reversed, inverseColors(DEFAULT_THEME)["base-100"])).toBe(true);
          expect(reversed.secondary.h).toBeCloseTo(proposal.secondary.h);
        },
      ),
    );
  });

  it("are none for a theme without reversed colours of its own", () => {
    const { inverse: _none, ...plain } = DEFAULT_THEME;
    const proposal = brandFromImage([{ color: hexToOklch("#dc1e28"), share: 1 }], plain) ?? never();

    expect(reversedBrand(proposal, plain)).toBeUndefined();
  });
});

function never(): never {
  throw new Error("expected a proposal");
}

describe("a theme with brand colours (PG-2, 3.11b)", () => {
  it("sets Brand, Accent and Second accent with their text, reversed sections following, in a new theme", () => {
    const theme = themePreset("dark") ?? DEFAULT_THEME;
    const before = JSON.stringify(theme);
    const red: Oklch = { l: 0.55, c: 0.2, h: 25 };
    const proposal = brandFromImage([{ color: red, share: 1 }], theme);
    if (proposal === undefined) throw new Error("no proposal");

    const branded = brandedTheme(theme, proposal);

    expect(JSON.stringify(theme)).toBe(before);
    for (const role of ["primary", "primary-content", "secondary", "accent-content"] as const) {
      expect(branded.colors[role]).toEqual(proposal[role]);
    }
    expect(branded.colors["base-100"]).toEqual(theme.colors["base-100"]);
    const reversed = reversedBrand(proposal, theme);
    if (theme.inverse !== undefined) expect(branded.inverse?.primary).toEqual(reversed?.primary);
    expect(
      contrastRatio(branded.colors["primary-content"], branded.colors.primary),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
