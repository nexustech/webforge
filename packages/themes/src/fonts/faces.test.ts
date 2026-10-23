import { DEFAULT_THEME, type ThemeTokens } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { fontFacesFor } from "./faces.js";

const withFonts = (heading: string, body: string): ThemeTokens => ({
  ...DEFAULT_THEME,
  fonts: {
    heading: { family: heading, fallback: "sans-serif" },
    body: { family: body, fallback: "sans-serif" },
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

  it("gives no file for a family the catalogue doesn't have", () => {
    expect(fontFacesFor(withFonts("Comic Neue", "Comic Neue"))).toEqual([]);
  });
});
