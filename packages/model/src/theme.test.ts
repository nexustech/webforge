import { describe, expect, it } from "vitest";
import {
  COLOR_ROLES,
  copyTheme,
  DEFAULT_THEME,
  TEXT_STYLES,
  type ThemeTokens,
  themeTokensSchema,
} from "./theme.js";

/** The default theme with `change` made to a copy of it, as raw JSON. */
function changed(change: (theme: Record<string, unknown>) => void): unknown {
  const theme = JSON.parse(JSON.stringify(DEFAULT_THEME)) as Record<string, unknown>;
  change(theme);
  return theme;
}

const at = (value: unknown, key: string) => (value as Record<string, unknown>)[key];

describe("theme tokens (2.1)", () => {
  it("accepts the default theme, with every colour role and text style", () => {
    expect(themeTokensSchema.parse(DEFAULT_THEME)).toEqual(DEFAULT_THEME);
    expect(Object.keys(DEFAULT_THEME.colors).sort()).toEqual([...COLOR_ROLES].sort());
    expect(Object.keys(DEFAULT_THEME.typeScale).sort()).toEqual([...TEXT_STYLES].sort());
  });

  it("accepts a theme without inverse colours, but not with only some of them", () => {
    const { inverse: _inverse, ...light } = DEFAULT_THEME;
    expect(themeTokensSchema.safeParse(light).success).toBe(true);
    expect(
      themeTokensSchema.safeParse({ ...light, inverse: { primary: { l: 0.6, c: 0.2, h: 30 } } })
        .success,
    ).toBe(false);
  });

  it.each([
    [
      "a missing colour role",
      (t: Record<string, unknown>) => delete (t.colors as Record<string, unknown>).primary,
    ],
    [
      "an unknown colour role",
      (t: Record<string, unknown>) =>
        Object.assign(t.colors as object, { brand: { l: 0.5, c: 0, h: 0 } }),
    ],
    [
      "a lightness over 1",
      (t: Record<string, unknown>) => Object.assign(at(t.colors, "primary") as object, { l: 55 }),
    ],
    [
      "a negative hue",
      (t: Record<string, unknown>) => Object.assign(at(t.colors, "primary") as object, { h: -1 }),
    ],
    [
      "a colour as text",
      (t: Record<string, unknown>) =>
        Object.assign(t.colors as object, { primary: "oklch(55% 0.2 30)" }),
    ],
    [
      "an unknown inverse role",
      (t: Record<string, unknown>) =>
        Object.assign(t, { inverse: { brand: { l: 0.5, c: 0, h: 0 } } }),
    ],
    [
      "a font family with quotes",
      (t: Record<string, unknown>) =>
        Object.assign(at(t.fonts, "body") as object, { family: 'Inter", serif' }),
    ],
    [
      "a font with no fallback",
      (t: Record<string, unknown>) =>
        delete (at(t.fonts, "heading") as Record<string, unknown>).fallback,
    ],
    [
      "a corner size outside the scale",
      (t: Record<string, unknown>) => Object.assign(t.radius as object, { box: "0.5rem" }),
    ],
    ["an unknown spacing", (t: Record<string, unknown>) => Object.assign(t, { spacing: "huge" })],
    [
      "a weight off the scale",
      (t: Record<string, unknown>) =>
        Object.assign(at(t.typeScale, "h1") as object, { weight: 650 }),
    ],
    [
      "a text size outside the scale",
      (t: Record<string, unknown>) =>
        Object.assign(at(t.typeScale, "body") as object, { size: "18px" }),
    ],
    [
      "a missing text style",
      (t: Record<string, unknown>) => delete (t.typeScale as Record<string, unknown>).h6,
    ],
    [
      "an unknown button style",
      (t: Record<string, unknown>) => Object.assign(t.buttons as object, { style: "glow" }),
    ],
    ["an unknown shadow", (t: Record<string, unknown>) => Object.assign(t, { shadow: "huge" })],
    [
      "a preset name with capitals",
      (t: Record<string, unknown>) => Object.assign(t, { preset: "Light" }),
    ],
    ["an unknown scheme", (t: Record<string, unknown>) => Object.assign(t, { scheme: "sepia" })],
    ["a border in pixels", (t: Record<string, unknown>) => Object.assign(t, { border: "2px" })],
    [
      "effects that aren't on or off",
      (t: Record<string, unknown>) => Object.assign(t, { effects: { depth: 1, noise: false } }),
    ],
    ["a key of its own", (t: Record<string, unknown>) => Object.assign(t, { css: "body{}" })],
  ])("refuses %s", (_name, change) => {
    expect(themeTokensSchema.safeParse(changed(change)).success).toBe(false);
  });

  it("keeps the default theme from being changed by mistake", () => {
    expect(Object.isFrozen(DEFAULT_THEME.colors.primary)).toBe(true);
    expect(() => {
      (DEFAULT_THEME.typeScale.h1 as { size: string }).size = "xs";
    }).toThrow();
  });

  it("copies a theme sharing nothing with it", () => {
    const copy: ThemeTokens = copyTheme(DEFAULT_THEME);

    expect(copy).toEqual(DEFAULT_THEME);
    expect(copy.colors).not.toBe(DEFAULT_THEME.colors);
    expect(copy.typeScale.h1).not.toBe(DEFAULT_THEME.typeScale.h1);
  });

  it("takes any family a font catalogue can hold, but nothing that could leave a CSS string", () => {
    const family = (name: string) =>
      themeTokensSchema.safeParse({
        ...DEFAULT_THEME,
        fonts: { ...DEFAULT_THEME.fonts, body: { family: name, fallback: "serif" } },
      }).success;

    expect(
      [
        "Noto Sans JP",
        "M PLUS 1p",
        "Mrs. Saint-Delafield",
        "Hind Siliguri",
        "Ç Font",
        "Zilla Slab",
      ].map(family),
    ).toEqual([true, true, true, true, true, true]);
    expect(['Inter", x', "a\\b", "a;b", "", " Lead", "x".repeat(65)].map(family)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("keeps named custom colours, each id once", () => {
    const custom = (colors: unknown) =>
      themeTokensSchema.safeParse({ ...DEFAULT_THEME, custom: colors }).success;
    const sky = { id: "sky", name: "Sky", value: { l: 0.8, c: 0.1, h: 230 } };

    expect(DEFAULT_THEME.custom).toEqual([]);
    expect(custom([sky, { ...sky, id: "sky-2", name: "Deep sky" }])).toBe(true);
    expect(custom([sky, { ...sky, name: "Again" }])).toBe(false);
    expect(custom([{ ...sky, id: "Sky" }])).toBe(false);
    expect(custom([{ ...sky, id: "-sky" }])).toBe(false);
    expect(custom([{ ...sky, name: "  " }])).toBe(false);
    expect(custom([{ ...sky, value: { l: 2, c: 0, h: 0 } }])).toBe(false);
    expect(custom(undefined)).toBe(false);
  });
});
