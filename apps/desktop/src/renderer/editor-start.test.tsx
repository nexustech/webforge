import { createSite } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../shared/ipc/prefs.js";
import type { ReadSiteResult } from "../shared/ipc/project.js";
import { App } from "./App.js";
import { editorFor } from "./editor-start.js";
import { siteSession } from "./storage/index.js";

const site = createSite({
  name: "Bakery",
  language: "en",
  homeTitle: "Home",
  notFoundTitle: "404",
});
const current = {
  sessionId: "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d",
  name: "Bakery",
  fileName: "Bakery.wforge",
  formatVersion: 1,
  syncService: null,
};
const info = { name: "Webforge", version: "1.2.0" };

/** The editor `editorFor` gives for what main read, drawn with `info` and the preferences. */
async function editorOf(read: ReadSiteResult) {
  const show = await editorFor(current, read, { editorMode: "content" });
  return show?.(info, DEFAULT_PREFERENCES);
}

describe("the editor's way in (#896)", () => {
  it("gives the editor for the open site, its editor state and the open site's session", async () => {
    const editor = await editorOf({ status: "ok", site });
    expect(editor?.type).toBe(App);
    expect(editor?.props).toMatchObject({
      info,
      preferences: DEFAULT_PREFERENCES,
      loaded: { kind: "file", site, saved: site },
      uiState: { editorMode: "content" },
    });
    expect(siteSession()).toBe(current.sessionId);
  });

  it("gives a new site file the starter site, which autosave then writes", async () => {
    const editor = await editorOf({ status: "empty" });
    expect(editor?.props).toMatchObject({ loaded: { kind: "file", saved: undefined } });
  });

  it("gives nothing for a site that couldn't be read, so the start screen shows", async () => {
    await expect(editorOf({ status: "failed", reason: "newer-format" })).resolves.toBeUndefined();
    await expect(editorOf({ status: "none" })).resolves.toBeUndefined();
  });
});
