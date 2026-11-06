import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSite } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { afterEach, beforeEach, expect, it } from "vitest";
import { saveVersionIn } from "./site-versions.js";

let dir: string;
let store: ProjectStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-site-versions-"));
  store = ProjectStore.create(join(dir, "Bakery.wforge"), { name: "Bakery" });
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

it("saves 4.5's on-publish version from the documents the publish read, with its record", () => {
  const site = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "404",
  });
  store.saveSite(site);
  // What a publish reads as it starts; the site is edited while it goes live.
  const documents = store.readManifest();
  store.saveSite({
    ...site,
    settings: { ...site.settings, general: { ...site.settings.general, name: "Rosa's" } },
  });
  const publishedTo = {
    destinationId: "netlify-1",
    publishedAt: "2026-11-06T10:00:00.000Z",
    check: "live" as const,
  };

  const saved = saveVersionIn(store, {
    name: "",
    reason: "on-publish",
    thumbnail: undefined,
    kept: 5,
    documents,
    publishedTo,
  });

  expect(saved).toMatchObject({ kind: "auto", reason: "on-publish", publishedTo });
  // The site as the publish read it, not as it was edited since.
  expect(store.readVersionSite(saved.id)?.settings.general.name).toBe("Bakery");
});
