import { describe, expect, it } from "vitest";
import themeCss from "./theme.css?raw";

type Theme = "dark" | "light";

/** The `--name: #hex;` tokens of one theme block of theme.css. */
function tokensOf(theme: Theme): ReadonlyMap<string, string> {
  const selector = theme === "dark" ? ':root[data-theme="dark"] {' : ':root[data-theme="light"] {';
  const start = themeCss.indexOf(selector);
  const block = themeCss.slice(start, themeCss.indexOf("}", start));
  return new Map(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name = "", hex = ""]) => [
      name,
      hex.toLowerCase(),
    ]),
  );
}

/** WCAG 2.x relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const [r = 0, g = 0, b = 0] = channels.map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio of two colours, from 1 to 21. */
function contrast(a: string, b: string): number {
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
  foreground: SURFACES,
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

function failures(theme: Theme, pairs: Readonly<Record<string, readonly string[]>>, min: number) {
  const tokens = new Map([...tokensOf(theme), ["page", "#ffffff"]]);
  return Object.entries(pairs).flatMap(([foreground, backgrounds]) =>
    backgrounds.flatMap((background) => {
      const fg = tokens.get(foreground);
      const bg = tokens.get(background);
      if (fg === undefined || bg === undefined) {
        return [`${foreground} on ${background}: token missing`];
      }
      const ratio = contrast(fg, bg);
      return ratio >= min ? [] : [`${foreground} on ${background}: ${ratio.toFixed(2)}:1`];
    }),
  );
}

describe("theme contrast (WCAG AA)", () => {
  it("computes ratios as WCAG does", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
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
