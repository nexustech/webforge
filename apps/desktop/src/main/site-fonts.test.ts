import { DEFAULT_THEME, type ThemeTokens } from "@webforge/model";
import { type CatalogueFont, FONT_CATALOGUE, fontFacesFor } from "@webforge/themes";
import { describe, expect, it, vi } from "vitest";
import { ipcContract } from "../shared/ipc-contract.js";
import type { FontLibrary } from "./font-library.js";
import type { ExpectedFont } from "./fonts.js";
import { createSiteFonts } from "./site-fonts.js";

/** A family downloaded on this computer: Comic Neue, regular and bold. */
const comic: CatalogueFont = {
  id: "comic-neue",
  family: "Comic Neue",
  category: "handwriting",
  fallback: "sans-serif",
  licence: "OFL-1.1",
  variable: false,
  weights: [400, 700],
  styles: ["normal"],
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

/** Another downloaded family, which the themes below don't use. */
const unused: CatalogueFont = { ...comic, id: "other", family: "Other" };

/** `DEFAULT_THEME` with its headings in `heading`. */
const withHeadings = (heading: string): ThemeTokens => ({
  ...DEFAULT_THEME,
  fonts: { ...DEFAULT_THEME.fonts, heading: { family: heading, fallback: "sans-serif" } },
});

/** Bytes for each file, but for the ones named `missing`. */
const fileReader = (missing: Set<string>) =>
  vi.fn((face: ExpectedFont) =>
    missing.has(face.file) ? undefined : new Uint8Array(new TextEncoder().encode(face.file)),
  );

function setUp() {
  const missing = new Set<string>();
  const bundled = fileReader(missing);
  const downloadedRead = fileReader(missing);
  const library: FontLibrary = {
    list: vi.fn(async () => []),
    browse: vi.fn(),
    download: vi.fn(),
    downloaded: vi.fn(async () => [comic, unused]),
    file: (name) => comic.files.find((file) => file.file === name),
    reader: { read: downloadedRead },
  };
  const makeLibrary = vi.fn(() => library);
  const fonts = createSiteFonts({ bundled: { read: bundled }, library: makeLibrary });
  return { fonts, missing, bundled, downloadedRead, makeLibrary };
}

describe("createSiteFonts (2.2, A12)", () => {
  it("reads every face a theme uses, the accent font's too, from the installer's fonts", async () => {
    const { fonts, downloadedRead } = setUp();
    const faces = fontFacesFor(DEFAULT_THEME, FONT_CATALOGUE, { accent: true });

    const read = await fonts.fontsOf(DEFAULT_THEME);

    expect(read.fonts.map((font) => font.file)).toEqual(faces.map((face) => face.file));
    expect(read.families).toEqual([]);
    expect(downloadedRead).not.toHaveBeenCalled();
  });

  it("reads a downloaded family's files from the downloads, with that family only", async () => {
    const { fonts, bundled } = setUp();
    const theme = withHeadings("Comic Neue");

    const read = await fonts.fontsOf(theme);

    expect(read.families).toEqual([comic]);
    expect(read.fonts.map((font) => font.file)).toContain("comic-neue-latin-700-normal.woff2");
    expect(bundled).not.toHaveBeenCalledWith(
      expect.objectContaining({ file: "comic-neue-latin-700-normal.woff2" }),
    );
    expect(await fonts.downloadedFamiliesOf(theme)).toEqual([comic]);
  });

  it("leaves out a file it can't read", async () => {
    const { fonts, missing } = setUp();
    missing.add("comic-neue-latin-700-normal.woff2");

    const read = await fonts.fontsOf(withHeadings("Comic Neue"));

    expect(read.fonts.map((font) => font.file)).not.toContain("comic-neue-latin-700-normal.woff2");
    expect(read.fonts.length).toBeGreaterThan(0);
  });

  it("reads the preview's fonts again only when the theme's fonts change", async () => {
    const { fonts, bundled } = setUp();
    const first = await fonts.previewFontsOf(DEFAULT_THEME);
    const reads = bundled.mock.calls.length;

    expect(await fonts.previewFontsOf({ ...DEFAULT_THEME })).toBe(first);
    expect(bundled).toHaveBeenCalledTimes(reads);

    const changed = await fonts.previewFontsOf(withHeadings("Comic Neue"));
    expect(changed.families).toEqual([comic]);
  });

  it("reads the preview's fonts again while a face is missing, as while it downloads", async () => {
    const { fonts, missing, downloadedRead } = setUp();
    const theme = withHeadings("Comic Neue");
    missing.add("comic-neue-latin-700-normal.woff2");

    const partial = await fonts.previewFontsOf(theme);
    missing.clear();
    const whole = await fonts.previewFontsOf(theme);

    expect(whole.fonts.length).toBe(partial.fonts.length + 1);
    const reads = downloadedRead.mock.calls.length;
    expect(await fonts.previewFontsOf(theme)).toBe(await fonts.previewFontsOf(theme));
    expect(downloadedRead).toHaveBeenCalledTimes(reads);
  });

  it("makes the downloads' library when first needed, and handles the fonts calls", () => {
    const { fonts, makeLibrary } = setUp();
    expect(makeLibrary).not.toHaveBeenCalled();
    const handle = vi.fn();

    fonts.register({ handle }, () => true);

    expect(makeLibrary).toHaveBeenCalledOnce();
    expect(handle).toHaveBeenCalledWith(ipcContract.listFonts.channel, expect.any(Function));
  });
});
