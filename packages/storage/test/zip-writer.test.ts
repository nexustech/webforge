import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEST_DIR_REMOVAL } from "@webforge/test-utils/vitest";
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import { fitsInZip, writeZipAtomically, ZIP_MAX_ENTRIES } from "../src/zip-writer.js";

// The ZIP writer the site's ZIP and the export's share (#987).

let dir: string | undefined;
afterEach(() => {
  if (dir !== undefined) rmSync(dir, TEST_DIR_REMOVAL);
  dir = undefined;
});

/** A folder of its own, emptied after the test. */
const folder = () => {
  dir = mkdtempSync(join(tmpdir(), "zip-writer-"));
  return dir;
};

const bytes = (text: string) => new TextEncoder().encode(text);
const ENTRIES: [string, Uint8Array][] = [
  ["index.html", bytes("<p>Rosa's Bakery</p>".repeat(50))],
  ["media/photo.jpg", bytes("not really a jpeg")],
];
const STORED = { stored: (path: string) => path.startsWith("media/") };

describe("fitsInZip (#987)", () => {
  it("counts the entries, and each one's bytes with its headers and path", () => {
    expect(fitsInZip(ENTRIES, 10_000)).toBe(true);
    // Each entry's data, 76 bytes of headers, and its path twice.
    const exact = ENTRIES.reduce(
      (sum, [path, data]) => sum + data.byteLength + 76 + 2 * path.length,
      0,
    );
    expect(fitsInZip(ENTRIES, exact)).toBe(true);
    expect(fitsInZip(ENTRIES, exact - 1)).toBe(false);
  });

  it("refuses more than 65,535 entries, which needs ZIP64", () => {
    const empty = new Uint8Array();
    const many = (count: number) =>
      Array.from({ length: count }, (_, at): [string, Uint8Array] => [`f${at}`, empty]);
    expect(fitsInZip(many(ZIP_MAX_ENTRIES), Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(fitsInZip(many(ZIP_MAX_ENTRIES + 1), Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe("writeZipAtomically (#987)", () => {
  it("writes each entry, stored or deflated, dated the same, and leaves nothing beside it", async () => {
    const destination = join(folder(), "site.zip");
    await writeZipAtomically(ENTRIES, destination, STORED);

    const unzipped = unzipSync(readFileSync(destination));
    expect(Object.keys(unzipped)).toEqual(["index.html", "media/photo.jpg"]);
    expect(unzipped["index.html"]).toEqual(ENTRIES[0]?.[1]);
    expect(readdirSync(dir ?? "")).toEqual(["site.zip"]);
    // The same entries make the same ZIP.
    const again = join(dir ?? "", "again.zip");
    await writeZipAtomically(ENTRIES, again, STORED);
    expect(readFileSync(again)).toEqual(readFileSync(destination));
    // The page is deflated, smaller than it was; the picture stored as it is.
    expect(readFileSync(destination).byteLength).toBeLessThan(1000 + 17 + 200);
  });

  it("stops when its signal is aborted, removing what it wrote, with what was there kept", async () => {
    const destination = join(folder(), "site.zip");
    writeFileSync(destination, "the earlier export");
    const cancel = new AbortController();
    cancel.abort(new Error("Cancelled"));

    await expect(
      writeZipAtomically(ENTRIES, destination, { ...STORED, signal: cancel.signal }),
    ).rejects.toThrow("Cancelled");
    expect(readFileSync(destination, "utf8")).toBe("the earlier export");
    expect(readdirSync(dir ?? "")).toEqual(["site.zip"]);
  });

  it("removes what it wrote when it can't move it into place", async () => {
    const destination = join(folder(), "site.zip");
    const rename = async () => {
      throw new Error("held by another program");
    };
    await expect(writeZipAtomically(ENTRIES, destination, { ...STORED, rename })).rejects.toThrow(
      "held by another program",
    );
    expect(readdirSync(dir ?? "")).toEqual([]);
  });
});
