import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DEFAULT_THEME, type SiteSnapshot, type ThemeTokens } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { FONT_CATALOGUE, fontFacesFor } from "@webforge/themes";
import { beforeAll, describe, expect, it } from "vitest";
import { BuildError, buildSite } from "../src/build.js";
import { loadNodeResources } from "../src/node-resources.js";
import type { PipelineResources } from "../src/resources.js";

// The fonts a site exports (2.2): only the faces its theme uses, each exactly the file the
// catalogue lists, from the packages this package depends on.

let resources: PipelineResources;

beforeAll(async () => {
  resources = await loadNodeResources();
}, 60_000);

function siteWithFonts(heading: string, body: string): SiteSnapshot {
  const theme: ThemeTokens = {
    ...DEFAULT_THEME,
    fonts: {
      heading: { family: heading, fallback: "serif" },
      body: { family: body, fallback: "sans-serif" },
    },
  };
  return {
    name: "Test",
    language: "en",
    theme,
    layout: { header: [], footer: [] },
    pages: [
      { id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } },
    ],
    media: [],
  } as SiteSnapshot;
}

const fontFiles = (files: ReadonlyMap<string, Uint8Array>) =>
  [...files.keys()].filter((path) => path.startsWith("assets/fonts/")).sort();

describe("exported fonts (2.2)", () => {
  it("exports only the faces of the theme's heading and body fonts", async () => {
    const site = siteWithFonts("Playfair Display", "Poppins");
    const built = await buildSite(site, siteLibrary, resources);

    expect(fontFiles(built.files)).toEqual(
      fontFacesFor(site.theme)
        .map((face) => `assets/fonts/${face.file}`)
        .sort(),
    );
    const files = fontFiles(built.files).join(" ");
    // Playfair Display is variable: upright only, for headings. Poppins is static: the body's
    // weights, bold and italics.
    expect(files).toContain("playfair-display-latin-wght-normal.woff2");
    expect(files).not.toContain("playfair-display-latin-wght-italic.woff2");
    expect(files).toContain("poppins-latin-400-normal.woff2");
    expect(files).toContain("poppins-latin-700-italic.woff2");
    expect(files).not.toContain("poppins-latin-300-normal.woff2");
    expect(files).not.toContain("inter");
  });

  it("exports no font for a family the catalogue doesn't have: the site shows its fallback", async () => {
    const built = await buildSite(
      siteWithFonts("Comic Neue", "Comic Neue"),
      siteLibrary,
      resources,
    );

    expect(fontFiles(built.files)).toEqual([]);
  });

  it("refuses to export a font file that is missing or isn't the catalogue's", async () => {
    const site = siteWithFonts("Inter", "Inter");
    const damaged = { ...resources, readFont: async () => new Uint8Array([1, 2, 3]) };
    const missing = { ...resources, readFont: async () => undefined };

    for (const broken of [damaged, missing]) {
      const failure = await buildSite(site, siteLibrary, broken).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(BuildError);
      expect(failure).toMatchObject({ code: "missing-font" });
    }
  });
});

describe("the bundled font packages", () => {
  const require = createRequire(import.meta.url);
  const { dependencies } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { dependencies: Record<string, string> };

  it("are the catalogue's packages, each at its version, and nothing else of Fontsource's", () => {
    const fontsource = Object.keys(dependencies).filter((name) => name.startsWith("@fontsource"));

    expect(fontsource.sort()).toEqual(FONT_CATALOGUE.map((font) => font.package).sort());
    for (const font of FONT_CATALOGUE) {
      expect(dependencies[font.package], font.package).toBe(font.version);
    }
  });

  it("hold every file the catalogue lists, byte for byte", () => {
    for (const font of FONT_CATALOGUE) {
      for (const file of font.files) {
        const data = readFileSync(require.resolve(`${font.package}/files/${file.file}`));
        expect(data.byteLength, file.file).toBe(file.bytes);
        expect(createHash("sha256").update(data).digest("hex"), file.file).toBe(file.sha256);
      }
    }
  });
});
