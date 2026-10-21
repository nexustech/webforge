import { heroPhoto } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { sniffMedia } from "./media-files.js";

/** The start of a PNG: signature and IHDR chunk, enough for its size. */
function pngHeader(width: number, height: number, chunk = "IHDR"): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  bytes.set(
    [...chunk].map((char) => char.charCodeAt(0)),
    12,
  );
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

const ascii = (text: string) => new TextEncoder().encode(text);

describe("sniffMedia", () => {
  it("reads a JPEG's size from its frame header", () => {
    expect(sniffMedia(heroPhoto())).toEqual({
      kind: "image",
      mimeType: "image/jpeg",
      width: 1600,
      height: 1000,
    });
  });

  it("skips fill bytes and other segments before the frame header", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xff, 0xc2, 0x00, 0x11, 0x08, 0x00,
      0x20, 0x00, 0x40, 0x03,
    ]);

    expect(sniffMedia(jpeg)).toEqual({
      kind: "image",
      mimeType: "image/jpeg",
      width: 64,
      height: 32,
    });
  });

  it("reads a PNG's size from its IHDR chunk", () => {
    expect(sniffMedia(pngHeader(800, 600))).toEqual({
      kind: "image",
      mimeType: "image/png",
      width: 800,
      height: 600,
    });
  });

  it("recognises a PDF", () => {
    expect(sniffMedia(ascii("%PDF-1.7\n…"))).toEqual({ kind: "file", mimeType: "application/pdf" });
  });

  it("rejects other files, whatever their name, and images without a size", () => {
    expect(sniffMedia(ascii("GIF89a"))).toBeUndefined();
    expect(sniffMedia(ascii("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeUndefined();
    expect(sniffMedia(new Uint8Array())).toBeUndefined();
    expect(sniffMedia(pngHeader(0, 600))).toBeUndefined();
    expect(sniffMedia(pngHeader(800, 600, "tEXt"))).toBeUndefined();
    // A JPEG cut off before its frame header, and one whose scan starts without one.
    expect(sniffMedia(heroPhoto().subarray(0, 20))).toBeUndefined();
    expect(
      sniffMedia(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 4, 0, 0, 0, 0, 0, 0, 0])),
    ).toBeUndefined();
    expect(
      sniffMedia(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0x12, 0, 0, 0, 0, 0])),
    ).toBeUndefined();
  });
});
