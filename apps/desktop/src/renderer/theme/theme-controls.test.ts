import { copyTheme, DEFAULT_THEME, TEXT_STYLES } from "@webforge/model";
import { FONT_PAIRINGS, THEME_PRESETS } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import { setTokenValue, TOKEN_CONTROLS, tokenKey, tokenValue } from "./theme-controls.js";
import { named } from "./theme-words.js";

describe("the Theme tab's tokens (2.3a, PH2-15)", () => {
  it("offers every choice the theme has, from its schema, the most visible first", () => {
    expect(TOKEN_CONTROLS.map(tokenKey)).toEqual([
      "headings.case",
      "headings.tracking",
      "buttons.shape",
      "buttons.size",
      "buttons.style",
      "links.underline",
      "radius.box",
      "radius.field",
      "radius.selector",
      "images.corners",
      "cards.style",
      "sections.rhythm",
      "spacing",
      "shadow",
      "border",
      "effects.depth",
      "effects.noise",
    ]);
    // Links read "never" from older files as "hover" (#427): offered as what it becomes.
    expect(TOKEN_CONTROLS.find((control) => tokenKey(control) === "links.underline")).toEqual({
      path: ["links", "underline"],
      group: "links",
      values: ["always", "hover"],
    });
    expect(TOKEN_CONTROLS.find((control) => tokenKey(control) === "effects.noise")?.values).toBe(
      "toggle",
    );
  });

  it("has the words for every token, value, group and undo step, so a new token only needs them", () => {
    const missing = TOKEN_CONTROLS.flatMap((control) => {
      const key = tokenKey(control);
      const keys = [
        `theme.token.${key}`,
        `theme.group.${control.group}`,
        `theme.history.${control.group}`,
        ...(control.values === "toggle"
          ? []
          : control.values.map((value) => `theme.token.${key}.${value}`)),
      ];
      return keys.filter((each) => named(each) === undefined);
    });
    expect(missing).toEqual([]);
  });

  it("names every preset, pairing and text style", () => {
    const keys = [
      ...THEME_PRESETS.map((preset) => `theme.preset.${preset.preset}`),
      ...FONT_PAIRINGS.map((pairing) => `fonts.pairing.${pairing.id}`),
      ...TEXT_STYLES.map((style) => `theme.textStyle.${style}`),
    ];
    expect(keys.filter((key) => named(key) === undefined)).toEqual([]);
  });

  it("reads and sets each token where the theme has it", () => {
    for (const control of TOKEN_CONTROLS) {
      const value = tokenValue(DEFAULT_THEME, control);
      if (control.values === "toggle") expect(typeof value).toBe("boolean");
      else expect(control.values).toContain(value);
    }
    const theme = copyTheme(DEFAULT_THEME);
    const cards = TOKEN_CONTROLS.find((control) => tokenKey(control) === "cards.style");
    const spacing = TOKEN_CONTROLS.find((control) => tokenKey(control) === "spacing");
    if (cards === undefined || spacing === undefined) throw new Error("missing tokens");
    setTokenValue(theme, cards, "raised");
    setTokenValue(theme, spacing, "roomy");
    expect(theme.cards.style).toBe("raised");
    expect(theme.spacing).toBe("roomy");
    expect(tokenValue(theme, cards)).toBe("raised");
  });
});
