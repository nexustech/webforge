import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedDocuments, createSite, type MediaId, type SiteDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectSession } from "./project-session.js";

// Version History's Clean up while the site is open (4.6, option B): it keeps what Undo can bring
// back and what a publish holds, and gives the rest back to the disk.

let dir: string;
let path: string;
let session: ProjectSession;

/** The first bytes of a PNG of `width` × `height`: enough for Media to take it. */
function pngOf(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(4096);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

const SHOP = "shop" as MediaId;
const PHOTO = pngOf(40, 30);

/** `site` with an image Media item `id` of `hash`. */
function withImage(site: SiteDoc, id: MediaId, hash: string): SiteDoc {
  return {
    ...site,
    media: {
      ...site.media,
      [id]: {
        id,
        kind: "image",
        hash,
        name: id,
        fileName: `${id}.png`,
        mimeType: "image/png",
        width: 40,
        height: 30,
        alt: "",
      },
    },
  };
}

/** `site` without Media item `id`. */
function without(site: SiteDoc, id: MediaId): SiteDoc {
  const { [id]: _gone, ...media } = site.media;
  return { ...site, media };
}

const blank = () =>
  createSite({ name: "Bakery", language: "en", homeTitle: "Home", notFoundTitle: "Not found" });

/**
 * A site file whose site has `shop` in Media, beside 5 MB that nothing names: what earlier
 * openings left, which Clean up gives back.
 */
function siteFile(): { readonly site: SiteDoc; readonly hash: string } {
  const store = ProjectStore.create(path, { name: "Bakery" });
  const { hash } = store.putAsset({
    mediaId: SHOP,
    data: PHOTO,
    mime: "image/png",
    originalName: "shop.png",
  });
  const site = withImage(blank(), SHOP, hash);
  store.saveSite(site);
  store.putBlob(new Uint8Array(5 * 1024 * 1024).fill(9), "image/png");
  store.close();
  return { site, hash };
}

const sessionId = () => session.current()?.sessionId ?? "";
const scoped = () => session.forSession(sessionId());

async function save(from: SiteDoc, to: SiteDoc): Promise<void> {
  expect(await session.commit(changedDocuments(from, to), sessionId())).toEqual({
    status: "saved",
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-clean-up-"));
  path = join(dir, "Bakery.wforge");
  session = new ProjectSession();
  // Failures are logged by design; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await session.close();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe("Clean up while the site is open (4.6)", () => {
  it("keeps an image deleted and saved since the site opened, which Undo brings back", async () => {
    const { site, hash } = siteFile();
    await session.open(path);
    await session.readSite();

    // The image deleted from Media, and the change saved.
    const deleted = without(site, SHOP);
    await save(site, deleted);
    const cleaned = await session.cleanUp(sessionId());
    // Undo puts it back, and autosave saves that.
    await save(deleted, site);

    expect(cleaned).toMatchObject({ status: "cleaned" });
    expect(cleaned.status === "cleaned" ? cleaned.freedBytes : 0).toBeGreaterThan(4 * 1024 * 1024);
    expect([...((await scoped().readMedia(hash))?.data ?? [])]).toEqual([...PHOTO]);
  });

  it("keeps an image imported since the site opened, though its Media item has gone", async () => {
    siteFile();
    await session.open(path);
    const site = (await session.readSite()) as { readonly site: SiteDoc };
    const imported = await scoped().importFile("added", "added.png", { data: pngOf(80, 60) });
    if (imported.status !== "stored") throw new Error("not imported");
    const added = withImage(site.site, "added" as MediaId, imported.hash);
    await save(site.site, added);
    await save(added, site.site);

    await session.cleanUp(sessionId());
    await save(site.site, added);

    expect([...((await scoped().readMedia(imported.hash))?.data ?? [])]).toEqual([
      ...pngOf(80, 60),
    ]);
  });

  it("keeps what a version read to restore reaches, after the version is deleted", async () => {
    // Only a version has the image: the site lost it in an earlier opening.
    const store = ProjectStore.create(path, { name: "Bakery" });
    const { hash } = store.putAsset({
      mediaId: SHOP,
      data: PHOTO,
      mime: "image/png",
      originalName: "shop.png",
    });
    store.saveSite(withImage(blank(), SHOP, hash));
    const version = store.saveVersion("With the photo", "manual");
    store.saveSite(blank());
    store.close();
    await session.open(path);

    expect(await scoped().readVersionSite(version.id)).toMatchObject({ status: "ok" });
    await scoped().deleteVersion(version.id);
    await session.cleanUp(sessionId());

    expect([...((await scoped().readMedia(hash))?.data ?? [])]).toEqual([...PHOTO]);
  });

  it("keeps the documents a publish holds until it lets go of them (4.5)", async () => {
    const { site } = siteFile();
    await session.open(path);
    await session.readSite();
    const named = (name: string): SiteDoc => ({
      ...site,
      settings: { ...site.settings, general: { ...site.settings.general, name } },
    });
    // Published after a change: its documents are neither the site as it opened nor as it is.
    await save(site, named("Rosa's"));
    const reader = ProjectStore.open(path, { readOnly: true });
    const published = reader.readManifest();
    reader.close();
    const release = session.holdManifest(published);
    await save(named("Rosa's"), named("Rosa's Bakery"));
    const publishVersion = () =>
      scoped().saveVersion({
        name: "",
        reason: "on-publish",
        thumbnail: undefined,
        kept: 20,
        documents: published,
      });

    await session.cleanUp(sessionId());
    expect(await publishVersion()).toMatchObject({ status: "saved" });

    // Let go of, they're cleaned up like any other.
    const second = session.holdManifest(published);
    second();
    release();
    await scoped().deleteVersion(
      ((await scoped().listVersions()) as { versions: { id: string }[] }).versions[0]?.id ?? "",
    );
    await session.cleanUp(sessionId());
    expect(await publishVersion()).toMatchObject({ status: "failed" });
  });

  it("does nothing for another opening, or without a site", async () => {
    expect(await session.cleanUp("9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d")).toEqual({
      status: "failed",
      reason: "no-site",
    });
    siteFile();
    await session.open(path);
    expect(await session.cleanUp("9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d")).toEqual({
      status: "failed",
      reason: "stale-session",
    });
  });
});
