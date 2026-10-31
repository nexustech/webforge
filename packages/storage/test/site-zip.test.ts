import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createSite,
  type MediaId,
  migrateSite,
  type SiteDoc,
  siteFromDocuments,
} from "@webforge/model";
import { copyWforgeFixture, heroPhoto, zipArchive } from "@webforge/test-utils";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import fc from "fast-check";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  fillFromSitePackage,
  fillFromSiteZip,
  ProjectStore,
  reachableBlobs,
  readSiteZip,
  SITE_ZIP_MANIFEST,
  SiteZipError,
  sitePackageOf,
  siteZipEntries,
  writeSiteZip,
} from "../src/index.js";

// A site saved as a ZIP and opened again (4.7, F-SITE-5): nothing lost on the way.

const tempDir = tempDirFactory();

/** `store`'s site as it opens: its documents put together and migrated. */
const siteOf = (store: ProjectStore) => migrateSite(siteFromDocuments(store.readDocuments()));

/**
 * Everything a project holds that the app reads: its site and versions as they open (migrated),
 * its Media and the project's choices.
 */
function contents(store: ProjectStore) {
  const versions = store.listVersions().map((version) => ({
    version,
    site: migrateSite(siteFromDocuments(store.readVersion(version.id) ?? [])),
  }));
  const assets = store.listAssets().map((asset) => ({
    ...asset,
    bytes: [...(store.readBlob(asset.hash)?.data ?? [])],
  }));
  return {
    name: store.info.name,
    site: siteOf(store),
    versions,
    assets,
    editorMode: store.readEditorMode(),
    exportChoices: store.readExportChoices(),
    siteCheckIgnored: store.readSiteCheckIgnored(),
  };
}

/** `store`'s site through a ZIP into a new project, which is returned open. */
async function roundTrip(store: ProjectStore): Promise<ProjectStore> {
  const dir = tempDir();
  const zip = join(dir, "site.zip");
  await writeSiteZip(store, zip);
  const site = readSiteZip(readFileSync(zip));
  const copy = ProjectStore.create(join(dir, "copy.wforge"), { name: site.name });
  fillFromSiteZip(copy, site);
  return copy;
}

/** What a generated project holds, beyond its starting site. */
type Plan = {
  readonly name: string;
  readonly heading: string;
  readonly images: readonly { readonly bytes: Uint8Array; readonly name: string }[];
  /** A file kept with the site's code (3.9), named by its hash in the site's code only. */
  readonly bundled: Uint8Array | null;
  readonly versions: readonly { readonly name: string; readonly kind: "manual" | "auto" }[];
  readonly content: boolean;
  readonly ignored: readonly string[];
};

const planArbitrary: fc.Arbitrary<Plan> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 40 }).filter((name) => name.trim() !== ""),
  heading: fc.string({ maxLength: 60 }),
  images: fc.array(
    fc.record({
      bytes: fc.uint8Array({ minLength: 1, maxLength: 64 }),
      // Any name a computer gives a file, slashes aside: the ZIP's entry name is made safe.
      name: fc.string({ minLength: 1, maxLength: 30 }).filter((name) => !/[/\\]/.test(name)),
    }),
    { maxLength: 3 },
  ),
  bundled: fc.option(fc.uint8Array({ minLength: 1, maxLength: 64 }), { nil: null }),
  versions: fc.array(
    fc.record({
      name: fc.string({ maxLength: 30 }),
      kind: fc.constantFrom("manual" as const, "auto" as const),
    }),
    { maxLength: 3 },
  ),
  content: fc.boolean(),
  ignored: fc.array(fc.stringMatching(/^[a-zA-Z]{1,10}:[a-z0-9-]{1,10}$/), { maxLength: 3 }),
});

/** A plan with nothing beyond the starting site. */
const PLAIN: Plan = {
  name: "Rosa's",
  heading: "Home",
  images: [],
  bundled: null,
  versions: [],
  content: false,
  ignored: [],
};

