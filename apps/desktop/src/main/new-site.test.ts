import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_THEME } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { readTemplates, TEMPLATES_DIR, type TemplateFolder } from "@webforge/templates/node";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { themePreset } from "@webforge/themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImportJobs } from "../worker/store-import.js";
import { fillNewSite, newSiteImporter, shippedTemplateReader } from "./new-site.js";
import { createInlineStorageWriter } from "./storage-writer.js";

let dir: string;
let sitePath: string;
let store: ProjectStore;
const templates = readTemplates();

/** Reads the shipped templates, as main does. */
const shipped = shippedTemplateReader(TEMPLATES_DIR);

/** A reader that has only `folder`, as if it were the template asked for. */
const only =
  (folder: TemplateFolder) =>
  (id: string): TemplateFolder => {
    if (id !== folder.template.id) throw new Error(`No template ${id}`);
    return folder;
  };

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
  importFile: vi.fn(newSiteImporter(createInlineStorageWriter(createImportJobs()), sitePath)),
});

describe("fillNewSite (2.14a)", () => {
  // Its eight photos through the storage writer: 0.3–1.8 s on CI's Windows runners, and twice 3–4.2 s,
  // in 95 runs of 26–28 Oct 2026. One runner stalled for 18.3 s with no more work (#561), past the
  // 15 s default; the E2E test that makes the same site stalled for 21.5 s that hour.
  it(
    "writes a template's site, named and in the chosen theme, its images in Media",
    async () => {
      const into = target();

      await fillNewSite(
        into,
        { name: "Rosa's Bakery", theme: "atelier", template: "cafe" },
        shipped,
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
    },
    scaledTestTimeout(30_000),
  );

  it("makes the site in the quick start's own colours, on the preset it names (3.11b)", async () => {
    const into = target();
    const preset = themePreset("atelier");
    if (preset === undefined) throw new Error("no preset");
    const themeTokens = {
      ...preset,
      colors: { ...preset.colors, primary: { l: 0.5, c: 0.2, h: 25 } },
    };

    await fillNewSite(
      into,
      { name: "Rosa's Bakery", theme: "atelier", template: "cafe", themeTokens },
      shipped,
    );

    expect(store.readSite().theme).toEqual(themeTokens);
  });

  it("puts the person's business in place of the template's sample, when it is given (QS-2)", async () => {
    const into = target();

    await fillNewSite(
      into,
      {
        name: "Rosa's Bakery",
        theme: "atelier",
        template: "cafe",
        business: { phone: "+44 1234 567890" },
      },
      shipped,
    );

    const site = store.readSite();
    expect(site.settings.contact).toMatchObject({
      businessName: "Rosa's Bakery",
      phone: "+44 1234 567890",
    });
    expect(JSON.stringify(site.layout.footer)).toContain("Rosa's Bakery ·");
  });

  it("refuses a template whose image isn't as its manifest says, writing no site", async () => {
    const [folder] = templates as [TemplateFolder];
    const [first] = folder.images;
    if (first === undefined) throw new Error("The café template has no image");
    // A re-encoded or stale copy of the file: stored under another hash than the Media item names.
    const changed = { ...folder, images: [{ ...first, hash: "0".repeat(64) }] };

    await expect(
      fillNewSite(target(), { name: "Bakery", theme: "light", template: "cafe" }, only(changed)),
    ).rejects.toThrow(`image ${first.file} isn't as its manifest says (stored)`);
    expect(store.isEmpty()).toBe(true);

    const failed = { ...target(), importFile: async () => ({ status: "failed" }) as const };
    await expect(
      fillNewSite(failed, { name: "Bakery", theme: "light", template: "cafe" }, shipped),
    ).rejects.toThrow("(failed)");
  });

  it("writes the Blank template without a template chosen, named and in the chosen theme (2.15c)", async () => {
    const into = target();

    await fillNewSite(into, { name: "Hightown Plumbing", theme: "workshop" }, shipped);

    const site = store.readSite();
    expect(site.settings.general.name).toBe("Hightown Plumbing");
    // The Header shows the site's name from its settings.
    expect(site.layout.header[0]?.props.bindings).toEqual({ siteName: "general.name" });
    expect(site.theme).toEqual(themePreset("workshop"));
    expect(
      site.pageOrder.flatMap((id) =>
        site.pages[id]?.kind === "page" ? [site.pages[id].title] : [],
      ),
    ).toEqual(["Home", "About", "Contact"]);
    expect(into.importFile).not.toHaveBeenCalled();
    expect(store.listAssets()).toEqual([]);
    expect(site.media).toEqual({});
  });

  it("refuses when the Blank template is missing", async () => {
    const empty = mkdtempSync(join(tmpdir(), "webforge-no-templates-"));
    try {
      await expect(
        fillNewSite(target(), { name: "Bakery", theme: "light" }, shippedTemplateReader(empty)),
      ).rejects.toThrow();
      expect(store.isEmpty()).toBe(true);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("makes Blank when another template is damaged, reading only the one it makes", async () => {
    // A copy of the shipped templates with the café's template.json broken.
    const copy = mkdtempSync(join(tmpdir(), "webforge-damaged-templates-"));
    try {
      cpSync(TEMPLATES_DIR, copy, { recursive: true });
      writeFileSync(join(copy, "cafe", "template.json"), "{ not json");
      const reader = shippedTemplateReader(copy);

      await fillNewSite(target(), { name: "Hightown Plumbing", theme: "light" }, reader);

      expect(store.readSite().settings.general.name).toBe("Hightown Plumbing");
      await expect(
        fillNewSite(target(), { name: "Bakery", theme: "light", template: "cafe" }, reader),
      ).rejects.toThrow();
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });

  it("starts in the default theme for a preset this build doesn't have", async () => {
    await fillNewSite(target(), { name: "Bakery", theme: "from-a-newer-webforge" }, shipped);

    expect(store.readSite().theme).toEqual(DEFAULT_THEME);
  });
});
