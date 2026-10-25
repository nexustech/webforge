import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_THEME } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { readTemplates } from "@webforge/templates/node";
import { themePreset } from "@webforge/themes";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fillNewSite } from "./new-site.js";

let dir: string;
let store: ProjectStore;
const templates = readTemplates();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-new-site-"));
  store = ProjectStore.create(join(dir, "Site.wforge"), { name: "Site" });
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("fillNewSite (2.14a)", () => {
  it("writes a template's site, named and in the chosen theme, its images in Media", () => {
    fillNewSite(store, { name: "Rosa's Bakery", theme: "atelier", template: "sample" }, () => [
      ...templates,
    ]);

    const site = store.readSite();
    const [{ template, images }] = templates as [(typeof templates)[number]];
    expect(site.settings.general.name).toBe("Rosa's Bakery");
    expect(site.theme).toEqual(themePreset("atelier"));
    expect(site.pageOrder).toHaveLength(template.site.pageOrder.length);
    expect(site.layout).toEqual(template.site.layout);
    expect(Object.keys(site.media).toSorted()).toEqual(
      images.map((image) => image.mediaId).toSorted(),
    );
    for (const image of images) {
      const asset = store.readAsset(image.mediaId);
      expect(asset, image.file).toMatchObject({
        hash: image.hash,
        mime: image.mimeType,
        width: image.width,
        height: image.height,
        originalName: image.file,
      });
      const bytes = store.readBlob(image.hash)?.data ?? new Uint8Array();
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(image.hash);
    }
  });

  it("writes the Blank site without a template, named and in the chosen theme", () => {
    fillNewSite(store, { name: "Hightown Plumbing", theme: "workshop" }, () => {
      throw new Error("Blank needs no templates");
    });

    const site = store.readSite();
    expect(site.settings.general.name).toBe("Hightown Plumbing");
    expect(site.layout.header[0]?.props.siteName).toBe("Hightown Plumbing");
    expect(site.theme).toEqual(themePreset("workshop"));
    expect(store.listAssets()).toEqual([]);
  });

  it("starts in the default theme for a preset this build doesn't have", () => {
    fillNewSite(store, { name: "Bakery", theme: "from-a-newer-webforge" }, () => [...templates]);

    expect(store.readSite().theme).toEqual(DEFAULT_THEME);
  });
});
