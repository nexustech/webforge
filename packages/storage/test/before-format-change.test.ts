import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSite } from "@webforge/model";
import { copyWforgeFixture } from "@webforge/test-utils";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { FORMAT_VERSION, ProjectStore, type StoredFormats } from "../src/index.js";

// The moment before a site's file changes format (#1525, UC-2): the newer Webforge keeps the file
// as the older one wrote it, so it still opens there. `beforeFormatChange` is called once, before
// that first write, with the file whole on disk; if it throws, the write doesn't happen.

const tempDir = tempDirFactory("webforge-before-format-");

/** Opens `path` with a hook that keeps the file's bytes each time it's called. */
function openKeeping(path: string, options: { readonly fail?: boolean } = {}) {
  const kept: Buffer[] = [];
  const formats: StoredFormats[] = [];
  const store = ProjectStore.open(path, {
    beforeFormatChange: (stored) => {
      kept.push(readFileSync(path));
      formats.push(stored);
      if (options.fail === true) throw new Error("No room for the copy");
    },
  });
  return { store, kept, formats };
}

describe("ProjectStore's beforeFormatChange (#1525)", () => {
  it("keeps a file one format behind before its first write, once, with its bytes as they were", () => {
    const path = copyWforgeFixture(1, tempDir());
    const original = readFileSync(path);
    const { store, kept, formats } = openKeeping(path);
    try {
      // Reading writes nothing, and keeps nothing.
      const site = store.readSite();
      expect(kept).toHaveLength(0);

      store.saveSite(site);
      store.saveSite(site);

      expect(kept).toHaveLength(1);
      expect(kept[0]?.equals(original)).toBe(true);
      // The formats as stored, which name the versions that open the copy.
      expect(formats).toEqual([{ fileFormat: 1, siteFormat: 1 }]);
      expect(store.info.formatVersion).toBeGreaterThan(1);
    } finally {
      store.close();
    }
  });

  it("keeps a site one site format behind before the commit that writes it in the new one", () => {
    const path = copyWforgeFixture(2, tempDir());
    const original = readFileSync(path);
    const { store, kept, formats } = openKeeping(path);
    try {
      const site = store.readSite();
      expect(kept).toHaveLength(0);

      store.commit([]);
      store.saveSite(site);

      expect(kept).toHaveLength(1);
      expect(kept[0]?.equals(original)).toBe(true);
      // The site's format as stored, not as reading brought it up to date.
      expect(formats).toEqual([{ fileFormat: FORMAT_VERSION, siteFormat: 11 }]);
    } finally {
      store.close();
    }
  });

  it("writes nothing when keeping the copy fails, and tries again with the next write", () => {
    const path = copyWforgeFixture(1, tempDir());
    const original = readFileSync(path);
    const { store, kept } = openKeeping(path, { fail: true });
    try {
      const site = store.readSite();

      expect(() => store.saveSite(site)).toThrow("No room for the copy");
      expect(readFileSync(path).equals(original)).toBe(true);
      expect(store.info.formatVersion).toBe(1);
      // Still not kept, so still asked for before the next write.
      expect(() => store.saveSite(site)).toThrow("No room for the copy");
      expect(kept).toHaveLength(2);
    } finally {
      store.close();
    }
  });

  it("is never called for a file already up to date, or one opened read-only", () => {
    const dir = tempDir();
    const current = join(dir, "Current.wforge");
    const made = ProjectStore.create(current, { name: "Bakery" });
    made.saveSite(
      createSite({ name: "Bakery", language: "en", homeTitle: "Home", notFoundTitle: "404" }),
    );
    made.close();
    const { store, kept } = openKeeping(current);
    try {
      store.saveSite(store.readSite());
    } finally {
      store.close();
    }
    expect(kept).toHaveLength(0);

    const old = copyWforgeFixture(1, dir);
    let called = false;
    const readOnly = ProjectStore.open(old, {
      readOnly: true,
      beforeFormatChange: () => {
        called = true;
      },
    });
    try {
      readOnly.readSite();
      expect(() => readOnly.saveSite(readOnly.readSite())).toThrow();
    } finally {
      readOnly.close();
    }
    expect(called).toBe(false);
  });

  it("leaves a newer Webforge's file exactly as it was, and keeps nothing of it", () => {
    // A site saved by a newer Webforge: a format past this build's.
    const path = join(tempDir(), "Newer.wforge");
    const made = ProjectStore.create(path, { name: "Bakery" });
    made.saveSite(
      createSite({ name: "Bakery", language: "en", homeTitle: "Home", notFoundTitle: "404" }),
    );
    made.close();
    const db = new Database(path);
    db.prepare("UPDATE meta SET value = ? WHERE key = 'format_version'").run(
      String(FORMAT_VERSION + 1),
    );
    db.close();
    const original = readFileSync(path);

    const { store, kept } = openKeeping(path);
    try {
      // Opened read-only, as the session then refuses it: nothing can write it.
      expect(store.info).toMatchObject({ newerFormat: true, readOnly: true });
      expect(() => store.saveSite(store.readSite())).toThrow();
    } finally {
      store.close();
    }
    expect(readFileSync(path).equals(original)).toBe(true);
    expect(kept).toHaveLength(0);
  });
});
