import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedDocuments, createSite, type SiteDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectSession } from "./project-session.js";

let dir: string;
let session: ProjectSession;
let site: SiteDoc;
const path = () => join(dir, "Bakery.wforge");

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-daily-"));
  // Days on this computer's clock, which versions are saved by too.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T09:00:00"));
  site = createSite({ name: "Bakery", language: "en", homeTitle: "Home", notFoundTitle: "404" });
  const store = ProjectStore.create(path(), { name: "Bakery" });
  store.saveSite(site);
  store.close();
  session = new ProjectSession({}, { dailyVersion: { kept: () => 2 } });
  await session.open(path());
  await session.readSite();
});

afterEach(async () => {
  await session.close();
  vi.useRealTimers();
  rmSync(dir, { recursive: true, force: true });
});

/** The site renamed, saved as autosave saves it, at `when`. */
async function editAt(when: string, name: string): Promise<void> {
  vi.setSystemTime(new Date(when));
  const next = {
    ...site,
    settings: { ...site.settings, general: { ...site.settings.general, name } },
  };
  expect(await session.commit(changedDocuments(site, next))).toEqual({ status: "saved" });
  site = next;
}

/** The versions' reasons, and the name of the site each holds, newest first. */
async function versions(): Promise<string[]> {
  await session.close();
  const store = ProjectStore.open(path());
  try {
    return store
      .listVersions()
      .map(
        (version) =>
          `${version.reason} ${store.readVersionSite(version.id)?.settings.general.name}`,
      );
  } finally {
    store.close();
    await session.open(path());
    await session.readSite();
  }
}

describe("the daily version (F-SITE-4, P3)", () => {
  it("saves the site as it was before the day's first change, once a day", async () => {
    await editAt("2026-11-01T09:05:00", "Rosa's");
    await editAt("2026-11-01T17:30:00", "Rosa's Bakery");
    expect(await versions()).toEqual(["daily Bakery"]);

    await editAt("2026-11-02T08:00:00", "Rosa's Cakes");
    expect(await versions()).toEqual(["daily Rosa's Bakery", "daily Bakery"]);
  });

  it("writes nothing to a site only looked at (R14)", async () => {
    expect(await versions()).toEqual([]);
  });

  it("keeps no more of them than the person's Versions kept", async () => {
    for (const day of ["01", "02", "03", "04"])
      await editAt(`2026-11-${day}T09:00:00`, `Day ${day}`);
    expect(await versions()).toEqual(["daily Day 03", "daily Day 02"]);
  });
});
