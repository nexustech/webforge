import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONT_CATALOGUE, type FontFace } from "@webforge/themes";

/** The scheme the canvas loads fonts through (2.2): `webforge-font://fonts/<file>`. */
export const FONT_SCHEME = "webforge-font";

/** What a font file must be: the catalogue's size and SHA-256 for it. */
type Expected = Pick<FontFace, "file" | "bytes" | "sha256">;

/** Every file of the catalogue, by name. */
const CATALOGUE_FILES: ReadonlyMap<string, Expected> = new Map(
  FONT_CATALOGUE.flatMap((font) => font.files.map((file) => [file.file, file] as const)),
);

/** Reads the installer's font files (2.2). */
export type FontReader = {
  /** The bytes of `face`'s file, or `undefined` if it is missing or not exactly the catalogue's. */
  read(face: Expected): Uint8Array<ArrayBuffer> | undefined;
};

/**
 * Reads the font files the installer puts in `dir` (`resources/fonts`, outside `app.asar`). Each is
 * read once, and only if it is exactly the file the catalogue lists: the asar integrity check
 * doesn't cover files beside it, so a damaged or swapped font never reaches the canvas or a site.
 */
export function createFontReader(dir: string): FontReader {
  const verified = new Map<string, Uint8Array<ArrayBuffer>>();
  return {
    read(face) {
      const known = verified.get(face.file);
      if (known !== undefined) return known;
      let data: Uint8Array<ArrayBuffer>;
      try {
        data = new Uint8Array(readFileSync(join(dir, face.file)));
      } catch {
        return undefined;
      }
      const sha256 = createHash("sha256").update(data).digest("hex");
      if (data.byteLength !== face.bytes || sha256 !== face.sha256) {
        // The file's name only: never a path.
        console.error(`Webforge refused a damaged font file (${face.file})`);
        return undefined;
      }
      verified.set(face.file, data);
      return data;
    },
  };
}

/**
 * The only URLs the scheme answers: a catalogue file's name, as the catalogue's schema allows it.
 * The raw URL is matched, never a parsed one: parsing would resolve `..` before any check saw it.
 */
const FONT_URL = /^webforge-font:\/\/fonts\/([a-z0-9-]+\.woff2)$/;

/**
 * Answers `webforge-font://fonts/<file>` for the canvas (2.2), as `webforge-media:` answers Media
 * images: never by path, only a file the catalogue lists by name, and only bytes the reader has
 * checked against it. Fonts load in CORS mode, so the answer allows any origin: the canvas's page
 * is a `file:` one, whose origin is `null`, and the fonts are the installer's own, which every site
 * may use.
 */
export function createFontResponder(reader: FontReader): (url: string) => Response {
  return (url) => {
    const name = FONT_URL.exec(url)?.[1];
    const expected = name === undefined ? undefined : CATALOGUE_FILES.get(name);
    const data = expected === undefined ? undefined : reader.read(expected);
    if (data === undefined) {
      return new Response(null, { status: 404 });
    }
    return new Response(data, {
      headers: {
        "content-type": "font/woff2",
        "access-control-allow-origin": "*",
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  };
}
