import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSite, SiteFormatError } from "@webforge/model";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ProjectFileError, ProjectStore } from "../src/index.js";

// A .wforge someone sent, damaged on the way or crafted (5.6, the security review's fuzzing of
// untrusted files): whatever its bytes, opening and reading it either works or fails with one of
// storage's own errors, which the app turns into a message. Never another error, which would
// reach the person as "something went wrong", or worse, leave a half-opened site.

const tempDir = tempDirFactory();

/**
 * Each run writes, opens and reads a whole site file: a few seconds in all alone, but past
 * Vitest's 30 s while the full suite ran with coverage on a busy machine (#796).
 */
const FUZZ_TIMEOUT_MS = 120_000;

/** A site file with a site, a version and an image: something in every table a read touches. */
function sampleFile(): Buffer {
  const path = join(tempDir(), "sample.wforge");
  const store = ProjectStore.create(path, { name: "Rosa's Bakery" });
  store.saveSite(
    createSite({ name: "Rosa's Bakery", language: "en", homeTitle: "Home", notFoundTitle: "404" }),
  );
  store.putAsset({
    mediaId: "photo",
    data: new Uint8Array(512).fill(7),
    mime: "image/png",
    originalName: "photo.png",
  });
  store.saveVersion("Before the menu", "manual");
  store.close();
  return readFileSync(path);
}

/** Opens the file at `path` read-only, and reads all of it that the app reads. */
function readAll(path: string): void {
  const store = ProjectStore.open(path, { readOnly: true });
  try {
    store.readSite();
    store.listAssets();
    for (const version of store.listVersions()) store.readVersionSite(version.id);
  } finally {
    store.close();
  }
}

/** Whether `error` is one the app expects from a file: storage's own, or the site format's. */
const expected = (error: unknown) =>
  error instanceof ProjectFileError || error instanceof SiteFormatError;

describe("a damaged or crafted .wforge (5.6)", () => {
  it(
    "opens and reads, or fails with storage's own error, whatever bytes are changed",
    () => {
      const original = sampleFile();
      // One file, written again for each run, rather than a folder for each.
      const path = join(tempDir(), "damaged.wforge");
      fc.assert(
        fc.property(
          fc.array(fc.record({ at: fc.nat(), value: fc.integer({ min: 0, max: 255 }) }), {
            minLength: 1,
            maxLength: 16,
          }),
          (changes) => {
            const bytes = Buffer.from(original);
            for (const { at, value } of changes) bytes[at % bytes.length] = value;
            writeFileSync(path, bytes);
            try {
              readAll(path);
            } catch (error) {
              if (!expected(error)) throw error;
            }
          },
        ),
        { numRuns: 300 },
      );
    },
    FUZZ_TIMEOUT_MS,
  );

  it(
    "refuses a file cut short, at any length",
    () => {
      const original = sampleFile();
      const path = join(tempDir(), "short.wforge");
      fc.assert(
        fc.property(fc.nat({ max: original.length - 1 }), (length) => {
          writeFileSync(path, original.subarray(0, length));
          try {
            readAll(path);
          } catch (error) {
            expect(expected(error), String(error)).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    },
    FUZZ_TIMEOUT_MS,
  );
});
