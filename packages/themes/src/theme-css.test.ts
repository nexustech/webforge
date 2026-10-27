import { DEFAULT_THEME, INVERSE_THEME, type ThemeTokens } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { themeCss, themeShape, themeValuesCss } from "./theme-css.js";

/** Themes that differ from the default in each value a shape leaves out, and in its own parts. */
const THEMES: readonly ThemeTokens[] = [
  DEFAULT_THEME,
  {
    ...DEFAULT_THEME,
    preset: "bistro",
    scheme: "dark",
    colors: {
      ...DEFAULT_THEME.colors,
      primary: { l: 0.62, c: 0.19, h: 30 },
      "base-100": { l: 0.18, c: 0.01, h: 260 },
    },
    inverse: undefined,
    radius: { box: "xl", field: "full", selector: "none" },
    border: "thick",
    effects: { depth: false, noise: true },
    spacing: "roomy",
    typeScale: {
      ...DEFAULT_THEME.typeScale,
      h1: { size: "6xl", weight: 800, leading: "tight" },
      body: { size: "lg", weight: 400, leading: "relaxed" },
    },
    links: { underline: "always" },
    buttons: { shape: "pill", size: "l", style: "outline" },
    shadow: "strong",
    headings: { case: "uppercase", tracking: "wide" },
    cards: { style: "raised" },
    images: { corners: "soft" },
    sections: { rhythm: "alternating" },
  },
  {
    ...DEFAULT_THEME,
    spacing: "compact",
    typeScale: { ...DEFAULT_THEME.typeScale, h1: { size: "xl", weight: 600, leading: "normal" } },
    buttons: { ...DEFAULT_THEME.buttons, size: "s", shape: "square" },
    shadow: "none",
  },
];

/** The rule each line of `themeCss` is in: the page's theme, the inverse one, or the phone's. */
function contextOf(lines: readonly string[], at: number, preset: string): string {
  for (let line = at; line >= 0; line--) {
    const text = lines[line] ?? "";
    if (text.startsWith("  name: ")) return text.includes(INVERSE_THEME) ? "inverse" : "page";
    if (text.startsWith(`[data-theme="${INVERSE_THEME}"]`)) return "inverse";
    if (text.startsWith("@media")) return "phone";
    if (text.startsWith("@theme {") || text.startsWith(`:root, [data-theme="${preset}"]`)) {
      return "page";
    }
  }
  return "none";
}

/** The declarations in each section of a values block, by its context. */
function sectionsOf(values: string, preset: string): Map<string, Set<string>> {
  const sections = new Map<string, Set<string>>();
  let context = "none";
  for (const line of values.split("\n")) {
    if (line.startsWith(`:root, [data-theme="${preset}"]`)) context = "page";
    else if (line.startsWith(`[data-theme="${INVERSE_THEME}"]`)) context = "inverse";
    else if (line.startsWith("@media")) context = "phone";
    const set = sections.get(context) ?? new Set<string>();
    set.add(line.trim());
    sections.set(context, set);
  }
  return sections;
}

describe("a theme's shape and values (3.2)", () => {
  it("differ from the theme's stylesheet source only in custom properties, each in the values", () => {
    for (const theme of THEMES) {
      const full = themeCss(theme).split("\n");
      const shaped = themeCss(themeShape(theme)).split("\n");
      const values = sectionsOf(themeValuesCss(theme), theme.preset);
      // The same rules, line for line: only values differ.
      expect(shaped.length, theme.preset).toBe(full.length);
      full.forEach((line, at) => {
        if (line === shaped[at]) return;
        expect(line, `${theme.preset}: ${line}`).toMatch(/^\s*(?:--[\w-]+|color-scheme): .+;$/);
        const context = contextOf(full, at, theme.preset);
        expect(values.get(context)?.has(line.trim()), `${theme.preset} ${context}: ${line}`).toBe(
          true,
        );
      });
    }
  });

  it("keeps what changes the rules or the fonts: the same shape for themes of the same parts", () => {
    const [first, second] = THEMES;
    if (first === undefined || second === undefined) throw new Error("no themes");
    const recoloured = { ...first, colors: second.colors, spacing: second.spacing };
    expect(themeShape(recoloured)).toEqual(themeShape(first));
    expect(themeShape(second)).not.toEqual(themeShape(first));
  });

  it("declares the values as plain CSS, outside any layer, nothing for Tailwind to compile", () => {
    const values = themeValuesCss(THEMES[1] ?? DEFAULT_THEME);
    expect(values).not.toMatch(/@(?:theme|plugin|layer|apply)\b/);
    expect(values).toContain('[data-theme="bistro"] {');
    expect(values).toContain("--color-primary: oklch(62% 0.19 30);");
  });
});
