import { DEFAULT_THEME } from "@webforge/model";
import * as tailwind from "tailwindcss";
import { beforeAll, describe, expect, it } from "vitest";
import { type ClassCatalogue, loadClassCatalogue } from "../src/class-catalogue.js";
import { loadNodeResources } from "../src/node-resources.js";

let catalogue: ClassCatalogue;

beforeAll(async () => {
  catalogue = await loadClassCatalogue(await loadNodeResources(), DEFAULT_THEME);
});

describe("loadClassCatalogue (#276)", () => {
  // Guard: Tailwind's design-system API is `__unstable__`. If an upgrade renames it or changes its
  // shape, this fails, before the Edit panel's class suggestions quietly stop working.
  it("uses the Tailwind API it was written for", () => {
    expect(typeof tailwind.__unstable__loadDesignSystem).toBe("function");
    expect(catalogue.classes.length).toBeGreaterThan(10_000);
    expect(catalogue.classes.every((name) => typeof name === "string" && name !== "")).toBe(true);
  });

  it("lists Tailwind's utilities, daisyUI's components and the theme's own colours", () => {
    for (const name of ["p-4", "flex", "rounded-box", "btn", "btn-primary", "card"]) {
      expect(catalogue.classes, name).toContain(name);
    }
    for (const name of ["bg-primary", "text-base-content", "border-accent"]) {
      expect(catalogue.classes, name).toContain(name);
    }
  });

  it("lists the variants that go before a class, and none that can't be typed as they are", () => {
    for (const name of ["md", "lg", "hover", "focus", "dark"]) {
      expect(catalogue.variants, name).toContain(name);
    }
    expect(catalogue.variants.every((name) => /^[a-z][a-z0-9-]*$/.test(name))).toBe(true);
  });

  it("gives each class's CSS, and none for a class that produces none", () => {
    const [padding, typo, responsive] = catalogue.cssFor(["p-4", "pading-4", "md:flex"]);
    expect(padding).toContain("padding");
    expect(typo).toBeNull();
    expect(responsive).toContain("display: flex");
  });
});