/** A new project filled as `plan` says, its site changed before each version. */
function projectFrom(plan: Plan): ProjectStore {
  const store = ProjectStore.create(join(tempDir(), "site.wforge"), { name: plan.name });
  const site: SiteDoc = createSite({
    name: plan.name,
    language: "en",
    homeTitle: plan.heading === "" ? "Home" : plan.heading,
    notFoundTitle: "Not found",
  });
  plan.images.forEach((image, index) => {
    const id = `photo-${index}` as MediaId;
    const { hash } = store.putAsset({
      mediaId: id,
      data: image.bytes,
      mime: "image/png",
      width: 10 + index,
      height: 20,
      originalName: image.name,
    });
    site.media[id] = {
      id,
      kind: "image",
      hash,
      name: `photo-${index}`,
      fileName: image.name,
      mimeType: "image/png",
      width: 10 + index,
      height: 20,
      alt: "",
    };
  });
  if (plan.bundled !== null) {
    const hash = store.putBlob(plan.bundled, "text/javascript");
    site.code.bundled = [
      { url: "https://cdn.example.com/lib.js", file: "lib.js", hash, mime: "text/javascript" },
    ];
  }
  store.saveSite(site);
  plan.versions.forEach((version, index) => {
    store.saveVersion(version.name, version.kind);
    const home = site.pages[site.homePageId];
    if (home !== undefined) home.title = `${home.title} ${index}`;
    store.saveSite(site);
  });
  if (plan.content) store.writeEditorMode("content");
  store.writeSiteCheckIgnored(plan.ignored);
  return store;
}

/** A new project at `path` whose site has one photo in Media, `shop`, named `fileName`. */
function bakeryWithPhoto(path: string, fileName: string): ProjectStore {
  const store = ProjectStore.create(path, { name: "Rosa's Bakery" });
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Oops",
  });
  const { hash } = store.putAsset({
    mediaId: "shop",
    data: heroPhoto(),
    mime: "image/jpeg",
    width: 1600,
    height: 1000,
    originalName: fileName,
  });
  const id = "shop" as MediaId;
  site.media[id] = {
    id,
    kind: "image",
    hash,
    name: "shop",
    fileName,
    mimeType: "image/jpeg",
    width: 1600,
    height: 1000,
    alt: "",
  };
  store.saveSite(site);
  return store;
}

