import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_THEME } from "@webforge/model";
import { tempDirFactory } from "@webforge/test-utils";
import { fontFacesFor } from "@webforge/themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFontReader, createFontResponder } from "./fonts.js";

const tempDir = tempDirFactory("webforge-fonts-");
const bytes = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 1, 2, 3]);
const face = {
  file: "inter-latin-wght-normal.woff2",
  bytes: bytes.byteLength,
  sha256: createHash("sha256").update(bytes).digest("hex"),
};

afterEach(() => vi.restoreAllMocks());

describe("createFontReader (2.2)", () => {
  it("reads a font file that is exactly the catalogue's, once", () => {
    const dir = tempDir();
    writeFileSync(join(dir, face.file), bytes);
    const reader = createFontReader(dir);

    expect(reader.read(face)).toEqual(bytes);
    // Changed on disk after it was checked: the checked bytes stay.
    writeFileSync(join(dir, face.file), new Uint8Array([9]));
    expect(reader.read(face)).toEqual(bytes);
  });

  it("reads a file again when it is asked for with another hash, as after a newer download", () => {
    const dir = tempDir();
    writeFileSync(join(dir, face.file), bytes);
    const reader = createFontReader(dir);
    expect(reader.read(face)).toEqual(bytes);

    const newer = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 4, 5]);
    writeFileSync(join(dir, face.file), newer);
    const newerFace = {
      file: face.file,
      bytes: newer.byteLength,
      sha256: createHash("sha256").update(newer).digest("hex"),
    };
    expect(reader.read(newerFace)).toEqual(newer);
  });

  it("refuses a missing, damaged or swapped file, logging only its name", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dir = tempDir();
    const reader = createFontReader(dir);
    expect(reader.read(face)).toBeUndefined();

    writeFileSync(join(dir, face.file), new Uint8Array([...bytes].reverse()));
    expect(reader.read(face)).toBeUndefined();
    writeFileSync(join(dir, face.file), new Uint8Array([...bytes, 0]));
    expect(reader.read(face)).toBeUndefined();

    expect(log).toHaveBeenCalledWith(`Webforge refused a damaged font file (${face.file})`);
    expect(JSON.stringify(log.mock.calls)).not.toContain(dir);
  });
});

describe("createFontResponder (2.2)", () => {
  const [inter] = fontFacesFor(DEFAULT_THEME);
  const reader = {
    read: vi.fn((asked: { file: string }) => (asked.file === inter?.file ? bytes : undefined)),
  };
  const respond = createFontResponder(reader);

  it("serves a catalogue font for the canvas, to any origin", async () => {
    const response = respond(`webforge-font://fonts/${inter?.file}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("font/woff2");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(reader.read).toHaveBeenCalledWith(expect.objectContaining({ sha256: inter?.sha256 }));
  });

  it("serves nothing but the catalogue's files", () => {
    for (const url of [
      "webforge-font://fonts/notes.txt",
      "webforge-font://fonts/../site.wforge",
      "webforge-font://../../etc",
      "webforge-font://fonts/../../etc/passwd",
      "webforge-font://fonts/%2e%2e%2fsite.wforge",
      "webforge-font://fonts/sub/inter-latin-wght-normal.woff2",
      `webforge-font://fonts/${inter?.file}?x=1`,
      "webforge-font://fonts/unknown-latin-400-normal.woff2",
      "webforge-font://other/inter-latin-wght-normal.woff2",
      // A catalogue file the reader can't vouch for.
      "webforge-font://fonts/lato-latin-400-normal.woff2",
    ]) {
      expect(respond(url).status, url).toBe(404);
    }
  });

  it("serves a downloaded file its lookup knows, and only that one", async () => {
    const downloaded = {
      file: "comic-neue-latin-400-normal.woff2",
      bytes: 7,
      sha256: "a".repeat(64),
    };
    const served = createFontResponder(
      { read: (asked) => (asked.sha256 === downloaded.sha256 ? bytes : undefined) },
      (name) => (name === downloaded.file ? downloaded : undefined),
    );

    const response = served(`webforge-font://fonts/${downloaded.file}`);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(served("webforge-font://fonts/comic-neue-latin-700-normal.woff2").status).toBe(404);
  });
});
