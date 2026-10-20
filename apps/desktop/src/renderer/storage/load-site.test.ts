import { createSite } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { ReadSiteResult } from "../../shared/ipc-contract.js";
import { loadSite } from "./load-site.js";

const site = createSite({
  name: "Bakery",
  language: "en",
  homeTitle: "Home",
  notFoundTitle: "404",
});
const starter = createSite({
  name: "New",
  language: "en",
  homeTitle: "Home",
  notFoundTitle: "404",
});
const summary = { name: "Bakery", fileName: "Bakery.wforge", formatVersion: 1, syncService: null };

function project(current: typeof summary | null, read: ReadSiteResult) {
  return { getCurrent: vi.fn(async () => current), readSite: vi.fn(async () => read) };
}

describe("loadSite", () => {
  it("edits the starter site in memory when no site file is open", async () => {
    const api = project(null, { status: "none" });

    await expect(loadSite(api, () => starter)).resolves.toEqual({ kind: "memory", site: starter });
    expect(api.readSite).not.toHaveBeenCalled();
  });

  it("edits the open site as the file holds it", async () => {
    await expect(
      loadSite(project(summary, { status: "ok", site }), () => starter),
    ).resolves.toEqual({ kind: "file", site, saved: site });
  });

  it("gives a new, empty site file the starter site, still unsaved", async () => {
    await expect(loadSite(project(summary, { status: "empty" }), () => starter)).resolves.toEqual({
      kind: "file",
      site: starter,
      saved: undefined,
    });
  });

  it.each<ReadSiteResult>([
    { status: "failed", reason: "newer-format" },
    { status: "failed", reason: "invalid" },
    { status: "none" },
  ])("never saves over a site it couldn't read (%j)", async (result) => {
    await expect(loadSite(project(summary, result), () => starter)).resolves.toEqual({
      kind: "memory",
      site: starter,
    });
  });
});
