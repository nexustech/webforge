import {
  COLOR_ROLES,
  createSite,
  migrateSite,
  type Oklch,
  type ThemeTokens,
} from "@webforge/model";
import daisyThemes from "daisyui/theme/object.js";
import { describe, expect, it } from "vitest";

// Format 5 (2.1) turned each site's daisyUI theme name into tokens, from a table written once from
// daisyUI's values. Every built-in theme must come out as daisyUI has it, or a migrated site would
// change how it looks.

/** daisyUI's own values for one theme, by CSS variable. */
type DaisyTheme = Readonly<Record<string, string>>;

const RADIUS: Readonly<Record<string, ThemeTokens["radius"]["box"]>> = {
  "0rem": "none",
  "0.25rem": "s",
  "0.5rem": "m",
  "1rem": "l",
  "2rem": "xl",
};

function oklch(css: string | undefined): Oklch {
  const match = /^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/.exec(css ?? "");
  if (match === null) throw new Error(`Not an OKLCH colour: ${css}`);
  return { l: Number(match[1]) / 100, c: Number(match[2]), h: Number(match[3]) };
}

/** A format 4 site whose theme is daisyUI's `name`, opened as this build opens it. */
function migrated(name: string): ThemeTokens {
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  });
  return migrateSite({ ...site, formatVersion: 4, theme: { name } }).theme;
}

const themes = Object.entries(daisyThemes as unknown as Readonly<Record<string, DaisyTheme>>);

describe("format 5's daisyUI themes (2.1)", () => {
  it("knows every theme daisyUI has", () => {
    expect(themes.length).toBeGreaterThanOrEqual(35);
  });

  it.each(themes)("migrates %s as daisyUI has it", (name, daisy) => {
    const theme = migrated(name);

    expect(theme.preset).toBe(name);
    expect(theme.scheme).toBe(daisy["color-scheme"]);
    for (const role of COLOR_ROLES) {
      const expected = oklch(daisy[`--color-${role}`]);
      const actual = theme.colors[role];
      expect(actual.l, `${name} ${role} lightness`).toBeCloseTo(expected.l, 5);
      expect(actual.c, `${name} ${role} chroma`).toBe(expected.c);
      expect(actual.h, `${name} ${role} hue`).toBe(expected.h);
    }
    expect(theme.radius).toEqual({
      box: RADIUS[daisy["--radius-box"] ?? ""],
      field: RADIUS[daisy["--radius-field"] ?? ""],
      selector: RADIUS[daisy["--radius-selector"] ?? ""],
    });
    expect(theme.border).toBe(daisy["--border"] === "2px" ? "thick" : "thin");
    expect(theme.effects).toEqual({
      depth: daisy["--depth"] === "1",
      noise: daisy["--noise"] === "1",
    });
    // Sizes the tokens don't set are the same in every daisyUI theme.
    expect([daisy["--size-selector"], daisy["--size-field"]]).toEqual(["0.25rem", "0.25rem"]);
  });
});
