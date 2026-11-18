import { describe, expect, expectTypeOf, it } from "vitest";
import { de } from "./de/site-text.js";
import { components as en } from "./en/components/index.js";
import { es } from "./es/site-text.js";
import { fr } from "./fr/site-text.js";
import { SITE_TEXT_KEYS, siteText, siteTextFor, siteTextFrom } from "./site-text.js";
import type { SiteTextCatalogue, SiteTextKey } from "./site-text-key.js";

const CATALOGUES = { fr, de, es } as const;
const placeholders = (message: string) =>
  [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("siteText (6.12, CC-1)", () => {
  it("lists the 83 labels of the site, each a key of the English catalogue", () => {
    expect(SITE_TEXT_KEYS).toHaveLength(83);
    expect(SITE_TEXT_KEYS.every((key) => key.startsWith("siteText.") && key in en)).toBe(true);
  });

  it("gives a site's labels in its language, by its primary subtag", () => {
    expect(siteText("de", "siteText.menu")).toBe("Menü");
    expect(siteText("de-AT", "siteText.menu")).toBe("Menü");
    expect(siteText("FR-ca", "siteText.backToTop")).toBe("Retour en haut");
    expect(siteText("es-MX", "siteText.consent.accept")).toBe("Aceptar todas");
    expect(siteText("es", "siteText.slideOf", { n: 2, total: 5 })).toBe("2 de 5");
  });

  it("gives English for English, a language without a catalogue, or none at all", () => {
    expect(siteText("en-GB", "siteText.menu")).toBe("Menu");
    expect(siteText("it", "siteText.menu")).toBe("Menu");
    expect(siteText(undefined, "siteText.menu")).toBe("Menu");
    // Not a key of the catalogue map's prototype either.
    expect(siteText("constructor", "siteText.menu")).toBe("Menu");
  });

  it("falls back to English string by string, for a label a catalogue lacks", () => {
    const partial: SiteTextCatalogue = { "siteText.menu": "Menü" };
    const labels = siteTextFrom(partial);
    expect(labels("siteText.menu")).toBe("Menü");
    expect(labels("siteText.backToTop")).toBe("Back to top");
    expect(labels("siteText.imageOf", { n: 3, total: 8 })).toBe("3 of 8");
  });

  it("gives the owner's own wording first, for each label they changed (6.12)", () => {
    const labels = siteTextFor("de", {
      "siteText.menu": "Speisekarte",
      "siteText.slideOf": "Bild {n}/{total}",
      // Left empty: the language's.
      "siteText.backToTop": "  ",
    });
    expect(labels("siteText.menu")).toBe("Speisekarte");
    expect(labels("siteText.slideOf", { n: 2, total: 5 })).toBe("Bild 2/5");
    expect(labels("siteText.backToTop")).toBe("Nach oben");
    expect(labels("siteText.close")).toBe("Schließen");
    expect(siteTextFor("it", { "siteText.menu": "Menù" })("siteText.menu")).toBe("Menù");
  });

  it("leaves a placeholder in when it's given as itself, for a site's script to fill", () => {
    expect(siteTextFor("de")("siteText.slideOf", { n: "{n}", total: "{total}" })).toBe(
      "{n} von {total}",
    );
  });

  it("checks params against the English message's placeholders", () => {
    expectTypeOf(siteTextFor("fr")).parameter(0).toEqualTypeOf<SiteTextKey>();
    const checks = () => {
      // @ts-expect-error: the message needs {n} and {total}.
      siteText("fr", "siteText.slideOf");
      // @ts-expect-error: not a label of the site.
      siteText("fr", "app.name");
    };
    expect(checks).toBeTypeOf("function");
  });
});

describe.each(Object.entries(CATALOGUES))("the %s catalogue", (_language, catalogue) => {
  const entries = Object.entries(catalogue) as [SiteTextKey, string][];

  it("has every label of the site, and nothing else", () => {
    expect(Object.keys(catalogue).sort()).toEqual([...SITE_TEXT_KEYS].sort());
  });

  it("has each English message's placeholders, no more and no fewer", () => {
    const differing = entries.filter(
      ([key, message]) => placeholders(message).join() !== placeholders(en[key]).join(),
    );
    expect(differing).toEqual([]);
  });

  it("has no empty messages", () => {
    expect(entries.filter(([, message]) => message.trim() === "")).toEqual([]);
  });
});
