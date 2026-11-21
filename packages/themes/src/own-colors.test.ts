import { DEFAULT_THEME, INVERSE_THEME, type Oklch, type ThemeTokens } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { contrastRatio, inverseColors, ownColorOf, resolveColorRef, shadeOf } from "./colors.js";
import { ownColorIssues } from "./contrast.js";
import { oklchCss, themeCss, themeShape, themeValuesCss } from "./theme-css.js";

// The person's own colours in the theme (TC-1a, #1217): their values, their shades, their value in
// reversed sections, their CSS and their contrast.

const SKY: Oklch = { l: 0.62, c: 0.14, h: 240 };

/** The default theme with `colours` of the person's own. */
const withColours = (...colours: { id: string; name: string; color: Oklch }[]): ThemeTokens => ({
  ...DEFAULT_THEME,
  ownColors: colours,
});

/** The page's own colours' block in the theme's CSS (the one in the phone query is the type's). */
const PAGE = `:root, [data-theme="${DEFAULT_THEME.preset}"]`;

/** The declarations in `css`'s block that starts with `selector`, up to its closing brace. */
const block = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  return at === -1 ? "" : css.slice(at, css.indexOf("\n}", at));
};

describe("the person's own colours (TC-1a, #1217)", () => {
  it("resolve by id, with shades and opacity as the colour roles have them", () => {
    const theme = withColours({ id: "sky", name: "Sky", color: SKY });

    expect(resolveColorRef(theme, "own-sky")).toEqual({ color: SKY, opacity: 1 });
    expect(resolveColorRef(theme, "own-sky-300/50")).toEqual({
      color: shadeOf(SKY, 300),
      opacity: 0.5,
    });
    // One the theme doesn't have draws nothing, and is measured as nothing.
    expect(resolveColorRef(theme, "own-moss")).toBeUndefined();
    expect(resolveColorRef(DEFAULT_THEME, "own-sky")).toBeUndefined();
  });

  it("have a value in reversed sections worked out from each, that stands apart from them", () => {
    // A dark blue on a light theme: too dark on reversed sections' dark surface as it is.
    const navy: Oklch = { l: 0.3, c: 0.12, h: 260 };
    const theme = withColours({ id: "navy", name: "Navy", color: navy });
    const surface = inverseColors(theme)["base-100"];
    expect(contrastRatio(navy, surface)).toBeLessThan(3);

    const reversed = ownColorOf(theme, "navy", "inverse");
    if (reversed === undefined) throw new Error("no reversed value");
    expect({ c: reversed.c, h: reversed.h }).toEqual({ c: navy.c, h: navy.h });
    expect(reversed.l).toBeGreaterThan(navy.l);
    expect(contrastRatio(reversed, surface)).toBeGreaterThanOrEqual(3);
    expect(resolveColorRef(theme, "own-navy", "inverse")?.color).toEqual(reversed);

    // One that stands apart already is itself there.
    const sky = withColours({ id: "sky", name: "Sky", color: SKY });
    if (contrastRatio(SKY, inverseColors(sky)["base-100"]) >= 3) {
      expect(ownColorOf(sky, "sky", "inverse")).toEqual(SKY);
    }
  });

  it("are variables of the theme's CSS, with their shades, in both palettes, by id only", () => {
    const name = "Rosa's red\"; } body { color: red";
    const css = themeCss(withColours({ id: "sky", name, color: SKY }));

    // Utilities that read the variables, so a new value needs no new compile.
    const utilities = block(css, "@theme inline");
    expect(utilities).toContain("--color-own-sky: var(--wf-color-own-sky);");
    expect(utilities).toContain("--color-own-sky-300: var(--wf-color-own-sky-300);");
    // Their values, the page's and reversed sections'.
    expect(block(css, PAGE)).toContain(`--wf-color-own-sky: ${oklchCss(SKY)};`);
    expect(block(css, PAGE)).toContain(`--wf-color-own-sky-300: ${oklchCss(shadeOf(SKY, 300))};`);
    expect(block(css, `[data-theme="${INVERSE_THEME}"]`)).toContain("--wf-color-own-sky:");
    // A name is never written into CSS.
    expect(css).not.toContain("Rosa");
    expect(css).not.toContain("color: red");
  });

  it("change the shape only when one is added or removed: a value or a name needs no compile", () => {
    const sky = withColours({ id: "sky", name: "Sky", color: SKY });
    const renamed = withColours({ id: "sky", name: "Sky blue", color: { l: 0.4, c: 0.2, h: 30 } });
    const more = withColours(
      { id: "sky", name: "Sky", color: SKY },
      { id: "moss", name: "Moss", color: SKY },
    );

    expect(themeCss(themeShape(renamed))).toBe(themeCss(themeShape(sky)));
    expect(themeCss(themeShape(more))).not.toBe(themeCss(themeShape(sky)));
    expect(themeCss(themeShape(DEFAULT_THEME))).not.toBe(themeCss(themeShape(sky)));
    // The values follow the shape's stylesheet, in both palettes.
    const values = themeValuesCss(renamed);
    expect(block(values, PAGE)).toContain(
      `--wf-color-own-sky: ${oklchCss({ l: 0.4, c: 0.2, h: 30 })};`,
    );
    expect(block(values, `[data-theme="${INVERSE_THEME}"]`)).toContain("--wf-color-own-sky:");
  });

  it("are measured as the brand colours are, on every surface and in reversed sections", () => {
    const pale: Oklch = { l: 0.95, c: 0.03, h: 90 };
    const theme = withColours(
      { id: "pale", name: "Pale", color: pale },
      { id: "ink", name: "Ink", color: { l: 0.25, c: 0.05, h: 260 } },
    );
    const issues = ownColorIssues(theme);

    expect(issues.filter((issue) => issue.palette === "colors").map((issue) => issue.id)).toEqual([
      "pale",
      "pale",
      "pale",
    ]);
    expect(issues[0]).toMatchObject({ background: "base-100", required: 3 });
    expect(issues[0]?.ratio).toBeLessThan(3);
    // A theme without any has nothing to measure.
    expect(ownColorIssues(DEFAULT_THEME)).toEqual([]);
  });
});
