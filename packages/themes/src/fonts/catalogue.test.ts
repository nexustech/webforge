import { type MessageKey, t } from "@webforge/i18n";
import { DEFAULT_THEME, fontRefSchema } from "@webforge/model";
import { describe, expect, it } from "vitest";
import {
  bundledFontBytes,
  catalogueFont,
  FONT_BUDGET_BYTES,
  FONT_CATALOGUE,
  FONT_PAIRINGS,
  fontRefOf,
} from "./catalogue.js";
import { FONT_LICENCES } from "./plan.js";

/** The UI's name for `key`, or undefined if the catalogue has none. */
const nameOf = (key: string): string | undefined => t(key as MessageKey);

describe("the font catalogue (2.2)", () => {
  it("bundles about 50 families, each once, licensed OFL, Apache or UFL only", () => {
    const ids = FONT_CATALOGUE.map((font) => font.id);
    expect(ids.length).toBeGreaterThanOrEqual(45);
    expect(ids.length).toBeLessThanOrEqual(55);
    expect(new Set(ids).size).toBe(ids.length);
    for (const font of FONT_CATALOGUE) {
      expect(FONT_LICENCES).toContain(font.licence);
    }
  });

  it("stays within the installer's font budget", () => {
    const bytes = bundledFontBytes(FONT_CATALOGUE);
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThanOrEqual(FONT_BUDGET_BYTES);
  });

  it("bundles Latin for every family, with a hash for every file", () => {
    for (const font of FONT_CATALOGUE) {
      expect(font.files.some((file) => file.subset === "latin")).toBe(true);
      expect(new Set(font.files.map((file) => file.file)).size).toBe(font.files.length);
      for (const file of font.files) {
        expect(file.file.startsWith(`${font.id}-`)).toBe(true);
      }
    }
  });

  it("has 12–15 pairings of its own families, each with a name", () => {
    expect(FONT_PAIRINGS.length).toBeGreaterThanOrEqual(12);
    expect(FONT_PAIRINGS.length).toBeLessThanOrEqual(15);
    for (const pairing of FONT_PAIRINGS) {
      expect(catalogueFont(pairing.heading)).toBeDefined();
      expect(catalogueFont(pairing.body)).toBeDefined();
      expect(nameOf(`fonts.pairing.${pairing.id}`)).toBeTypeOf("string");
    }
  });

  it("names every category it has", () => {
    for (const category of new Set(FONT_CATALOGUE.map((font) => font.category))) {
      expect(nameOf(`fonts.category.${category}`)).toBeTypeOf("string");
    }
  });

  it("gives every family as a theme stores it, the default theme's Inter included", () => {
    for (const font of FONT_CATALOGUE) {
      expect(fontRefSchema.parse(fontRefOf(font))).toEqual(fontRefOf(font));
    }
    const inter = catalogueFont("inter");
    expect(inter && fontRefOf(inter)).toEqual(DEFAULT_THEME.fonts.body);
    expect(catalogueFont("comic-sans")).toBeUndefined();
  });
});
