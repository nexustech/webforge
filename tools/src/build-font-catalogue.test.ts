import { createHash } from "node:crypto";
import { FONTSOURCE_API, type FontMetadata, PACKAGE_FILES } from "@webforge/themes/font-plan";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCatalogue,
  CATALOGUE_FILE,
  FAMILIES,
  type Fetch,
  PAIRINGS,
  pairingProblems,
  writeCatalogue,
} from "./build-font-catalogue.js";

afterEach(() => vi.restoreAllMocks());

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

describe("writeCatalogue (2.2)", () => {
  const get: Fetch = (url) => {
    if (url === `${FONTSOURCE_API}/fonts/poppins`) return Promise.resolve(Response.json(poppins));
    if (url.endsWith("/latest")) return Promise.resolve(Response.json({ version: "5.2.7" }));
    return Promise.resolve(new Response(new Uint8Array([1, 2, 3, 4])));
  };

  it("writes the catalogue into the themes package, formatted", async () => {
    const write = vi.fn();
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await writeCatalogue(get, write, [{ id: "poppins" }], [])).toBe(true);

    expect(write).toHaveBeenCalledOnce();
    const [target, text] = write.mock.calls[0] ?? [];
    expect(target).toEqual(CATALOGUE_FILE);
    expect(String(CATALOGUE_FILE)).toMatch(/packages\/themes\/src\/fonts\/catalogue\.json$/);
    expect(JSON.parse(String(text))).toMatchObject({ families: [{ id: "poppins" }] });
    expect(String(text).endsWith("}\n")).toBe(true);
  });

  it("writes nothing when the catalogue has a problem, and says what it is", async () => {
    const write = vi.fn();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pairings = [{ id: "odd", heading: "poppins", body: "lato" }];

    expect(await writeCatalogue(get, write, [{ id: "poppins" }], pairings)).toBe(false);

    expect(write).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("Pairing odd: no family lato in the catalogue");
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
