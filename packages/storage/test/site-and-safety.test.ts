import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  createSite,
  DEFAULT_THEME,
  type PageId,
  SiteFormatError,
  siteDocuments,
} from "@webforge/model";
import { copyWforgeFixture, heroPhoto, tempDirFactory } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { detectSyncFolder, ProjectStore, ReadOnlyProjectError } from "../src/index.js";

const tempDir = tempDirFactory();

function newStore(): { store: ProjectStore; path: string } {
  const path = join(tempDir(), "site.wforge");
  return { store: ProjectStore.create(path, { name: "Rosa's Bakery" }), path };
}

const newSite = () =>
  createSite({ name: "Rosa's Bakery", language: "en", homeTitle: "Home", notFoundTitle: "Oops" });

describe("the format 1 fixture", () => {
  it("opens with its site, image and version", () => {
    const store = ProjectStore.open(copyWforgeFixture(1, tempDir()));

    const site = store.readSite();
    expect(site.settings.general.name).toBe("Rosa's Bakery");
    expect(site.pageOrder.map((id) => site.pages[id]?.title)).toEqual([
      "Home",
      "About us",
      "Page not found",
    ]);
    const [image] = Object.values(site.media);
    expect(image).toMatchObject({ kind: "image", alt: "Green hills under a morning sun" });
    const asset = store.readAsset(image?.id ?? "");
    expect(asset?.hash).toBe(image?.hash);
    expect(Buffer.from(store.readBlob(image?.hash ?? "")?.data ?? []).equals(heroPhoto())).toBe(
      true,
    );
    expect(store.listVersions().map((version) => version.name)).toEqual(["First version"]);
    store.close();
  });
});

describe("ProjectStore.readSite and saveSite", () => {
  it("saves a whole site and reads it back after reopening", () => {
    const { store, path } = newStore();
    const site = newSite();
    expect(store.isEmpty()).toBe(true);

    store.saveSite(site);
    expect(store.isEmpty()).toBe(false);
    store.close();

    const reopened = ProjectStore.open(path);
    expect(reopened.readSite()).toEqual(site);
    expect(reopened.readDocuments().map((document) => document.id)).toEqual(
      siteDocuments(site)
        .map((document) => document.id)
        .sort(),
    );
    reopened.close();
  });

  it("deletes the documents of pages the saved site no longer has", () => {
    const { store } = newStore();
    const site = newSite();
    const about = { ...(site.pages[site.homePageId] ?? site.pages[site.pageOrder[0] as PageId]) };
    const withAbout = {
      ...site,
      pages: { ...site.pages, about: { ...about, id: "about" as PageId, slug: "about" } },
      pageOrder: [...site.pageOrder, "about" as PageId],
    };
    store.saveSite(withAbout);

    store.saveSite(site);

    expect(store.readDocument("page:about")).toBeUndefined();
    expect(store.readSite()).toEqual(site);
    store.close();
  });

  it("reports an invalid site with SiteFormatError", () => {
    const { store } = newStore();
    store.commit([{ type: "put", id: "site", kind: "site", content: { formatVersion: 1 } }]);

    expect(() => store.readSite()).toThrow(SiteFormatError);
    store.close();
  });

  it("refuses every write when opened read-only, but still reads and backs up", async () => {
    const { store, path } = newStore();
    const site = newSite();
    store.saveSite(site);
    store.close();

    const readOnly = ProjectStore.open(path, { readOnly: true });
    expect(readOnly.info).toMatchObject({ readOnly: true, newerFormat: false });
    expect(readOnly.readSite()).toEqual(site);
    const writes = [
      () => readOnly.commit([]),
      () => readOnly.saveSite(site),
      () => readOnly.putBlob(new Uint8Array([1]), "image/png"),
      () =>
        readOnly.putAsset({
          mediaId: "a",
          data: new Uint8Array([1]),
          mime: "x",
          originalName: "a",
        }),
      () => readOnly.saveVersion("x", "manual"),
      () => readOnly.collectGarbage(),
    ];
    for (const write of writes) {
      expect(write).toThrow(ReadOnlyProjectError);
    }
    const backup = join(tempDir(), "backup.wforge");
    await readOnly.backupTo(backup);
    readOnly.close();
    const copy = ProjectStore.open(backup);
    expect(copy.readSite()).toEqual(site);
    copy.close();
  });
});

describe("ProjectStore.backupTo", () => {
  it("writes a consistent copy that opens as the same project, leaving no temporary files", async () => {
    const { store } = newStore();
    store.saveSite(newSite());
    const dir = tempDir();
    const backup = join(dir, "backup.wforge");

    await store.backupTo(backup);
    // The working copy keeps working while and after a backup.
    store.commit([
      { type: "put", id: "theme", kind: "theme", content: { ...DEFAULT_THEME, preset: "cupcake" } },
    ]);

    const copy = ProjectStore.open(backup);
    expect(copy.info.projectId).toBe(store.info.projectId);
    expect(copy.readSite().theme).toEqual(DEFAULT_THEME);
    copy.close();
    store.close();
    expect(readFileSync(backup).subarray(0, 15).toString()).toBe("SQLite format 3");
  });

  it("cleans up when the backup can't be written", async () => {
    const { store } = newStore();

    await expect(store.backupTo(join(tempDir(), "missing", "backup.wforge"))).rejects.toThrow();
    store.close();
  });
});

describe("detectSyncFolder", () => {
  it.each([
    ["/Users/sam/OneDrive/Sites/bakery.wforge", "onedrive"],
    ["/Users/sam/OneDrive - Contoso/bakery.wforge", "onedrive"],
    ["/Users/sam/Library/CloudStorage/OneDrive-Personal/bakery.wforge", "onedrive"],
    ["/Users/sam/Dropbox/bakery.wforge", "dropbox"],
    ["/Users/sam/Dropbox (Personal)/bakery.wforge", "dropbox"],
    ["/Users/sam/Library/Mobile Documents/com~apple~CloudDocs/bakery.wforge", "icloud"],
    ["/Users/sam/iCloudDrive/bakery.wforge", "icloud"],
    [
      "/Users/sam/Library/CloudStorage/GoogleDrive-sam@example.com/My Drive/bakery.wforge",
      "google-drive",
    ],
    ["/Volumes/G/My Drive/bakery.wforge", "google-drive"],
    ["/Users/sam/Google Drive/bakery.wforge", "google-drive"],
  ])("recognises %s", (path, service) => {
    expect(detectSyncFolder(path, {})).toBe(service);
  });

  it.each([["/Users/sam/Documents/bakery.wforge"], ["/Users/sam/OneDriveBackup/bakery.wforge"]])(
    "finds no sync client for %s",
    (path) => {
      expect(detectSyncFolder(path, {})).toBeUndefined();
    },
  );

  it("uses the folders OneDrive announces in the environment, even with a custom name", () => {
    const work = resolve("/Users/sam/Work Files");
    const env = { OneDrive: "", OneDriveCommercial: work };

    expect(detectSyncFolder(join(work, "sites", "bakery.wforge"), env)).toBe("onedrive");
    expect(detectSyncFolder(`${work} Old/bakery.wforge`, env)).toBeUndefined();
  });
});

describe("ProjectStore.backupTo while closing", () => {
  it("finishes a backup even when the store is closed while it runs", async () => {
    const { store } = newStore();
    store.saveSite(newSite());
    const backup = join(tempDir(), "backup.wforge");

    const running = store.backupTo(backup);
    store.close();
    await running;

    const copy = ProjectStore.open(backup);
    expect(copy.readSite().settings.general.name).toBe("Rosa's Bakery");
    copy.close();
  });
});
