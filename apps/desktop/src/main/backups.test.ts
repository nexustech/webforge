import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBackups } from "./backups.js";

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
  rmSync(dir, { recursive: true, force: true });
});

function backups(keep?: number) {
  return createBackups({
    root: join(dir, "backups"),
    now: () => clock,
    ...(keep === undefined ? {} : { keep }),
  });
}

describe("createBackups", () => {
  it("copies the open site into its own folder, named by the time it was taken", async () => {
    const backup = await backups().take(store, sitePath);

    expect(backup.path).toBe(
      join(dir, "backups", store.info.projectId, "20261020-153000-000.wforge"),
    );
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

    const names = readdirSync(join(dir, "backups", store.info.projectId)).filter((name) =>
      name.endsWith(".wforge"),
    );
    expect(names.sort()).toEqual([
      "20261020-150200-000.wforge",
      "20261020-150300-000.wforge",
      "20261020-150400-000.wforge",
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

    const listed = all.list(sitePath);

    expect(listed.map((backup) => backup.takenAt.toISOString())).toEqual([
      "2026-10-20T16:00:00.000Z",
      "2026-10-20T15:30:00.000Z",
    ]);
    store = ProjectStore.create(join(dir, "other.wforge"), { name: "Other" });
  });

  it("lists nothing for another site, a missing backups folder or an unreadable folder", async () => {
    const all = backups();
    expect(all.list(sitePath)).toEqual([]);

    await all.take(store, sitePath);
    mkdirSync(join(dir, "backups", "stray"));
    writeFileSync(join(dir, "backups", "stray", "source.json"), "{");
    writeFileSync(join(dir, "backups", store.info.projectId, "notes.txt"), "");

    expect(all.list(join(dir, "sites", "Other.wforge"))).toEqual([]);
    expect(all.list(sitePath)).toHaveLength(1);
  });

  it("stores no path, only a hash of it", async () => {
    await backups().take(store, sitePath);

    const folder = join(dir, "backups", store.info.projectId);
    const source = readdirSync(folder).find((name) => name === "source.json");
    expect(source).toBe("source.json");
    const text = await import("node:fs").then((fs) =>
      fs.readFileSync(join(folder, "source.json"), "utf8"),
    );
    expect(text).not.toContain("Bakery");
    expect(text).not.toContain(dir.slice(3));
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
});
