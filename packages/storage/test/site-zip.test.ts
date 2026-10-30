import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSite, type MediaId, type SiteDoc } from "@webforge/model";
import { copyWforgeFixture, heroPhoto, zipArchive } from "@webforge/test-utils";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import fc from "fast-check";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  fillFromSiteZip,
  ProjectStore,
  readSiteZip,
  SITE_ZIP_MANIFEST,
  SiteZipError,
  siteZipEntries,
  writeSiteZip,
} from "../src/index.js";

// A site saved as a ZIP and opened again (4.7, F-SITE-5): nothing lost on the way.

const tempDir = tempDirFactory();
const sha = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

/** Everything a project holds that the app reads: its documents, Media, files, versions, settings. */
function contents(store: ProjectStore) {
  const documents = store.readDocuments();
  const versions = store.listVersions().map((version) => ({
    version,
    documents: store.readVersion(version.id),
  }));
  const assets = store.listAssets().map((asset) => ({
    ...asset,
    bytes: [...(store.readBlob(asset.hash)?.data ?? [])],
  }));
  return {
    name: store.info.name,
    documents,
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

describe("a site's ZIP (4.7)", () => {
  it("opens again with nothing lost: documents, Media, files, versions and settings", async () => {
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
          expect(copy.readSite()).toEqual(store.readSite());
        } finally {
          store.close();
          copy.close();
        }
      }),
      { numRuns: 25 },
    );
  });

  it("opens the format 1 fixture's site again with nothing lost", async () => {
    const store = ProjectStore.open(copyWforgeFixture(1, tempDir()));
    const copy = await roundTrip(store);

    expect(contents(copy)).toEqual(contents(store));
    store.close();
    copy.close();
  });

  it("writes the same ZIP for the same site, readable entries listed in its manifest", () => {
    const store = ProjectStore.create(join(tempDir(), "site.wforge"), { name: "Rosa's Bakery" });
    const site = createSite({
      name: "Rosa's Bakery",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Oops",
    });
    store.putAsset({
      mediaId: "shop",
      data: heroPhoto(),
      mime: "image/jpeg",
      width: 1600,
      height: 1000,
      originalName: "Shop: front?.jpg",
    });
    store.saveSite(site);
    store.saveVersion("First", "manual");

    const entries = siteZipEntries(store);
    const paths = [...entries.keys()];
    expect(paths[0]).toBe(SITE_ZIP_MANIFEST);
    // The site's documents as indented JSON; a version's unchanged documents aren't written again.
    expect(paths.filter((path) => path.startsWith("site/"))).toContain("site/site.json");
    expect(paths.filter((path) => path.startsWith("versions/"))).toEqual([]);
    expect(new TextDecoder().decode(entries.get("site/theme.json"))).toMatch(/^\{\n {2}"/);
    // The original, under a name any system can unpack.
    expect(paths).toContain("media/shop/Shop- front-.jpg");
    expect([...(entries.get("media/shop/Shop- front-.jpg") ?? [])]).toEqual([...heroPhoto()]);
    expect(siteZipEntries(store)).toEqual(entries);
    store.close();
  });
});

describe("opening a ZIP that isn't a site's (4.7)", () => {
  /** A site's ZIP entries, as written, with `change` made to them. */
  function changedZip(change: (entries: Record<string, Uint8Array>) => void): Uint8Array {
    const store = ProjectStore.create(join(tempDir(), "site.wforge"), { name: "Rosa's" });
    store.saveSite(
      createSite({ name: "Rosa's", language: "en", homeTitle: "Home", notFoundTitle: "Oops" }),
    );
    store.putAsset({
      mediaId: "shop",
      data: heroPhoto(),
      mime: "image/jpeg",
      originalName: "a.jpg",
    });
    const entries = Object.fromEntries(siteZipEntries(store));
    store.close();
    change(entries);
    return zipSync(entries);
  }
  const manifestOf = (entries: Record<string, Uint8Array>) =>
    JSON.parse(new TextDecoder().decode(entries[SITE_ZIP_MANIFEST])) as Record<string, unknown>;
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

  it("refuses one from a newer app", () => {
    expect(
      codeOf(
        changedZip((entries) => {
          entries[SITE_ZIP_MANIFEST] = strToU8(
            JSON.stringify({ ...manifestOf(entries), version: 99 }),
          );
        }),
      ),
    ).toBe("newer-format");
  });

  it("refuses one with a changed or missing file, or documents that make no site", () => {
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
          delete entries["site/theme.json"];
        }),
      ),
    ).toBe("damaged");
    expect(
      codeOf(
        changedZip((entries) => {
          entries["site/theme.json"] = strToU8('{"not":"a theme"}');
        }),
      ),
    ).toBe("damaged");
    expect(
      codeOf(
        changedZip((entries) => {
          entries[SITE_ZIP_MANIFEST] = strToU8(
            JSON.stringify({ ...manifestOf(entries), documents: [{ id: "x", kind: "x" }] }),
          );
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
