import { contrastRatio, THEME_PRESETS, themePreset } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import {
  emptyAnswers,
  palettesFor,
  type QuickStartAnswers,
  quickStartRequest,
  recipesOffered,
  themeOf,
  withCategory,
  withTemplate,
} from "./quick-start.js";

const answers = (change: Partial<QuickStartAnswers> = {}): QuickStartAnswers => ({
  ...emptyAnswers("My site"),
  ...change,
});

describe("the quick start's request (QS-1, 3.11b)", () => {
  it("makes the untitled Blank site when every step is skipped", () => {
    expect(quickStartRequest(answers({ name: "  " }), "My site")).toEqual({
      name: "My site",
      theme: "light",
      business: {},
      pages: { leaveOut: [], recipes: [] },
    });
  });

  it("sends the person's business, template, pages and web address, trimmed", () => {
    const request = quickStartRequest(
      answers({
        category: "food",
        name: " Rosa's Bakery ",
        whatYouDo: " Bread and cakes ",
        template: "cafe",
        theme: "bistro",
        leaveOut: ["cafe-visit"],
        recipes: ["food-events"],
        phone: "+44 1234 567890",
        email: " ",
        openingHours: [{ days: ["tue"], opens: "07:00", closes: "15:00" }],
        webAddress: "https://rosas.example",
      }),
      "My site",
    );

    expect(request).toEqual({
      name: "Rosa's Bakery",
      theme: "bistro",
      template: "cafe",
      business: {
        description: "Bread and cakes",
        phone: "+44 1234 567890",
        openingHours: [{ days: ["tue"], opens: "07:00", closes: "15:00" }],
        webAddress: "https://rosas.example",
      },
      pages: { leaveOut: ["cafe-visit"], recipes: ["food-events"] },
    });
  });

  it("offers the business type's page recipes, and none before a type is chosen", () => {
    expect(recipesOffered(null)).toEqual([]);
    expect(recipesOffered("trades").map((recipe) => recipe.id)).toContain("trades-areas");
  });
});

describe("the quick start's choices, driven by the answers (QS-1)", () => {
  const template = (id: "cafe" | "salon" | "trades", category: "food" | "beauty" | "trades") =>
    ({
      id,
      category,
      example: false,
      pages: 1,
      pageList: [],
      theme: `${id}-theme`,
      thumbnail: null,
    }) satisfies TemplateSummary;
  const templates = [template("cafe", "food"), template("salon", "beauty")];

  it("chooses the business type's first template, in its theme, and clears the old type's choices", () => {
    const before = answers({ leaveOut: ["x"], recipes: ["food-events"] });

    expect(withCategory(before, "beauty", templates)).toMatchObject({
      category: "beauty",
      template: "salon",
      theme: "salon-theme",
      leaveOut: [],
      recipes: [],
    });
  });

  it("keeps a template of the type, or any while no type is chosen, and Blank for a type without one", () => {
    const chosen = withTemplate(answers(), templates[0] ?? null);
    const themed = { ...chosen, theme: "dark" };

    expect(withCategory(themed, "food", templates)).toMatchObject({
      template: "cafe",
      theme: "dark",
    });
    expect(withCategory(themed, null, templates)).toMatchObject({
      template: "cafe",
      theme: "dark",
    });
    expect(withCategory(themed, "trades", templates)).toMatchObject({
      category: "trades",
      template: null,
      theme: "dark",
    });
  });

  it("takes a template's theme and all its pages, and keeps the theme for Blank", () => {
    const blank = withTemplate(answers({ theme: "dark", leaveOut: ["x"] }), null);

    expect(blank).toMatchObject({ template: null, theme: "dark", leaveOut: [] });
  });
});

describe("the quick start's colours (QS-1)", () => {
  it("offers three other presets' colours for the theme", () => {
    const palettes = palettesFor("light");

    expect(palettes).toHaveLength(3);
    expect(palettes).not.toContain("light");
    for (const preset of palettes) {
      expect(THEME_PRESETS.map((each) => each.preset)).toContain(preset);
    }
  });

  it("keeps the theme's own colours, or puts a palette's, a logo's or one colour's on it, readable", () => {
    const own = themeOf(answers({ theme: "light" }));
    expect(own).toEqual(themePreset("light"));
    expect(quickStartRequest(answers(), "My site")).not.toHaveProperty("themeTokens");

    for (const colours of [
      { kind: "palette", preset: "bistro" },
      { kind: "colour", hex: "#c0392b" },
    ] as const) {
      const theme = themeOf(answers({ theme: "light", colours }));
      expect(theme.preset).toBe("light");
      expect(theme.colors.primary).not.toEqual(own.colors.primary);
      // Brand text stays readable on Brand, as the theme's own does (WCAG AA).
      expect(contrastRatio(theme.colors["primary-content"], theme.colors.primary)).toBeGreaterThan(
        4.5,
      );
      expect(quickStartRequest(answers({ colours }), "My site").themeTokens).toEqual(
        themeOf(answers({ colours })),
      );
    }
  });
});
