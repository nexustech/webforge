import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedDocuments, type SiteDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { copyWforgeFixture } from "@webforge/test-utils";
import { TEST_DIR_REMOVAL } from "@webforge/test-utils/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBackups, KeepCopyError } from "./backups.js";
import { ProjectSession } from "./project-session.js";

// A site opened from an older Webforge (#1525, UC-2): its file is kept as it was before the first
// change writes it in a newer format, and a change that can't be preceded by its copy isn't saved.

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-copy-before-"));
});

afterEach(() => {
  rmSync(dir, TEST_DIR_REMOVAL);
});

/** The site renamed, as autosave saves a change. */
function renamed(site: SiteDoc, name: string) {
  return changedDocuments(site, {
    ...site,
    settings: { ...site.settings, general: { ...site.settings.general, name } },
  });
}

describe("the copy kept from before an update, as the session saves (#1525)", () => {
  it("keeps nothing for a site only opened, and the file as it was before the first change", async () => {
    const path = copyWforgeFixture(1, dir);
    const original = readFileSync(path);
    const backups = createBackups({ root: join(dir, "backups") });
    const kept: string[] = [];
    const session = new ProjectSession(
      {},
      {
        beforeFormatChange: (sitePath, info) => {
          kept.push(backups.keepBeforeUpdate(sitePath, info.projectId, info).path);
        },
      },
    );
    try {
      expect(await session.open(path)).toMatchObject({ status: "opened" });
      const read = await session.readSite();
      if (read.status !== "ok") throw new Error("Not read");
      // Opened and read: nothing written, nothing kept (ADR 0012, decision 5).
      expect(kept).toEqual([]);
      expect(readFileSync(path).equals(original)).toBe(true);

      expect(await session.commit(renamed(read.site, "Rosa's"))).toEqual({ status: "saved" });

      expect(kept).toHaveLength(1);
      // The copy holds the older format and the file's original bytes, edits and all after it.
      expect(readFileSync(kept[0] ?? "").equals(original)).toBe(true);
      expect(readFileSync(path).equals(original)).toBe(false);
      expect(kept[0]).toContain("before-update-format-1-site-1.wforge");
    } finally {
      await session.close();
    }
  });

  it("saves nothing, and says why, when the copy can't be kept", async () => {
    const path = copyWforgeFixture(1, dir);
    const original = readFileSync(path);
    const session = new ProjectSession(
      {},
      {
        beforeFormatChange: () => {
          throw new KeepCopyError(new Error("ENOSPC"));
        },
      },
    );
    try {
      await session.open(path);
      const read = await session.readSite();
      if (read.status !== "ok") throw new Error("Not read");

      expect(await session.commit(renamed(read.site, "Rosa's"))).toEqual({
        status: "failed",
        reason: "no-copy",
      });
      expect(readFileSync(path).equals(original)).toBe(true);
    } finally {
      await session.close();
    }
  });

  it("tries the day's version again with the change that keeps the copy, after one that failed", async () => {
    const path = copyWforgeFixture(1, dir);
    let full = true;
    const session = new ProjectSession(
      {},
      {
        dailyVersion: { kept: () => 5 },
        beforeFormatChange: () => {
          if (full) throw new KeepCopyError(new Error("ENOSPC"));
        },
      },
    );
    try {
      await session.open(path);
      const read = await session.readSite();
      if (read.status !== "ok") throw new Error("Not read");
      expect(await session.commit(renamed(read.site, "Rosa's"))).toMatchObject({
        reason: "no-copy",
      });

      // Room made on the disk: the next change keeps the copy, and the day's version with it.
      full = false;
      expect(await session.commit(renamed(read.site, "Rosa's"))).toEqual({ status: "saved" });
    } finally {
      await session.close();
    }
    const store = ProjectStore.open(path, { readOnly: true });
    try {
      expect(store.listVersions().filter((version) => version.reason === "daily")).toHaveLength(1);
    } finally {
      store.close();
    }
  });
});
