import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { TEST_DIR_REMOVAL } from "@webforge/test-utils/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBackups, KeepCopyError } from "./backups.js";

let dir: string;
let sitePath: string;
let store: ProjectStore;
let clock: Date;

const site = createSite({
  name: "Bakery",
  language: "en",
  homeTitle: "Home",
  notFoundTitle: "404",
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-backups-"));
  sitePath = join(dir, "sites", "Bakery.wforge");
  mkdirSync(join(dir, "sites"));
  store = ProjectStore.create(sitePath, { name: "Bakery" });
  store.saveSite(site);
  clock = new Date("2026-10-20T15:30:00.000Z");
});

afterEach(() => {
  store.close();
  rmSync(dir, TEST_DIR_REMOVAL);
});

function backups(keep?: number) {
  return createBackups({
    root: join(dir, "backups"),
    now: () => clock,
    ...(keep === undefined ? {} : { keep }),
  });
}

/** Every file below the backups folder, as paths relative to it. */
function backupTree(): string[] {
  return readdirSync(join(dir, "backups"), { recursive: true, encoding: "utf8" });
}

describe("createBackups", () => {
  it("copies the open site into its own folder, named by the time it was taken", async () => {
    const backup = await backups().take(store, sitePath);

    expect(dirname(dirname(backup.path))).toBe(join(dir, "backups", store.info.projectId));
    expect(backup.path.endsWith("20261020-153000-000.wforge")).toBe(true);
    expect(backup.takenAt).toEqual(clock);
    const copy = ProjectStore.open(backup.path, { readOnly: true });
    expect(copy.readSite()).toEqual(site);
    copy.close();
  });

  it("keeps the newest backups only", async () => {
    const rolling = backups(3);
    for (let minute = 0; minute < 5; minute += 1) {
      clock = new Date(Date.UTC(2026, 9, 20, 15, minute));
      await rolling.take(store, sitePath);
    }

    expect(rolling.list(sitePath).map((backup) => backup.takenAt.getUTCMinutes())).toEqual([
      4, 3, 2,
    ]);
  });

  it("names two backups in the same millisecond apart", async () => {
    const twice = backups();
    const first = await twice.take(store, sitePath);
    const second = await twice.take(store, sitePath);

    expect(second.path).not.toBe(first.path);
  });

  it("lists a damaged site's backups newest first, without opening it", async () => {
    const all = backups();
    await all.take(store, sitePath);
    clock = new Date("2026-10-20T16:00:00.000Z");
    await all.take(store, sitePath);
    store.close();
    writeFileSync(sitePath, "damaged");

    expect(all.list(sitePath).map((backup) => backup.takenAt.toISOString())).toEqual([
      "2026-10-20T16:00:00.000Z",
      "2026-10-20T15:30:00.000Z",
    ]);
    store = ProjectStore.create(join(dir, "other.wforge"), { name: "Other" });
  });

  it("keeps the backups of two copies of one site apart (they share a project id)", async () => {
    const all = backups();
    await all.take(store, sitePath);
    store.close();
    const copyPath = join(dir, "sites", "Bakery v2.wforge");
    copyFileSync(sitePath, copyPath);
    store = ProjectStore.open(copyPath);
    clock = new Date("2026-10-20T17:00:00.000Z");
    await all.take(store, copyPath);

    expect(all.list(sitePath).map((backup) => backup.takenAt.getUTCHours())).toEqual([15]);
    expect(all.list(copyPath).map((backup) => backup.takenAt.getUTCHours())).toEqual([17]);
  });

  it("lists nothing for another site or a missing backups folder, and skips other files", async () => {
    const all = backups();
    expect(all.list(sitePath)).toEqual([]);

    await all.take(store, sitePath);
    writeFileSync(join(dir, "backups", "notes.txt"), "");
    const folder = dirname((all.list(sitePath)[0] ?? { path: "" }).path);
    writeFileSync(join(folder, "notes.txt"), "");

    expect(all.list(join(dir, "sites", "Other.wforge"))).toEqual([]);
    expect(all.list(sitePath)).toHaveLength(1);
  });

  it("stores no path or site name, only a hash of the path", async () => {
    await backups().take(store, sitePath);

    for (const entry of backupTree()) {
      expect(entry).not.toContain("Bakery");
      expect(entry).not.toContain("sites");
    }
  });

  it("removes backups that were left unfinished an hour ago, not running ones", async () => {
    const all = backups();
    const first = await all.take(store, sitePath);
    const folder = dirname(first.path);
    const stale = join(folder, ".old.wforge.a.tmp");
    const fresh = join(folder, ".new.wforge.b.tmp");
    writeFileSync(stale, "half");
    writeFileSync(fresh, "half");
    const twoHoursAgo = new Date(clock.getTime() - 2 * 60 * 60 * 1_000);
    utimesSync(stale, twoHoursAgo, twoHoursAgo);
    utimesSync(fresh, clock, clock);

    await all.take(store, sitePath);

    expect(existsSync(stale)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });

  it("restores a backup in place and keeps the damaged file next to it", async () => {
    const all = backups();
    const backup = await all.take(store, sitePath);
    store.close();
    writeFileSync(sitePath, "damaged");
    clock = new Date("2026-10-21T09:00:00.000Z");

    const damaged = all.restore(backup.path, sitePath);

    expect(damaged).toBe(join(dir, "sites", "Bakery (damaged 20261021-090000-000).wforge"));
    expect(existsSync(damaged)).toBe(true);
    store = ProjectStore.open(sitePath);
    expect(store.readSite()).toEqual(site);
  });

  it("leaves the damaged file where it was when the backup can't be copied", () => {
    store.close();
    writeFileSync(sitePath, "damaged");

    expect(() => backups().restore(join(dir, "missing.wforge"), sitePath)).toThrow();

    expect(readdirSync(join(dir, "sites"))).toEqual(["Bakery.wforge"]);
    store = ProjectStore.create(join(dir, "other.wforge"), { name: "Other" });
  });
});

describe("the copy kept from before an update (#1525)", () => {
  const OLD = { fileFormat: 1, siteFormat: 11 };
  const NEWER = { fileFormat: 2, siteFormat: 22 };

  it("keeps the file byte for byte by the site's id, apart from the rolling backups", async () => {
    const backed = backups(2);
    const original = readFileSync(sitePath);

    const kept = backed.keepBeforeUpdate(sitePath, store.info.projectId, OLD);

    expect(readFileSync(kept.path).equals(original)).toBe(true);
    expect(kept.path).toBe(
      join(dir, "backups", store.info.projectId, "before-update-format-1-site-11.wforge"),
    );
    expect(kept).toMatchObject({ fileFormat: 1, siteFormat: 11, size: original.length });
    // Never counted, pruned or restored with the rolling backups.
    for (let index = 0; index < 4; index++) {
      clock = new Date(clock.getTime() + 60_000);
      await backed.take(store, sitePath);
    }
    expect(backed.list(sitePath)).toHaveLength(2);
    expect(backed.list(sitePath).some((backup) => backup.path === kept.path)).toBe(false);
    expect(existsSync(kept.path)).toBe(true);
  });

  it("finds the site's kept copy by its id, wherever its file is now, one for each site", () => {
    const backed = backups();
    expect(backed.keptBeforeUpdate(store.info.projectId)).toBeUndefined();

    backed.keepBeforeUpdate(sitePath, store.info.projectId, OLD);
    // A later format change replaces it.
    const later = backed.keepBeforeUpdate(sitePath, store.info.projectId, NEWER);

    expect(backed.keptBeforeUpdate(store.info.projectId)).toMatchObject({
      path: later.path,
      fileFormat: 2,
      siteFormat: 22,
    });
    expect(
      readdirSync(join(dir, "backups", store.info.projectId)).filter((name) =>
        name.startsWith("before-update"),
      ),
    ).toEqual(["before-update-format-2-site-22.wforge"]);
  });

  it("says it couldn't keep the copy, and leaves the earlier one, when the copy fails", () => {
    const backed = backups();
    const earlier = backed.keepBeforeUpdate(sitePath, store.info.projectId, OLD);

    expect(() =>
      backed.keepBeforeUpdate(join(dir, "missing.wforge"), store.info.projectId, NEWER),
    ).toThrow(KeepCopyError);
    expect(existsSync(earlier.path)).toBe(true);
  });
});
