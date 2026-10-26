import { describe, expect, it } from "vitest";
import { CLASS_CATEGORIES, classCategory, usesThemeColour } from "./class-categories.js";
import { closestClass, MAX_SUGGESTIONS, suggestClasses } from "./class-match.js";

const CATALOGUE = {
  classes: [
    "p-4",
    "px-4",
    "bg-primary",
    "bg-primary-content",
    "bg-base-200",
    "btn",
    "btn-primary",
    "flex",
    "shadow-lg",
    "text-primary",
    "rounded-box",
  ],
  variants: ["md", "hover", "dark"],
};

describe("suggestions for the class being typed (#276)", () => {
  it("starts with the classes that start with it, shortest first, then fuzzy matches", () => {
    expect(suggestClasses(CATALOGUE, "bg-pri")).toEqual(["bg-primary", "bg-primary-content"]);
    // Its letters in order: `bgpr` is in `bg-primary`, closer than in `bg-primary-content`.
    expect(suggestClasses(CATALOGUE, "bgpr")).toEqual(["bg-primary", "bg-primary-content"]);
    expect(suggestClasses(CATALOGUE, "btn")).toEqual(["btn-primary"]);
  });

  it("keeps the variants typed in front, and offers variants themselves", () => {
    expect(suggestClasses(CATALOGUE, "md:fl")).toEqual(["md:flex"]);
    expect(suggestClasses(CATALOGUE, "hover:bg-p")).toEqual([
      "hover:bg-primary",
      "hover:bg-primary-content",
    ]);
    expect(suggestClasses(CATALOGUE, "ho")).toEqual(["hover:"]);
    expect(suggestClasses(CATALOGUE, "md:")).toEqual([]);
  });

  it("shows at most fifty", () => {
    const many = { classes: Array.from({ length: 200 }, (_, n) => `m-${n}`), variants: [] };

    expect(suggestClasses(many, "m-")).toHaveLength(MAX_SUGGESTIONS);
  });
});

describe("the class closest to one that makes no style (#276)", () => {
  it("knows CSS's own words, a letter or two wrong", () => {
    expect(closestClass(CATALOGUE, "pading-4")).toBe("p-4");
    expect(closestClass(CATALOGUE, "md:padding-4")).toBe("md:p-4");
  });

  it("is otherwise the class a letter or two away, or none", () => {
    expect(closestClass(CATALOGUE, "shadow-lgg")).toBe("shadow-lg");
    expect(closestClass(CATALOGUE, "hover:bg-primry")).toBe("hover:bg-primary");
    expect(closestClass(CATALOGUE, "my-own-class")).toBeUndefined();
  });
});

describe("the class browser's categories (#276)", () => {
  it("puts each class under the first rule its name matches", () => {
    expect(classCategory("btn-primary")).toBe("components");
    expect(classCategory("bg-primary")).toBe("colours");
    expect(classCategory("text-red-500")).toBe("colours");
    expect(classCategory("rounded-box")).toBe("borders");
    expect(classCategory("px-4")).toBe("spacing");
    expect(classCategory("-mt-2")).toBe("spacing");
    expect(classCategory("max-w-xl")).toBe("size");
    expect(classCategory("flex")).toBe("layout");
    expect(classCategory("text-lg")).toBe("typography");
    expect(classCategory("shadow-lg")).toBe("effects");
    expect(classCategory("sr-only")).toBeUndefined();
    expect(CLASS_CATEGORIES).toHaveLength(8);
  });

  it("knows the theme's colours, which come first", () => {
    expect(usesThemeColour("bg-primary")).toBe(true);
    expect(usesThemeColour("text-base-content")).toBe(true);
    expect(usesThemeColour("bg-primary/50")).toBe(true);
    expect(usesThemeColour("bg-red-500")).toBe(false);
  });
});
