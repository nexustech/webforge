import { DEFAULT_THEME, type ThemeTokens } from "@webforge/model";
import { describe, expect, it } from "vitest";
import type { CatalogueFont } from "./catalogue.js";
import { fontFacesFor, usesAccentFont } from "./faces.js";

const withFonts = (heading: string, body: string): ThemeTokens => ({
  ...DEFAULT_THEME,
  fonts: {
    heading: { family: heading, fallback: "sans-serif" },
    body: { family: body, fallback: "sans-serif" },
    accent: { family: heading, fallback: "sans-serif" },
  },
});

const files = (theme: ThemeTokens) => fontFacesFor(theme).map((face) => face.file);

describe("fontFacesFor (2.2)", () => {
  it("gives a variable font's one file per style and subset, each once for both roles", () => {
    expect(files(DEFAULT_THEME).sort()).toEqual([
      "inter-latin-ext-wght-italic.woff2",
      "inter-latin-ext-wght-normal.woff2",
      "inter-latin-wght-italic.woff2",
      "inter-latin-wght-normal.woff2",
    ]);
    expect(fontFacesFor(DEFAULT_THEME)[0]).toMatchObject({
      family: "Inter",
      package: "@fontsource-variable/inter",
      weight: [100, 900],
      unicodeRange: expect.stringMatching(/^U\+0000-00FF,/),
    });
  });

  it("gives headings their upright weights and body text its weights, bold and italics", () => {
    const theme = withFonts("Poppins", "Lato");
    const heading = files(theme).filter((file) => /^poppins-latin-[0-9]/.test(file));
    const body = files(theme).filter((file) => /^lato-latin-[0-9]/.test(file));

    // The type scale's heading weights (700, 600), all upright.
    expect(heading.sort()).toEqual([
      "poppins-latin-600-normal.woff2",
      "poppins-latin-700-normal.woff2",
    ]);
    expect(body.sort()).toEqual([
      "lato-latin-400-italic.woff2",
      "lato-latin-400-normal.woff2",
      "lato-latin-700-italic.woff2",
      "lato-latin-700-normal.woff2",
    ]);
  });

  it("stands a static font's nearest weight in for one it doesn't have", () => {
    // Bebas Neue has only 400: it sets every heading.
    expect(
      files(withFonts("Bebas Neue", "Inter")).filter((file) => file.startsWith("bebas")),
    ).toEqual(["bebas-neue-latin-400-normal.woff2", "bebas-neue-latin-ext-400-normal.woff2"]);
    // Lato has 300, 400 and 700: a 600 heading takes 700, the heavier of the two nearest.
    const theme = withFonts("Lato", "Inter");
    const lato = files({
      ...theme,
      typeScale: Object.fromEntries(
        Object.entries(theme.typeScale).map(([style, step]) => [style, { ...step, weight: 600 }]),
      ) as ThemeTokens["typeScale"],
    }).filter((file) => /^lato-latin-[0-9]/.test(file));
    expect(lato).toEqual(["lato-latin-700-normal.woff2"]);
  });

  it("gives the accent font's files only when asked: any title's or text's weights (3.22)", () => {
    const theme: ThemeTokens = {
      ...withFonts("Poppins", "Lato"),
      fonts: {
        ...withFonts("Poppins", "Lato").fonts,
        accent: { family: "Pacifico", fallback: "sans-serif" },
      },
    };

    expect(files(theme).some((file) => file.startsWith("pacifico"))).toBe(false);
    const accent = fontFacesFor(theme, undefined, { accent: true })
      .map((face) => face.file)
      .filter((file) => /^pacifico-latin-[0-9]/.test(file));
    // Pacifico has only an upright 400: it stands in for every weight.
    expect(accent).toEqual(["pacifico-latin-400-normal.woff2"]);
    // A static font with more: headings' upright weights and the body's bold and italics.
    const lato = fontFacesFor(
      { ...theme, fonts: { ...theme.fonts, accent: { family: "Lato", fallback: "sans-serif" } } },
      undefined,
      { accent: true },
    )
      .map((face) => face.file)
      .filter((file) => /^lato-latin-[0-9]/.test(file));
    expect(lato.sort()).toEqual([
      "lato-latin-400-italic.woff2",
      "lato-latin-400-normal.woff2",
      "lato-latin-700-italic.woff2",
      "lato-latin-700-normal.woff2",
    ]);
  });

  it("knows a site uses its accent font from its classes, on any device (3.22)", () => {
    expect(usesAccentFont(["text-h2!", "font-accent!"])).toBe(true);
    expect(usesAccentFont(["md:max-lg:font-accent!"])).toBe(true);
    // The person's own code may use the class too.
    expect(usesAccentFont(["font-accent"])).toBe(true);
    expect(usesAccentFont(["!font-accent"])).toBe(true);
    expect(usesAccentFont(["var(--font-accent)"])).toBe(true);
    expect(usesAccentFont(["font-heading!", "font-sans", "font-accent-x", "x-font-accent"])).toBe(
      false,
    );
    expect(usesAccentFont([])).toBe(false);
  });

  it("gives no file for a family the catalogue doesn't have", () => {
    expect(fontFacesFor(withFonts("Comic Neue", "Comic Neue"))).toEqual([]);
  });

  it("gives the files of a downloaded family it is given, besides the catalogue's", () => {
    const comic: CatalogueFont = {
      id: "comic-neue",
      family: "Comic Neue",
      category: "handwriting",
      fallback: "sans-serif",
      licence: "OFL-1.1",
      variable: false,
      weights: [300, 400, 700],
      styles: ["normal", "italic"],
      package: "@fontsource/comic-neue",
      version: "5.2.5",
      files: [400, 700].map((weight) => ({
        file: `comic-neue-latin-${weight}-normal.woff2`,
        subset: "latin" as const,
        style: "normal" as const,
        weight,
        unicodeRange: "U+0000-00FF",
        bytes: 10,
        sha256: "0".repeat(64),
      })),
    };
    const theme = withFonts("Comic Neue", "Inter");

    expect(fontFacesFor(theme, [comic]).map((face) => face.file)).toEqual([
      "comic-neue-latin-700-normal.woff2",
    ]);
    expect(files(theme)).not.toContain("comic-neue-latin-700-normal.woff2");
  });
});
