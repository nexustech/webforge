import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  allowedLicence,
  buildCatalogue,
  FAMILIES,
  type Fetch,
  FONT_LICENCES,
  FONTSOURCE_API,
  type FontMetadata,
  fontMetadataSchema,
  PACKAGE_FILES,
  PAIRINGS,
  pairingProblems,
  planFamily,
} from "./build-font-catalogue.js";

const inter: FontMetadata = {
  id: "inter",
  family: "Inter",
  subsets: ["cyrillic", "latin", "latin-ext", "vietnamese"],
  weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  styles: ["italic", "normal"],
  variable: true,
  category: "sans-serif",
  license: "OFL-1.1",
};

const poppins: FontMetadata = {
  ...inter,
  id: "poppins",
  family: "Poppins",
  variable: false,
};

describe("the font catalogue's licence filter (C1)", () => {
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
  });
});

describe("buildCatalogue (2.2)", () => {
  const FILE = new Uint8Array([1, 2, 3, 4]);
  /** Fontsource, the registry and jsDelivr for Inter (variable) and Poppins (static), offline. */
  const fakeFetch = (licence = "OFL-1.1"): Fetch => {
    const json = (value: unknown) => Promise.resolve(Response.json(value));
    return (url) => {
      if (url === `${FONTSOURCE_API}/fonts/inter`) return json({ ...inter, license: licence });
      if (url === `${FONTSOURCE_API}/fonts/poppins`) return json(poppins);
      if (url === `${FONTSOURCE_API}/variable/inter`) {
        return json({ axes: { wght: { min: "100", max: "900", default: "400" } } });
      }
      if (url.endsWith("/latest")) return json({ version: "5.3.0" });
      if (url.startsWith(`${PACKAGE_FILES}/@fontsource`)) {
        return Promise.resolve(new Response(FILE));
      }
      return Promise.resolve(new Response("Not found", { status: 404, statusText: "Not Found" }));
    };
  };
  const families = [{ id: "inter" }, { id: "poppins" }];
  const pairings = [{ id: "simple", heading: "inter", body: "poppins" }];

  it("lists each family with its pinned package and every file's size and SHA-256", async () => {
    const { catalogue, bytes, problems } = await buildCatalogue(fakeFetch(), families, pairings);

    expect(problems).toEqual([]);
    const [variable, fixed] = catalogue.families;
    expect(variable).toMatchObject({ package: "@fontsource-variable/inter", version: "5.3.0" });
    expect(fixed?.package).toBe("@fontsource/poppins");
    expect(variable?.files[0]).toMatchObject({
      file: "inter-latin-wght-italic.woff2",
      weight: [100, 900],
      bytes: 4,
      sha256: createHash("sha256").update(FILE).digest("hex"),
    });
    const files = catalogue.families.flatMap((family) => family.files).length;
    expect(bytes).toBe(files * FILE.byteLength);
    expect(catalogue.source).toEqual({ api: FONTSOURCE_API, files: PACKAGE_FILES });
  });

  it("reports a pairing of an unknown family, and fonts over the budget", async () => {
    const { problems } = await buildCatalogue(
      fakeFetch(),
      families,
      [{ id: "odd", heading: "inter", body: "lato" }],
      10,
    );

    expect(problems).toEqual([
      "Pairing odd: no family lato in the catalogue",
      expect.stringMatching(/^The bundled fonts take \d+ bytes, over the budget of 10$/),
    ]);
  });

  it("refuses a family whose licence isn't allowed, and a request that fails", async () => {
    await expect(buildCatalogue(fakeFetch("CC0-1.0"), families, pairings)).rejects.toThrow(
      "Inter: licence CC0-1.0 is not allowed",
    );
    await expect(buildCatalogue(fakeFetch(), [{ id: "lato" }], [])).rejects.toThrow(
      `${FONTSOURCE_API}/fonts/lato: 404 Not Found`,
    );
  });
});

describe("the selection", () => {
  it("has about 50 families, each once", () => {
    const ids = FAMILIES.map((family) => family.id);
    expect(ids.length).toBeGreaterThanOrEqual(45);
    expect(ids.length).toBeLessThanOrEqual(55);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 12–15 pairings of families it bundles", () => {
    expect(PAIRINGS.length).toBeGreaterThanOrEqual(12);
    expect(PAIRINGS.length).toBeLessThanOrEqual(15);
    expect(pairingProblems(PAIRINGS, FAMILIES)).toEqual([]);
  });

  it("names a pairing's unknown family, and a pairing listed twice", () => {
    const pairings = [
      { id: "a", heading: "inter", body: "comic-sans" },
      { id: "a", heading: "inter", body: "inter" },
    ];

    expect(pairingProblems(pairings, [{ id: "inter" }])).toEqual([
      "Pairing a: no family comic-sans in the catalogue",
      "Pairing a: listed twice",
    ]);
  });
});
