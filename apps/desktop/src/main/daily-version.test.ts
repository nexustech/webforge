import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dailyVersionFeature } from "./daily-version.js";
import type { SiteStoreAccess } from "./project-session.js";

let dir: string;
let store: ProjectStore;
const access: SiteStoreAccess = async (work) => work(store);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-daily-"));
  store = ProjectStore.create(join(dir, "Bakery.wforge"), { name: "Bakery" });
  // Days on this computer's clock, which versions are saved by too.
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Opens the site at `when`, as the app tells its features. */
async function openAt(when: string, kept = 20): Promise<void> {
  vi.setSystemTime(new Date(when));
  const feature = dailyVersionFeature({ versionsKept: () => kept });
  await feature.site?.opened?.(access, join(dir, "Bakery.wforge"));
}

const reasons = () => store.listVersions().map((version) => version.reason);

describe("the daily version (F-SITE-4, P3)", () => {
  it("saves one as the site first opens each day, with no name or picture", async () => {
    store.saveSite(
      createSite({ name: "Bakery", language: "en", homeTitle: "Home", notFoundTitle: "404" }),
    );

    await openAt("2026-11-01T09:00:00");
    await openAt("2026-11-01T17:30:00");
    expect(reasons()).toEqual(["daily"]);
    expect(store.listVersions()[0]).toMatchObject({ name: "", thumbnailHash: undefined });

    await openAt("2026-11-02T08:00:00");
    expect(reasons()).toEqual(["daily", "daily"]);
  });

  it("keeps no more of them than the person's Versions kept", async () => {
    store.saveSite(
      createSite({ name: "Bakery", language: "en", homeTitle: "Home", notFoundTitle: "404" }),
    );
    for (const day of ["01", "02", "03", "04"]) await openAt(`2026-11-${day}T09:00:00`, 2);
    expect(reasons()).toEqual(["daily", "daily"]);
  });

  it("saves none of a new, empty site", async () => {
    await openAt("2026-11-01T09:00:00");
    expect(reasons()).toEqual([]);
  });
});
