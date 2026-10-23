import { describe, expect, it } from "vitest";
import {
  allowedLicence,
  FONT_LICENCES,
  type FontMetadata,
  fontCategory,
  fontMetadataSchema,
  fontPackage,
  planFamily,
} from "./plan.js";

const inter: FontMetadata = {
  id: "inter",
  family: "Inter",
  subsets: ["cyrillic", "latin", "latin-ext", "vietnamese"],
  weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  styles: ["italic", "normal"],
  variable: true,
  category: "sans-serif",
  license: "OFL-1.1",
  unicodeRange: {
    cyrillic: "U+0301,U+0400-045F",
    latin: "U+0000-00FF,U+0131",
    "latin-ext": "U+0100-02BA",
    vietnamese: "U+0102-0103",
  },
};

const poppins: FontMetadata = {
  ...inter,
  id: "poppins",
  family: "Poppins",
  variable: false,
};

describe("the licence filter, for bundled and downloaded fonts (C1)", () => {
  it("allows only OFL-1.1, Apache-2.0 and UFL-1.0", () => {
    expect(FONT_LICENCES).toEqual(["OFL-1.1", "Apache-2.0", "UFL-1.0"]);
    expect(["OFL-1.1", "Apache-2.0", "UFL-1.0"].map(allowedLicence)).toEqual([...FONT_LICENCES]);
  });

  it.each(["CC0-1.0", "mit", "Unlicense", "GPL-3.0", "ofl-1.1", "OFL-1.0", ""])(
    "refuses a font licensed %j",
    (license) => {
      expect(allowedLicence(license)).toBeUndefined();
      expect(() => planFamily({ ...inter, license }, {}, "5.3.0", [100, 900])).toThrow(
        `Inter: licence ${license} is not allowed`,
      );
    },
  );
});

describe("planFamily (2.2)", () => {
  it("bundles a variable font's Latin and Latin Extended weight axis, upright and italic", () => {
    const planned = planFamily(inter, {}, "5.3.0", [100, 900]);

    expect(planned).toMatchObject({
      family: "Inter",
      fallback: "sans-serif",
      licence: "OFL-1.1",
      package: "@fontsource-variable/inter",
      version: "5.3.0",
    });
    expect(planned.files.map((file) => file.file)).toEqual([
      "inter-latin-wght-italic.woff2",
      "inter-latin-wght-normal.woff2",
      "inter-latin-ext-wght-italic.woff2",
      "inter-latin-ext-wght-normal.woff2",
    ]);
    expect(planned.files[0]?.weight).toEqual([100, 900]);
  });

  it("bundles a static font's usual weights, and italics at 400 and 700 only", () => {
    const planned = planFamily({ ...poppins, subsets: ["latin"] }, {}, "5.2.7");

    expect(planned.package).toBe("@fontsource/poppins");
    expect(planned.files.map((file) => [file.style, file.weight])).toEqual([
      ["italic", 400],
      ["italic", 700],
      ["normal", 300],
      ["normal", 400],
      ["normal", 500],
      ["normal", 600],
      ["normal", 700],
    ]);
  });

  it("keeps a display font's one weight, with the fallback chosen for it", () => {
    const display: FontMetadata = {
      ...poppins,
      id: "abril-fatface",
      family: "Abril Fatface",
      weights: [400],
      styles: ["normal"],
      category: "display",
    };
    const thin = { ...display, weights: [100] };

    expect(planFamily(display, { fallback: "serif" }, "5.2.7").fallback).toBe("serif");
    expect(planFamily(thin, { fallback: "serif" }, "5.2.7").files.map((file) => file.file)).toEqual(
      ["abril-fatface-latin-100-normal.woff2", "abril-fatface-latin-ext-100-normal.woff2"],
    );
    expect(() => planFamily(display, {}, "5.2.7")).toThrow(
      "Abril Fatface: a display font needs a fallback",
    );
  });

  it("gives each file its subset's characters, and lists a font where the selection says", () => {
    const planned = planFamily(inter, { category: "display" }, "5.3.0", [100, 900]);

    expect(planned.category).toBe("display");
    expect(planned.files.map((file) => [file.subset, file.unicodeRange])).toEqual([
      ["latin", "U+0000-00FF,U+0131"],
      ["latin", "U+0000-00FF,U+0131"],
      ["latin-ext", "U+0100-02BA"],
      ["latin-ext", "U+0100-02BA"],
    ]);
    expect(() =>
      planFamily({ ...inter, unicodeRange: { latin: "U+0000-00FF" } }, {}, "5.3.0", [100, 900]),
    ).toThrow("Inter: no character range for its latin-ext subset");
    expect(() => planFamily({ ...inter, category: "icons" }, {}, "5.3.0", [100, 900])).toThrow(
      "Inter: category icons is not one the picker lists",
    );
  });

  it("refuses a font without Latin, and a variable font without a weight axis", () => {
    expect(() => planFamily({ ...inter, subsets: ["cyrillic"] }, {}, "5.3.0", [100, 900])).toThrow(
      "Inter: has no Latin subset",
    );
    expect(() => planFamily(inter, {}, "5.3.0")).toThrow(
      "Inter: a variable font without a weight axis",
    );
  });

  it("reads only metadata it can use", () => {
    expect(fontMetadataSchema.safeParse({ ...inter, styles: ["oblique"] }).success).toBe(false);
    expect(fontMetadataSchema.safeParse({ ...inter, weights: [] }).success).toBe(false);
    expect(fontMetadataSchema.safeParse({ ...inter, id: "../x" }).success).toBe(false);
    // A range that could carry CSS.
    expect(
      fontMetadataSchema.safeParse({ ...inter, unicodeRange: { latin: "U+0000; } x {" } }).success,
    ).toBe(false);
  });
});

describe("fontCategory and fontPackage", () => {
  it("lists the picker's categories only, and names the variable package of a variable font", () => {
    expect(fontCategory("handwriting")).toBe("handwriting");
    expect(fontCategory("icons")).toBeUndefined();
    expect(fontPackage("inter", true)).toBe("@fontsource-variable/inter");
    expect(fontPackage("lato", false)).toBe("@fontsource/lato");
  });
});