describe("a site's ZIP (4.7)", () => {
  it("opens again with nothing lost: the site, Media, files, versions and choices", async () => {
    // Each run writes two site files and a ZIP: slow while the whole suite runs at once.
    await fc.assert(
      fc.asyncProperty(planArbitrary, async (plan) => {
        const store = projectFrom(plan);
        const copy = await roundTrip(store);
        try {
          expect(contents(copy)).toEqual(contents(store));
          // The file the site's code names, though no Media item holds it.
          for (const bundled of copy.readSite().code.bundled ?? []) {
            expect(copy.readBlob(bundled.hash)?.data).toEqual(store.readBlob(bundled.hash)?.data);
          }
          // Each version's documents, as Version History reads them.
          for (const { id } of store.listVersions()) {
            expect(copy.readVersion(id)).toEqual(store.readVersion(id));
          }
        } finally {
          store.close();
          copy.close();
        }
      }),
      { numRuns: 25 },
    );
  }, 120_000);

  it("opens the format 1 fixture's site again with nothing lost", async () => {
    const store = ProjectStore.open(copyWforgeFixture(1, tempDir()));
    const copy = await roundTrip(store);

    expect(contents(copy)).toEqual(contents(store));
    store.close();
    copy.close();
  });

  it("gives the new site its own project id, so publishing tells it from the original (A8)", async () => {
    const store = projectFrom(PLAIN);
    const copy = await roundTrip(store);

    expect(copy.info.projectId).not.toBe(store.info.projectId);
    store.close();
    copy.close();
  });

  it("writes the same ZIP for the same site, readable entries listed in its manifest", () => {
    const store = bakeryWithPhoto(join(tempDir(), "site.wforge"), "Shop: front?.jpg");
    const version = store.saveVersion("First", "manual");

    const entries = siteZipEntries(store);
    const paths = [...entries.keys()];
    expect(paths[0]).toBe(SITE_ZIP_MANIFEST);
    // The site, and each version, as one indented JSON file.
    expect(new TextDecoder().decode(entries.get("site.json"))).toMatch(/^\{\n {2}"/);
    expect(paths).toContain(`versions/${version.id}.json`);
    // The original, under a name any system can unpack.
    expect(paths).toContain("media/shop/Shop- front-.jpg");
    expect([...(entries.get("media/shop/Shop- front-.jpg") ?? [])]).toEqual([...heroPhoto()]);
    const manifest = JSON.parse(new TextDecoder().decode(entries.get(SITE_ZIP_MANIFEST)));
    expect(manifest.media).toEqual([
      expect.objectContaining({ mediaId: "shop", width: 1600, height: 1000 }),
    ]);
    expect(manifest.project).toEqual({
      editorMode: "design",
      exportChoices: store.readExportChoices(),
      siteCheckIgnored: [],
    });
    expect(siteZipEntries(store)).toEqual(entries);
    store.close();
  });

  it("carries only the Media the site or a version reaches, as garbage collection keeps", () => {
    const store = bakeryWithPhoto(join(tempDir(), "site.wforge"), "shop.jpg");
    store.putAsset({
      mediaId: "unused",
      data: heroPhoto().slice(0, 100),
      mime: "image/jpeg",
      originalName: "old.jpg",
    });

    const paths = [...siteZipEntries(store).keys()];

    expect(paths.filter((path) => path.startsWith("media/"))).toEqual(["media/shop/shop.jpg"]);
    store.close();
  });

  it("carries two Media items that share an original, the same file imported twice", async () => {
    const store = bakeryWithPhoto(join(tempDir(), "site.wforge"), "shop.jpg");
    const site = siteOf(store);
    const again = store.putAsset({
      mediaId: "again",
      data: heroPhoto(),
      mime: "image/jpeg",
      width: 1600,
      height: 1000,
      originalName: "shop copy.jpg",
    });
    const id = "again" as MediaId;
    const shop = site.media["shop" as MediaId];
    if (shop?.kind !== "image") throw new Error("No shop photo");
    site.media[id] = { ...shop, id, name: "again", fileName: "shop copy.jpg", hash: again.hash };
    store.saveSite(site);

    const copy = await roundTrip(store);

    expect(copy.listAssets().map((asset) => asset.mediaId)).toEqual(["again", "shop"]);
    expect(contents(copy)).toEqual(contents(store));
    store.close();
    copy.close();
  });
});

describe("a site package (A26)", () => {
  it("names the blobs a site's documents reach", () => {
    const hash = "a".repeat(64);
    expect([
      ...reachableBlobs([{ content: { media: { x: { hash } } } }, { content: "b" }]),
    ]).toEqual([hash]);
  });

  it("opens a site, such as a version, as a new site with only what it reaches", () => {
    const dir = tempDir();
    const store = bakeryWithPhoto(join(dir, "site.wforge"), "shop.jpg");
    const site = siteOf(store);
    const withPhoto = sitePackageOf(store, site);

    expect(withPhoto.media.map((item) => item.mediaId)).toEqual(["shop"]);
    expect(sitePackageOf(store, { ...site, media: {} }).media).toEqual([]);
    const copy = ProjectStore.create(join(dir, "copy.wforge"), { name: "Copy" });
    fillFromSitePackage(copy, withPhoto);
    expect(copy.readSite()).toEqual(site);
    expect(copy.readAsset("shop")).toMatchObject({ width: 1600, height: 1000 });
    store.close();
    copy.close();
  });
});

describe("opening a ZIP that isn't a site's (4.7)", () => {
  /** A site's ZIP entries, as written, with `change` made to them. */
  function changedZip(change: (entries: Record<string, Uint8Array>) => void): Uint8Array {
    const store = bakeryWithPhoto(join(tempDir(), "site.wforge"), "a.jpg");
    store.saveVersion("First", "manual");
    const entries = Object.fromEntries(siteZipEntries(store));
    store.close();
    change(entries);
    return zipSync(entries);
  }
  const manifestOf = (entries: Record<string, Uint8Array>) =>
    JSON.parse(new TextDecoder().decode(entries[SITE_ZIP_MANIFEST])) as Record<string, unknown>;
  const withManifest = (entries: Record<string, Uint8Array>, changes: Record<string, unknown>) => {
    entries[SITE_ZIP_MANIFEST] = strToU8(JSON.stringify({ ...manifestOf(entries), ...changes }));
  };
  const codeOf = (data: Uint8Array) => {
    try {
      readSiteZip(data);
    } catch (error) {
      if (error instanceof SiteZipError) return error.code;
      throw error;
    }
    return "read";
  };

  it("reads the site's ZIP as it was written", () => {
    expect(codeOf(changedZip(() => undefined))).toBe("read");
  });

  it("refuses a file that isn't a ZIP, or a ZIP without a site's manifest", () => {
    expect(codeOf(strToU8("Not a ZIP at all"))).toBe("not-a-site-zip");
    expect(codeOf(zipArchive([{ name: "photo.jpg", data: "pretend" }]))).toBe("not-a-site-zip");
    expect(
      codeOf(zipArchive([{ name: SITE_ZIP_MANIFEST, data: '{"format":"something-else"}' }])),
    ).toBe("not-a-site-zip");
  });

  it("refuses one from a newer app, or with a site of a newer format", () => {
    expect(codeOf(changedZip((entries) => withManifest(entries, { version: 99 })))).toBe(
      "newer-format",
    );
    expect(
      codeOf(
        changedZip((entries) => {
          const site = JSON.parse(new TextDecoder().decode(entries["site.json"]));
          entries["site.json"] = strToU8(JSON.stringify({ ...site, formatVersion: 999 }));
        }),
      ),
    ).toBe("newer-format");
  });

  it("refuses one with a changed or missing file, or a site or version that isn't one", () => {
    expect(
      codeOf(
        changedZip((entries) => {
          entries["media/shop/a.jpg"] = strToU8("not the photo");
        }),
      ),
    ).toBe("damaged");
    expect(
      codeOf(
        changedZip((entries) => {
          delete entries["site.json"];
        }),
      ),
    ).toBe("damaged");
    expect(
      codeOf(
        changedZip((entries) => {
          entries["site.json"] = strToU8('{"not":"a site"}');
        }),
      ),
    ).toBe("damaged");
    expect(
      codeOf(
        changedZip((entries) => {
          const [version] = manifestOf(entries).versions as { path: string }[];
          if (version !== undefined) entries[version.path] = strToU8("[]");
        }),
      ),
    ).toBe("damaged");
    expect(codeOf(changedZip((entries) => withManifest(entries, { project: {} })))).toBe("damaged");
  });

  it("refuses an entry claiming to unpack to more than it can, before unpacking anything", () => {
    /** `zip` with entry `name`'s unpacked size, in its local and central headers, said as `size`. */
    const claiming = (zip: Uint8Array, name: string, size: number) => {
      const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
      const named = (at: number, length: number) =>
        new TextDecoder().decode(zip.subarray(at, at + length)) === name;
      for (let at = 0; at + 46 <= zip.byteLength; at += 1) {
        const signature = view.getUint32(at, true);
        if (signature === 0x04034b50 && named(at + 30, view.getUint16(at + 26, true))) {
          view.setUint32(at + 22, size, true);
        } else if (signature === 0x02014b50 && named(at + 46, view.getUint16(at + 28, true))) {
          view.setUint32(at + 24, size, true);
        }
      }
      return zip;
    };
    const entries = (() => {
      let kept: Record<string, Uint8Array> = {};
      changedZip((all) => {
        kept = all;
      });
      return kept;
    })();

    // A deflated entry of a few hundred bytes claiming a GiB: fflate would allocate it first.
    const lying = claiming(zipSync(entries), "site.json", 2 ** 30);
    expect(codeOf(lying)).toBe("damaged");
    // Refused from the headers, in the first pass, not by an unpacking that went wrong.
    expect(() => readSiteZip(lying)).toThrow("claims more than it can unpack");
    // A stored entry is exactly its own size.
    const stored = zipSync({
      ...entries,
      "site.json": [entries["site.json"] ?? strToU8(""), { level: 0 }],
    });
    const size = (entries["site.json"] ?? strToU8("")).byteLength;
    expect(codeOf(claiming(stored.slice(), "site.json", size + 1))).toBe("damaged");
    expect(codeOf(stored)).toBe("read");
  });

  it("refuses one listing two versions or Media items with one id, or one entry twice", () => {
    const listed = (entries: Record<string, Uint8Array>) => manifestOf(entries);
    expect(
      codeOf(
        changedZip((entries) => {
          const versions = listed(entries).versions as unknown[];
          withManifest(entries, { versions: [...versions, ...versions] });
        }),
      ),
    ).toBe("damaged");
    expect(
      codeOf(
        changedZip((entries) => {
          const media = listed(entries).media as { path: string }[];
          withManifest(entries, {
            media: [...media, ...media.map((item) => ({ ...item, mediaId: "other" }))],
          });
        }),
      ),
    ).toBe("damaged");
  });

  it("unpacks only what its manifest lists", () => {
    const zip = changedZip((entries) => {
      entries["../outside.txt"] = strToU8("never read");
    });
    expect(codeOf(zip)).toBe("read");
  });

  it("leaves what was at the destination when the site can't be written", async () => {
    const dir = tempDir();
    const store = ProjectStore.create(join(dir, "site.wforge"), { name: "Rosa's" });
    const destination = join(dir, "site.zip");
    writeFileSync(destination, "before");
    store.close();

    await expect(writeSiteZip(store, destination)).rejects.toThrow();

    expect(readFileSync(destination, "utf8")).toBe("before");
    expect(readdirSync(dir).sort()).toEqual(["site.wforge", "site.zip"]);
  });
});
