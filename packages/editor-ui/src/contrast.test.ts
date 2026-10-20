import { describe, expect, it } from "vitest";
import themeCss from "./theme.css?raw";

type Theme = "dark" | "light";

type Rgba = readonly [r: number, g: number, b: number, alpha: number];

/** The colour tokens (`#rrggbb` or `rgb(r g b / a)`) of one theme block of theme.css. */
function tokensOf(theme: Theme): ReadonlyMap<string, Rgba> {
  const selector = theme === "dark" ? ':root[data-theme="dark"] {' : ':root[data-theme="light"] {';
  const start = themeCss.indexOf(selector);
  const block = themeCss.slice(start, themeCss.indexOf("}", start));
  const tokens = new Map<string, Rgba>();
  for (const [, name = "", hex = ""] of block.matchAll(/--([\w-]+):\s*#([0-9a-f]{6});/gi)) {
    const [r = 0, g = 0, b = 0] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    tokens.set(name, [r, g, b, 1]);
  }
  const rgb = /--([\w-]+):\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\);/g;
  for (const [, name = "", r = "0", g = "0", b = "0", alpha = "1"] of block.matchAll(rgb)) {
    tokens.set(name, [Number(r), Number(g), Number(b), Number(alpha)]);
  }
  return tokens;
}

/** A translucent colour as it shows over an opaque one. */
function over(top: Rgba, base: Rgba): Rgba {
  const [r, g, b, a] = top;
  return [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a), 1];
}

/** WCAG 2.x relative luminance of an opaque colour. */
function luminance([r, g, b]: Rgba): number {
  const [lr = 0, lg = 0, lb = 0] = [r, g, b].map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG 2.x contrast ratio of two opaque colours, from 1 to 21. */
function contrast(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** Every surface the editor shows text on. */
const SURFACES = [
  "background",
  "panel",
  "panel-group",
  "tabs",
  "titlebar",
  "toolbar",
  "card",
  "popover",
  "input",
  "muted",
  "secondary",
];

/** Foreground → backgrounds it is used on as text: at least 4.5:1 (WCAG 1.4.3). */
const TEXT_PAIRS: Readonly<Record<string, readonly string[]>> = {
  foreground: [...SURFACES, "hover@panel", "hover@popover"],
  "muted-foreground": ["background", "panel", "panel-group", "tabs", "titlebar", "card", "input"],
  "tab-inactive": ["tabs"],
  "card-foreground": ["card"],
  "popover-foreground": ["popover"],
  "secondary-foreground": ["secondary"],
  "primary-foreground": ["primary"],
  "destructive-foreground": ["destructive"],
  // Links in panels and the "Saved" status in the title bar.
  info: ["panel", "card"],
  "save-status": ["titlebar"],
  // Translucent highlights, written `top@base`: selected rows, open menus, hovered rows.
  "accent-foreground": ["accent@panel", "accent@popover", "accent@input"],
};

/** Controls, icons and outlines → what they sit on: at least 3:1 (WCAG 1.4.11). */
const UI_PAIRS: Readonly<Record<string, readonly string[]>> = {
  ring: ["background", "panel", "panel-group", "tabs", "titlebar", "toolbar", "card", "input"],
  // Colour-coded title-bar icons (UI1).
  success: ["titlebar"],
  warning: ["titlebar"],
  info: ["titlebar"],
  publish: ["titlebar"],
  "save-status": ["titlebar"],
  // The canvas outline sits on the user's page, white by default.
  "selection-outline": ["page"],
};

/** A token's colour; `top@base` is a translucent token shown over an opaque one. */
function colour(tokens: ReadonlyMap<string, Rgba>, name: string): Rgba | undefined {
  const [topName = "", baseName] = name.split("@");
  const top = tokens.get(topName);
  if (baseName === undefined || top === undefined) {
    return top;
  }
  const base = tokens.get(baseName);
  return base === undefined ? undefined : over(top, base);
}

function failures(theme: Theme, pairs: Readonly<Record<string, readonly string[]>>, min: number) {
  const tokens = new Map([...tokensOf(theme), ["page", [255, 255, 255, 1] as const]]);
  return Object.entries(pairs).flatMap(([foreground, backgrounds]) =>
    backgrounds.flatMap((background) => {
      const fg = colour(tokens, foreground);
      const bg = colour(tokens, background);
      if (fg === undefined || bg === undefined || fg[3] !== 1 || bg[3] !== 1) {
        return [`${foreground} on ${background}: missing or translucent token`];
      }
      const ratio = contrast(fg, bg);
      return ratio >= min ? [] : [`${foreground} on ${background}: ${ratio.toFixed(2)}:1`];
    }),
  );
}

describe("theme contrast (WCAG AA)", () => {
  it("computes ratios as WCAG does", () => {
    const white: Rgba = [255, 255, 255, 1];
    expect(contrast(white, [0, 0, 0, 1])).toBeCloseTo(21);
    expect(contrast([119, 119, 119, 1], white)).toBeCloseTo(4.48, 2);
    expect(over([0, 0, 0, 0.5], white)).toEqual([127.5, 127.5, 127.5, 1]);
  });

  it.each(["dark", "light"] as const)("defines the same tokens in the %s theme", (theme) => {
    expect([...tokensOf(theme).keys()].toSorted()).toEqual([...tokensOf("dark").keys()].toSorted());
  });

  it.each(["dark", "light"] as const)("has text at 4.5:1 or more in the %s theme", (theme) => {
    expect(failures(theme, TEXT_PAIRS, 4.5)).toEqual([]);
  });

  it.each(["dark", "light"] as const)(
    "has controls and icons at 3:1 or more in the %s theme",
    (theme) => {
      expect(failures(theme, UI_PAIRS, 3)).toEqual([]);
    },
  );
});
