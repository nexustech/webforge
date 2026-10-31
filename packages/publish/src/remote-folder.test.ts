import { describe, expect, it } from "vitest";
import { manifestOf, type PublishedSite } from "./manifest.js";
import type { BuildOutput, PublishEvent } from "./publisher.js";
import {
  MANIFEST_FILE,
  publishToFolder,
  type RemoteFolder,
  uploadPathFor,
} from "./remote-folder.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (data: Uint8Array | undefined) => new TextDecoder().decode(data);
const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, content]) => [path, bytes(content)])),
});

/** A folder in memory that records each write and removal, in order. */
function memoryFolder(files: Record<string, string> = {}) {
  const stored = new Map<string, Uint8Array>(
    Object.entries(files).map(([path, content]) => [path, bytes(content)]),
  );
  const log: string[] = [];
  const folder: RemoteFolder = {
    read: async (path) => stored.get(path),
    write: async (path, data) => {
      log.push(`write ${path}`);
      stored.set(path, data);
    },
    remove: async (path) => {
      log.push(`remove ${path}`);
      stored.delete(path);
    },
  };
  const manifest = () => JSON.parse(text(stored.get(MANIFEST_FILE))) as { files: object };
  return { folder, stored, log, manifest };
}

/** The site publishing in these tests, and the time it publishes at. */
const rosas: PublishedSite = { projectId: "rosas-bakery", destinationId: "live" };
const AT = new Date("2026-10-31T10:00:00.000Z");
const publishing = (site = rosas, replaceOtherSite = false) => ({
  site,
  url: "https://example.com/",
  now: () => AT,
  ...(replaceOtherSite ? { replaceOtherSite } : {}),
});

async function run(
  folder: RemoteFolder,
  files: Record<string, string>,
  signal = new AbortController().signal,
  as = publishing(),
) {
  const events: PublishEvent[] = [];
  for await (const event of publishToFolder(folder, build(files), signal, as)) {
    events.push(event);
  }
  return events;
}

const site = {
  "index.html": "home",
  "about.html": "about",
  "assets/css/site.css": "css",
  "assets/images/shop.webp": "image",
};

describe("publishToFolder", () => {
  it("uploads every file on a first publish, assets first and the home page last", async () => {
    const { folder, log, manifest } = memoryFolder();

    const events = await run(folder, site);

    expect(log).toEqual([
      // Lists the new files before they go (see the cancel tests).
      `write ${MANIFEST_FILE}`,
      "write assets/css/site.css",
      "write assets/images/shop.webp",
      "write about.html",
      "write index.html",
      `write ${MANIFEST_FILE}`,
    ]);
    expect(manifest()).toEqual(manifestOf(build(site).files, rosas, AT.toISOString()));
    expect(events.at(-1)).toEqual({
      type: "published",
      url: "https://example.com/",
      uploaded: 4,
      unchanged: 0,
      removed: 0,
    });
  });

  it("uploads only what changed, and removes only what it published, pages first", async () => {
    const host = memoryFolder({ "someone-else.txt": "theirs" });
    await run(host.folder, site);
    host.log.length = 0;

    const { "about.html": _gone, "assets/images/shop.webp": _image, ...kept } = site;
    const events = await run(host.folder, { ...kept, "index.html": "home, changed" });

    expect(host.log).toEqual([
      "write index.html",
      `write ${MANIFEST_FILE}`,
      "remove about.html",
      "remove assets/images/shop.webp",
      `write ${MANIFEST_FILE}`,
    ]);
    // A file Webforge didn't put there stays.
    expect(text(host.stored.get("someone-else.txt"))).toBe("theirs");
    expect(events.at(-1)).toMatchObject({ uploaded: 1, unchanged: 1, removed: 2 });
    expect(Object.keys(host.manifest().files)).toEqual(["index.html", "assets/css/site.css"]);
  });

  it("reports each upload, then that it is published", async () => {
    const events = await run(memoryFolder().folder, { "index.html": "home", "a.css": "css" });

    expect(events).toEqual([
      { type: "preparing" },
      { type: "uploading", path: "a.css", done: 0, total: 2 },
      { type: "uploading", path: "index.html", done: 1, total: 2 },
      expect.objectContaining({ type: "published", uploaded: 2 }),
    ]);
  });

  it("treats a damaged or foreign manifest as a first publish, removing nothing", async () => {
    for (const damaged of [
      "not json",
      '{"version":2,"files":{}}',
      '{"version":1,"files":{"../x":"0"}}',
    ]) {
      const host = memoryFolder({ [MANIFEST_FILE]: damaged, "old.html": "old" });

      const events = await run(host.folder, { "index.html": "home" });

      expect(events.at(-1)).toMatchObject({ uploaded: 1, removed: 0 });
      expect(host.stored.has("old.html")).toBe(true);
    }
  });

  it("stops before the next file when cancelled, leaving the published manifest as it was", async () => {
    const host = memoryFolder();
    await run(host.folder, site);
    const before = text(host.stored.get(MANIFEST_FILE));
    const controller = new AbortController();
    const changed = Object.fromEntries(
      Object.entries(site).map(([path, content]) => [path, `${content} v2`]),
    );

    const cancelled = publishToFolder(host.folder, build(changed), controller.signal, publishing());
    await cancelled.next(); // preparing
    await cancelled.next(); // the first upload's event
    controller.abort();

    await expect(cancelled.next()).rejects.toMatchObject({ code: "cancelled" });
    expect(text(host.stored.get(MANIFEST_FILE))).toBe(before);
    // The live home page is still the published one.
    expect(text(host.stored.get("index.html"))).toBe("home");
  });

  it("removes a new page a cancel left on the host once the site drops it", async () => {
    const host = memoryFolder();
    await run(host.folder, { "index.html": "home" });
    const controller = new AbortController();
    const write = host.folder.write;
    host.folder.write = async (path, data) => {
      await write(path, data);
      // Cancelled once the new page has landed, before the home page goes.
      if (path === "offers.html") controller.abort();
    };

    const publishing = run(
      host.folder,
      { "index.html": "home, v2", "offers.html": "offers" },
      controller.signal,
    );
    await expect(publishing).rejects.toMatchObject({ code: "cancelled" });
    host.folder.write = write;
    expect(text(host.stored.get("offers.html"))).toBe("offers");

    // The person deletes the page, then publishes again.
    const events = await run(host.folder, { "index.html": "home, v2" });

    expect(host.stored.has("offers.html")).toBe(false);
    expect(events.at(-1)).toMatchObject({ uploaded: 1, removed: 1 });
  });

  it("sends again a new file a cancel may have cut off", async () => {
    const host = memoryFolder();
    await run(host.folder, { "index.html": "home" });
    const controller = new AbortController();
    controller.abort();

    await expect(
      run(host.folder, { "index.html": "home", "offers.html": "offers" }, controller.signal),
    ).rejects.toMatchObject({ code: "cancelled" });
    const events = await run(host.folder, { "index.html": "home", "offers.html": "offers" });

    expect(events.at(-1)).toMatchObject({ uploaded: 1, unchanged: 1 });
    expect(text(host.stored.get("offers.html"))).toBe("offers");
  });

  it("still removes next time the files a cancel left behind", async () => {
    const host = memoryFolder();
    await run(host.folder, site);
    const controller = new AbortController();
    const remove = host.folder.remove;
    host.folder.remove = async (path) => {
      await remove(path);
      controller.abort();
    };

    const publishing = run(host.folder, { "index.html": "home" }, controller.signal);
    await expect(publishing).rejects.toMatchObject({ code: "cancelled" });
    host.folder.remove = remove;
    const listed = Object.keys(host.manifest().files);
    expect(listed).toContain("assets/css/site.css");

    const events = await run(host.folder, { "index.html": "home" });
    // The pending manifest still lists the page removed before the cancel; removing it again is a
    // no-op.
    expect(events.at(-1)).toMatchObject({ uploaded: 0, removed: 3 });
    expect([...host.stored.keys()].sort()).toEqual([MANIFEST_FILE, "index.html"]);
  });
});

