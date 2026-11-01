import { createSite } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import type { ReadSiteResult } from "../../shared/ipc-contract.js";
import { loadSite } from "./load-site.js";
import { siteSession } from "./site-session.js";

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
const summary = {
  sessionId: "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d",
  name: "Bakery",
  fileName: "Bakery.wforge",
  formatVersion: 1,
  syncService: null,
};

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

  it("cleans the file's rich text as the editor's is, and saves it with its next edit (S23)", async () => {
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("No home page");
    const hostile = {
      ...site,
      pages: {
        ...site.pages,
        [home.id]: {
          ...home,
          doc: {
            ...home.doc,
            content: [
              { type: "Text", props: { id: "t", text: '<p>Hi<img src=x onerror="y()"></p>' } },
            ],
          },
        },
      },
    };

    const loaded = await loadSite(project(summary, { status: "ok", site: hostile }), () => starter);

    if (loaded.kind !== "file") throw new Error("Not loaded from the file");
    expect(loaded.site.pages[home.id]?.doc.content).toEqual([
      { type: "Text", props: { id: "t", text: "<p>Hi</p>" } },
    ]);
    // Opening writes nothing: autosave's baseline is what the editor now holds.
    expect(loaded.saved).toBe(loaded.site);
  });

  it("remembers the open site's session for the calls that change it, and none without a site (R6)", async () => {
    await loadSite(project(summary, { status: "ok", site }), () => starter);
    expect(siteSession()).toBe(summary.sessionId);

    await loadSite(project(null, { status: "none" }), () => starter);
    expect(siteSession()).not.toBe(summary.sessionId);
    expect(siteSession()).toMatch(/^[0-9a-f-]{36}$/);
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
