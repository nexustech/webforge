import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONT_CATALOGUE, type FontFace } from "@webforge/themes";
import { log } from "./log.js";

/** The scheme the canvas loads fonts through (2.2): `webforge-font://fonts/<file>`. */
export const FONT_SCHEME = "webforge-font";

/** What a font file must be: the size and SHA-256 the catalogue (or a download) lists for it. */
export type ExpectedFont = Pick<FontFace, "file" | "bytes" | "sha256">;

/** Every file of the catalogue, by name. */
const CATALOGUE_FILES: ReadonlyMap<string, ExpectedFont> = new Map(
  FONT_CATALOGUE.flatMap((font) => font.files.map((file) => [file.file, file] as const)),
);

/** What the installer's file `name` must be, or undefined for a file the catalogue doesn't list. */
export function catalogueFile(name: string): ExpectedFont | undefined {
  return CATALOGUE_FILES.get(name);
}

/** Reads font files (2.2): the installer's, or the ones downloaded. */
export type FontReader = {
  /** The bytes of `face`'s file, or `undefined` if it is missing or not exactly the catalogue's. */
  read(face: ExpectedFont): Uint8Array<ArrayBuffer> | undefined;
};

/**
 * Reads the font files in `dir`: the installer's (`resources/fonts`, outside `app.asar`), or the
 * downloaded ones. Each is read once, and only if it is exactly the file the catalogue (or its
 * download) lists: the asar integrity check doesn't cover files beside it, so a damaged or swapped
 * font never reaches the canvas or a site. Checked bytes are kept by name and hash, so a file
 * downloaded again in a newer version is read again.
 */
export function createFontReader(dir: string): FontReader {
  const verified = new Map<string, Uint8Array<ArrayBuffer>>();
  return {
    read(face) {
      const key = `${face.file}:${face.sha256}`;
      const known = verified.get(key);
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
        log.error("Webforge refused a damaged font file", { file: face.file });
        return undefined;
      }
      verified.set(key, data);
      return data;
    },
  };
}

/**
 * The only URLs the scheme answers: a font file's name, as the catalogue's schema allows it.
 * The raw URL is matched, never a parsed one: parsing would resolve `..` before any check saw it.
 */
const FONT_URL = /^webforge-font:\/\/fonts\/([a-z0-9-]+\.woff2)$/;

/**
 * Answers `webforge-font://fonts/<file>` for the canvas (2.2), as `webforge-media:` answers Media
 * images: never by path, only a file `lookup` knows by name (the catalogue's, or a downloaded
 * one's), and only bytes the reader has checked against it. Fonts load in CORS mode, so the answer
 * allows any origin: the canvas's page is a `file:` one, whose origin is `null`, and the fonts are
 * the app's own, which every site may use.
 */
export function createFontResponder(
  reader: FontReader,
  lookup: (name: string) => ExpectedFont | undefined = catalogueFile,
): (url: string) => Response {
  return (url) => {
    const name = FONT_URL.exec(url)?.[1];
    const expected = name === undefined ? undefined : lookup(name);
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
