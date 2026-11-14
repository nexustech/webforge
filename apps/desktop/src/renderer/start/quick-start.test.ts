import { CURATED_THEMES, contrastRatio, themePreset } from "@webforge/themes";
import { describe, expect, it } from "vitest";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import {
  answersFromBrief,
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
        businessType: "food",
      },
      pages: { leaveOut: ["cafe-visit"], recipes: ["food-events"] },
    });
  });

  it("sends what the person said about the business for the assistant, trimmed, if anything (QS-7)", () => {
    expect(quickStartRequest(answers({ about: "  Sourdough.  " }), "My site").about).toBe(
      "Sourdough.",
    );
    expect(quickStartRequest(answers({ about: "   " }), "My site")).not.toHaveProperty("about");
  });

  it("asks for one page only when it was chosen (GA10, 5.9)", () => {
    const answers = emptyAnswers("My site");

    expect(quickStartRequest(answers, "My site").pages).toEqual({ leaveOut: [], recipes: [] });
    expect(quickStartRequest({ ...answers, onePage: true }, "My site").pages).toEqual({
      leaveOut: [],
      recipes: [],
      onePage: true,
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
  it("offers three curated presets' colours, other than the theme's and different for each", () => {
    const curated = CURATED_THEMES.map((each) => each.preset);

    for (const theme of ["light", ...curated]) {
      const palettes = palettesFor(theme);
      expect(palettes).toHaveLength(3);
      expect(palettes).not.toContain(theme);
      expect(new Set(palettes).size).toBe(3);
      for (const preset of palettes) expect(curated).toContain(preset);
    }
    expect(palettesFor("bistro")).not.toEqual(palettesFor("atelier"));
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

describe("answers from an AI app's brief (4.12a, AIB-5)", () => {
  const template = (id: string, category: "trades" | "food", theme: string): TemplateSummary => ({
    id: id as TemplateSummary["id"],
    category,
    example: false,
    pages: 1,
    pageList: [{ id: "home", title: "Home", home: true }],
    theme,
    thumbnail: null,
  });
  const templates = [template("cafe", "food", "bistro"), template("trades", "trades", "workshop")];

  it("gives the type's first template and theme, and what the brief says, as the person would", () => {
    const answers = answersFromBrief(
      {
        businessType: "trades",
        businessKind: "AutoRepair",
        name: "Rapidfix",
        colours: { colour: "#C62828" },
        recipes: ["trades-areas"],
        openingHours: [{ days: ["mon"], opens: "08:00", closes: "17:30" }],
      },
      templates,
      "My site",
    );

    expect(answers).toMatchObject({
      category: "trades",
      businessKind: "AutoRepair",
      name: "Rapidfix",
      template: "trades",
      theme: "workshop",
      colours: { kind: "colour", hex: "#c62828" },
      recipes: ["trades-areas"],
      openingHours: [{ days: ["mon"], opens: "08:00", closes: "17:30" }],
      phone: "",
    });
    expect(quickStartRequest(answers, "My site").business).toMatchObject({
      businessType: "trades",
      businessKind: "AutoRepair",
    });
  });

  it("takes a palette and a theme of its own, and drops a kind the type changed away from", () => {
    const answers = answersFromBrief(
      { businessType: "food", name: "Rosa's", theme: "light", colours: { palette: "bistro" } },
      templates,
      "My site",
    );
    expect(answers).toMatchObject({
      template: "cafe",
      theme: "light",
      colours: { kind: "palette", preset: "bistro" },
    });

    const changed = withCategory({ ...answers, businessKind: "Bakery" }, "trades", templates);
    expect(changed.businessKind).toBeUndefined();
  });
});
