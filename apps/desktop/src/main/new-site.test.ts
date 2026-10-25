import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_THEME } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { readTemplates, type TemplateFolder } from "@webforge/templates/node";
import { themePreset } from "@webforge/themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storeImport } from "../worker/store-import.js";
import { fillNewSite } from "./new-site.js";

let dir: string;
let sitePath: string;
let store: ProjectStore;
const templates = readTemplates();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-new-site-"));
  sitePath = join(dir, "Site.wforge");
  store = ProjectStore.create(sitePath, { name: "Site" });
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

/** The new file as the session hands it to the fill: its images stored as the writer stores them. */
const target = () => ({
  store,
  importFile: vi.fn((mediaId: string, fileName: string, path: string) =>
    storeImport({ sitePath, mediaId, fileName, source: { path } }),
  ),
});

describe("fillNewSite (2.14a)", () => {
  it("writes a template's site, named and in the chosen theme, its images in Media", async () => {
    const into = target();

    await fillNewSite(
      into,
      { name: "Rosa's Bakery", theme: "atelier", template: "sample" },
      () => templates,
    );

    const site = store.readSite();
    const [{ template, images, imagesDir }] = templates as [TemplateFolder];
    expect(site.settings.general.name).toBe("Rosa's Bakery");
    expect(site.theme).toEqual(themePreset("atelier"));
    expect(site.pageOrder).toHaveLength(template.site.pageOrder.length);
    expect(site.layout).toEqual(template.site.layout);
    expect(Object.keys(site.media).toSorted()).toEqual(
      images.map((image) => image.mediaId).toSorted(),
    );
    for (const image of images) {
      // Through the storage writer, by path, off the main thread (R13b).
      expect(into.importFile).toHaveBeenCalledWith(
        image.mediaId,
        image.file,
        join(imagesDir, image.file),
      );
      expect(store.readAsset(image.mediaId), image.file).toMatchObject({
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

  it("refuses a template whose image isn't as its manifest says, writing no site", async () => {
    const [folder] = templates as [TemplateFolder];
    const [first] = folder.images;
    if (first === undefined) throw new Error("The sample template has no image");
    // A re-encoded or stale copy of the file: stored under another hash than the Media item names.
    const changed = { ...folder, images: [{ ...first, hash: "0".repeat(64) }] };

    await expect(
      fillNewSite(target(), { name: "Bakery", theme: "light", template: "sample" }, () => [
        changed,
      ]),
    ).rejects.toThrow(`image ${first.file} isn't as its manifest says (stored)`);
    expect(store.isEmpty()).toBe(true);

    const failed = { ...target(), importFile: async () => ({ status: "failed" }) as const };
    await expect(
      fillNewSite(failed, { name: "Bakery", theme: "light", template: "sample" }, () => templates),
    ).rejects.toThrow("(failed)");
  });

  it("writes the Blank site without a template, named and in the chosen theme", async () => {
    const into = target();

    await fillNewSite(into, { name: "Hightown Plumbing", theme: "workshop" }, () => {
      throw new Error("Blank needs no templates");
    });

    const site = store.readSite();
    expect(site.settings.general.name).toBe("Hightown Plumbing");
    expect(site.layout.header[0]?.props.siteName).toBe("Hightown Plumbing");
    expect(site.theme).toEqual(themePreset("workshop"));
    expect(into.importFile).not.toHaveBeenCalled();
    expect(store.listAssets()).toEqual([]);
  });

  it("starts in the default theme for a preset this build doesn't have", async () => {
    await fillNewSite(
      target(),
      { name: "Bakery", theme: "from-a-newer-webforge" },
      () => templates,
    );

    expect(store.readSite().theme).toEqual(DEFAULT_THEME);
  });
});
