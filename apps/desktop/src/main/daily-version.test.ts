import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedDocuments, createSite, type SiteDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { TEST_DIR_REMOVAL } from "@webforge/test-utils/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectSession } from "./project-session.js";

let dir: string;
let session: ProjectSession;
let site: SiteDoc;
const path = () => join(dir, "Bakery.wforge");

/**
 * Each step's time in the test running, in ms. A test that fails says them: this file once ran
 * past its timeout on Ubuntu CI, waiting about 5 s at a time without working, and its steps take
 * well under a second (#1546). Real time: only `Date` is faked.
 */
const steps: string[] = [];
async function timed<T>(step: string, run: () => Promise<T> | T): Promise<T> {
  const start = performance.now();
  try {
    return await run();
  } finally {
    steps.push(`${step} ${Math.round(performance.now() - start)}`);
  }
}

beforeEach(async ({ onTestFailed }) => {
  steps.length = 0;
  onTestFailed(({ task }) => {
    for (const error of task.result?.errors ?? []) {
      error.message += `
Each step's time, in ms (#1546): ${steps.join(", ")}`;
    }
  });
  dir = mkdtempSync(join(tmpdir(), "webforge-daily-"));
  // Days on this computer's clock, which versions are saved by too.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T09:00:00"));
  site = createSite({ name: "Bakery", language: "en", homeTitle: "Home", notFoundTitle: "404" });
  const store = await timed("create", () => ProjectStore.create(path(), { name: "Bakery" }));
  await timed("save", () => store.saveSite(site));
  store.close();
  session = new ProjectSession({}, { dailyVersion: { kept: () => 2 } });
  await timed("open", () => session.open(path()));
  await timed("read", () => session.readSite());
});

afterEach(async () => {
  await session.close();
  vi.useRealTimers();
  rmSync(dir, TEST_DIR_REMOVAL);
});

/** The site renamed, saved as autosave saves it, at `when`. */
async function editAt(when: string, name: string): Promise<void> {
  vi.setSystemTime(new Date(when));
  const next = {
    ...site,
    settings: { ...site.settings, general: { ...site.settings.general, name } },
  };
  expect(await timed("commit", () => session.commit(changedDocuments(site, next)))).toEqual({
    status: "saved",
  });
  site = next;
}

/** The versions' reasons, and the name of the site each holds, newest first. */
async function versions(): Promise<string[]> {
  await timed("close", () => session.close());
  const store = await timed("open the store", () => ProjectStore.open(path()));
  try {
    return await timed("list", () =>
      store
        .listVersions()
        .map(
          (version) =>
            `${version.reason} ${store.readVersionSite(version.id)?.settings.general.name}`,
        ),
    );
  } finally {
    store.close();
    await timed("open", () => session.open(path()));
    await timed("read", () => session.readSite());
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