describe("uploadPathFor", () => {
  it("records the site that published and when, in manifest version 2 (A8)", async () => {
    const { folder, manifest } = memoryFolder();

    await run(folder, site);

    expect(manifest()).toMatchObject({
      version: 2,
      site: rosas,
      publishedAt: "2026-10-31T10:00:00.000Z",
    });
  });

  it("stops with other-site before anything is written to another project's folder (A8)", async () => {
    const host = memoryFolder();
    await run(host.folder, site);
    const before = new Map(host.stored);
    host.log.length = 0;
    const other = { projectId: "draft-copy", destinationId: "live" };

    await expect(
      run(host.folder, { "index.html": "draft" }, undefined, publishing(other)),
    ).rejects.toMatchObject({
      code: "other-site",
    });
    expect(host.log).toEqual([]);
    expect(host.stored).toEqual(before);

    // Once the person agrees to replace it (4.5), it publishes over it, removing what it dropped.
    const events = await run(
      host.folder,
      { "index.html": "draft" },
      undefined,
      publishing(other, true),
    );
    expect(events.at(-1)).toMatchObject({ type: "published", removed: 3 });
    expect(host.manifest()).toMatchObject({ site: other });
  });

  it("asks before publishing over a version 1 manifest, which names no site, then makes it this site's", async () => {
    const digests = manifestOf(build(site).files, rosas, AT.toISOString()).files;
    const host = memoryFolder({
      [MANIFEST_FILE]: JSON.stringify({ version: 1, files: digests }),
      ...site,
    });

    await expect(run(host.folder, site)).rejects.toMatchObject({ code: "other-site" });
    expect(host.log).toEqual([]);

    // Once the person agrees, it reads as this site's from then on: unchanged files stay.
    const replaced = await run(host.folder, site, undefined, publishing(rosas, true));
    expect(replaced.at(-1)).toMatchObject({ uploaded: 0, unchanged: 4 });
    expect(host.manifest()).toMatchObject({ version: 2, site: rosas });
    // Another destination of the same site is the same site.
    const staging = { ...rosas, destinationId: "staging" };
    expect((await run(host.folder, site, undefined, publishing(staging))).at(-1)).toMatchObject({
      type: "published",
    });
  });

  it("names a hidden file beside the one it replaces", () => {
    expect(uploadPathFor("index.html")).toBe(".index.html.webforge-upload");
    expect(uploadPathFor("assets/css/site.css")).toBe("assets/css/.site.css.webforge-upload");
  });
});
