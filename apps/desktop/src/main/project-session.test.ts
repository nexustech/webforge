import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  changedDocuments,
  createSite,
  DEFAULT_EXPORT_CHOICES,
  DEFAULT_THEME,
  type ImageMeta,
  type MediaId,
  pageDocumentId,
  siteDocuments,
} from "@webforge/model";
import {
  FORMAT_VERSION,
  ProjectStore,
  ReadOnlyProjectError,
  readSiteZip,
  SiteFileWriter,
} from "@webforge/storage";
import { TEMPLATES_DIR } from "@webforge/templates/node";
import { heroPhoto } from "@webforge/test-utils";
import type { IpcMain } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWriterJobs } from "../worker/writer-jobs.js";
import type { NewSiteTarget } from "./new-site.js";
import { registerProjectHandlers } from "./project-ipc.js";
import { CLEAN_UP_WAIT_MS, ProjectSession, type SiteStoreAccess } from "./project-session.js";
import { findProjectArgument, withProjectExtension } from "./site-paths.js";
import { createStorageWriter, type StorageWriter } from "./storage-writer.js";
import { createStoreGate } from "./store-gate.js";

/** The open site, as a call for its opening reaches it (R6, #663). */
const scoped = (session: ProjectSession) => session.forSession(session.current()?.sessionId ?? "");

/** The first bytes of a PNG of `width` × `height`: enough for Media to take it. */
function pngOf(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

let dir: string;
let session: ProjectSession;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-desktop-"));
  session = new ProjectSession();
  // Failures are logged by design; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await session.close();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe("ProjectSession", () => {
  it("has no site until one is created or opened", () => {
    expect(session.current()).toBeNull();
  });

  it("creates a site named after its file and makes it current", async () => {
    const result = await session.create(join(dir, "Rosa's Bakery.wforge"));

    const project = {
      sessionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: "Rosa's Bakery",
      fileName: "Rosa's Bakery.wforge",
      formatVersion: FORMAT_VERSION,
      syncService: null,
    };
    expect(result).toEqual({ status: "opened", project });
    expect(session.current()).toEqual(project);
  });

  it("adds the .wforge extension when the save dialog returns a path without it", async () => {
    const result = await session.create(join(dir, "Bakery"));

    expect(result).toMatchObject({ status: "opened", project: { fileName: "Bakery.wforge" } });
  });

  it("falls back to a default name when the file name is blank", async () => {
    const result = await session.create(join(dir, " .wforge"));

    expect(result).toMatchObject({ status: "opened", project: { name: "My site" } });
  });

  it("opens an existing site", async () => {
    const path = join(dir, "site.wforge");
    await session.create(path);
    await session.close();

    expect(await session.open(path)).toMatchObject({
      status: "opened",
      project: { name: "site" },
    });
  });

  it("collects the file's garbage as the site closes, keeping what it and its versions use (A1)", async () => {
    const path = join(dir, "site.wforge");
    const site = createSite({
      name: "Rosa's",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Oops",
    });
    // A photo in Media, a version, and bytes nothing names (an import that was undone).
    const store = ProjectStore.create(path, { name: "Rosa's" });
    const { hash: photo } = store.putAsset({
      mediaId: "shop",
      data: heroPhoto(),
      mime: "image/jpeg",
      originalName: "shop.jpg",
    });
    const shop = "shop" as MediaId;
    site.media[shop] = {
      id: shop,
      kind: "image",
      hash: photo,
      name: "shop",
      fileName: "shop.jpg",
      mimeType: "image/jpeg",
      width: 1600,
      height: 1000,
      alt: "",
    };
    store.saveSite(site);
    store.saveVersion("First", "manual");
    const unused = store.putBlob(new Uint8Array([1, 2, 3]), "application/octet-stream");
    store.close();

    // The home page saved twice, as autosave does while it is edited.
    await session.open(path);
    const home = pageDocumentId(site.homePageId);
    const page = site.pages[site.homePageId];
    const saves = ["Fresh bread", "Fresh rolls"].map((title) => ({ ...page, title }));
    for (const content of saves) {
      expect(await session.commit([{ type: "put", id: home, kind: "page", content }])).toEqual({
        status: "saved",
      });
    }
    await session.close();

    const blobOf = (content: unknown) =>
      createHash("sha256").update(JSON.stringify(content)).digest("hex");
    const after = ProjectStore.open(path);
    try {
      expect(after.hasBlob(blobOf(saves[0]))).toBe(false);
      expect(after.hasBlob(unused)).toBe(false);
      expect(after.hasBlob(blobOf(saves[1]))).toBe(true);
      expect(after.hasBlob(photo)).toBe(true);
      expect(after.readAsset("shop")?.hash).toBe(photo);
      const [version] = after.listVersions();
      expect(after.readVersion(version?.id ?? "")).toContainEqual({
        id: home,
        kind: "page",
        content: JSON.parse(JSON.stringify(page)),
      });
    } finally {
      after.close();
    }
  });

  it("still closes the site when its file can't be cleaned up, and logs why", async () => {
    const path = join(dir, "site.wforge");
    await session.create(path);
    vi.spyOn(SiteFileWriter.prototype, "cleanUp").mockImplementation(() => {
      throw new Error("disk full");
    });

    await session.close();

    expect(session.current()).toBeNull();
    expect(vi.mocked(console.error)).toHaveBeenCalled();
    // The file is closed: another connection can open it for writing.
    ProjectStore.open(path).close();
  });

  it("leaves the file of a site opened and closed unchanged as it was: no sync, no backup", async () => {
    const path = join(dir, "site.wforge");
    await session.create(path);
    await session.close();
    const before = readFileSync(path);
    // An hour ago, so a write in this test can't share its modified time.
    const then = new Date(Date.now() - 3_600_000);
    utimesSync(path, then, then);

    await session.open(path);
    await session.close();

    expect(statSync(path).mtimeMs).toBe(then.getTime());
    expect(readFileSync(path).equals(before)).toBe(true);
  });

  it("leaves a read-only site's file alone as it closes, without logging a failure", async () => {
    const path = join(dir, "site.wforge");
    await session.create(path);
    // A store the editor shows read-only, as a newer format will be once it can show one.
    const info = Object.getOwnPropertyDescriptor(ProjectStore.prototype, "info")?.get;
    vi.spyOn(ProjectStore.prototype, "info", "get").mockImplementation(function (
      this: ProjectStore,
    ) {
      return { ...info?.call(this), readOnly: true };
    });
    const collect = vi.spyOn(ProjectStore.prototype, "collectGarbage");

    await session.close();

    expect(collect).not.toHaveBeenCalled();
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
  });

  it("replaces the current site when it creates one over the same file", async () => {
    const path = join(dir, "site.wforge");
    await session.create(path);

    // Windows can't replace a file that is open; the session closes it first.
    expect(await session.create(path)).toMatchObject({ status: "opened" });
    expect(session.current()?.fileName).toBe("site.wforge");
  });

  it("names and fills a new site from New Site before it opens (2.14a)", async () => {
    const site = createSite({
      name: "Rosa's Bakery",
      language: "en",
      homeTitle: "Home",
      notFoundTitle: "Page not found",
    });

    const photo = join(TEMPLATES_DIR, "cafe", "images", "hero.jpg");
    let stored: Awaited<ReturnType<NewSiteTarget["importFile"]>> | undefined;

    const result = await session.create(join(dir, "bakery.wforge"), {
      name: "Rosa's Bakery",
      fill: async ({ store, importFile }) => {
        // Into the new file, through the storage writer, before it opens.
        stored = await importFile("photo00000000000", "hero.jpg", photo);
        store.saveSite(site);
      },
    });

    expect(result).toMatchObject({
      status: "opened",
      project: { name: "Rosa's Bakery", fileName: "bakery.wforge" },
    });
    expect(await session.readSite()).toEqual({ status: "ok", site });
    expect(stored).toMatchObject({ status: "stored" });
    const sessionId = session.current()?.sessionId ?? "";
    const hash = stored?.status === "stored" ? stored.hash : "";
    const media = await session.forSession(sessionId).readMedia(hash);
    expect(new Uint8Array(media?.data ?? [])).toEqual(new Uint8Array(readFileSync(photo)));
  });

  it("keeps the current site, and closes the new file, when filling it fails (2.14a)", async () => {
    await session.create(join(dir, "good.wforge"));
    let filled: ProjectStore | undefined;

    const result = await session.create(join(dir, "new.wforge"), {
      name: "New",
      fill: async ({ store }) => {
        filled = store;
        throw new Error("A template's image is missing");
      },
    });

    expect(result).toEqual({ status: "failed", reason: "unknown" });
    expect(session.current()?.fileName).toBe("good.wforge");
    // Closed: its file can be deleted, which Windows refuses while it is open.
    expect(() => filled?.readDocuments()).toThrow();
  });

  it("saves a copy of the open site as a ZIP that opens again as a new site (4.7)", async () => {
    await session.create(join(dir, "Rosa's Bakery.wforge"));
    await session.commit(
      siteDocuments(
        createSite({ name: "Rosa's", language: "en", homeTitle: "Home", notFoundTitle: "Oops" }),
      ).map((document) => ({ type: "put" as const, ...document })),
    );
    const zip = join(dir, "copy.zip");

    expect(await scoped(session).saveSiteZip(zip)).toEqual({
      status: "saved",
      fileName: "copy.zip",
    });
    const site = readSiteZip(readFileSync(zip));
    expect(site.name).toBe("Rosa's Bakery");
    expect(site.sitePackage.site.settings.general.name).toBe("Rosa's");
  });

  it("saves no copy over the open site's own file, nor the files beside it (4.7)", async () => {
    const site = join(dir, "Rosa's Bakery.wforge");
    await session.create(site);

    for (const path of [
      site,
      `${site}-wal`,
      `${site}-journal`,
      join(dir, ".", "Rosa's Bakery.wforge"),
    ]) {
      expect(await scoped(session).saveSiteZip(path), path).toEqual({
        status: "failed",
        reason: "own-file",
      });
    }
    // The site is still there, and still opens.
    expect(session.current()?.fileName).toBe("Rosa's Bakery.wforge");
    expect((await session.readSite()).status).not.toBe("failed");
  });

  it("saves no copy without an open site, nor over a folder (4.7)", async () => {
    expect(await scoped(session).saveSiteZip(join(dir, "copy.zip"))).toEqual({
      status: "failed",
      reason: "no-site",
    });
    await session.create(join(dir, "site.wforge"));
    mkdirSync(join(dir, "folder.zip"));
    expect(await scoped(session).saveSiteZip(join(dir, "folder.zip"))).toEqual({
      status: "failed",
      reason: "unknown",
    });
  });

  it("keeps the current site when another one fails to open", async () => {
    await session.create(join(dir, "good.wforge"));
    const bad = join(dir, "bad.wforge");
    writeFileSync(bad, "not a database");

    expect(await session.open(bad)).toEqual({ status: "failed", reason: "not-a-project" });
    expect(await session.open(join(dir, "missing.wforge"))).toEqual({
      status: "failed",
      reason: "not-found",
    });
    expect(session.current()?.fileName).toBe("good.wforge");
  });

  it("asks for an update instead of opening a site from a newer Webforge", async () => {
    const path = join(dir, "newer.wforge");
    await session.create(path);
    await session.close();
    const store = ProjectStore.open(path);
    const close = vi.spyOn(store, "close");
    vi.spyOn(store, "info", "get").mockReturnValue({ ...store.info, newerFormat: true });
    vi.spyOn(ProjectStore, "open").mockReturnValue(store);

    expect(await session.open(path)).toEqual({ status: "failed", reason: "newer-format" });
    expect(session.current()).toBeNull();
    expect(close).toHaveBeenCalled();
  });

  it("reports other errors as unknown without logging the path", async () => {
    const folder = join(dir, "a-folder.wforge");
    mkdirSync(folder);

    expect(await session.create(folder)).toEqual({ status: "failed", reason: "unknown" });
    for (const [message] of vi.mocked(console.error).mock.calls) {
      expect(String(message)).not.toContain(dir);
    }
  });
});

describe("ProjectSession sessions (R6, #239)", () => {
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  });
  const idOf = (result: Awaited<ReturnType<ProjectSession["open"]>>) =>
    result.status === "opened" ? result.project.sessionId : "";

  it("gives each opening its own session, and calls one stale once another site opens", async () => {
    expect(
      session.staleReason(idOf(await session.create(join(dir, "none.wforge")))),
    ).toBeUndefined();
    await session.close();
    expect(session.staleReason("anything")).toBe("no-site");

    const first = idOf(await session.create(join(dir, "a.wforge")));
    expect(session.current()?.sessionId).toBe(first);
    const second = idOf(await session.create(join(dir, "b.wforge")));

    expect(second).not.toBe(first);
    expect(session.staleReason(first)).toBe("stale-session");
    expect(session.staleReason(second)).toBeUndefined();
    // Opening the first site again is another opening too.
    expect(idOf(await session.open(join(dir, "a.wforge")))).not.toBe(first);
  });

  it("refuses a late save from a renderer loaded for the site a hand-off replaced", async () => {
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>();
    const ipc = {
      handle: (
        channel: string,
        handler: (event: unknown, ...args: unknown[]) => Promise<unknown>,
      ) => handlers.set(channel, handler),
    } as unknown as Pick<IpcMain, "handle">;
    registerProjectHandlers(ipc, () => true, session, {
      chooseNewProjectPath: async () => undefined,
      chooseProjectToOpen: async () => undefined,
      chooseSiteZipToSave: async () => undefined,
      chooseSiteZipToOpen: async () => undefined,
    });
    const commit = (sessionId: string, changes: unknown) =>
      handlers.get("project:commit")?.({ senderFrame: { url: "app" } }, sessionId, changes);
    const a = join(dir, "a.wforge");
    const fromA = idOf(await session.create(a));
    expect(await commit(fromA, changedDocuments(undefined, site))).toEqual({ status: "saved" });

    // Site B replaces A in the window, and A's last edit arrives only then.
    const b = join(dir, "b.wforge");
    await session.create(b);
    const page = site.pages[site.homePageId];
    if (page === undefined) throw new Error("no home page");
    const late = [{ type: "put", id: pageDocumentId(page.id), kind: "page", content: page }];

    expect(await commit(fromA, late)).toEqual({ status: "failed", reason: "stale-session" });
    expect(await session.readSite()).toEqual({ status: "empty" });
    await session.close();
    await session.open(a);
    expect(await session.readSite()).toEqual({ status: "ok", site });
  });

  it("keeps the open site, as the same opening, when a site can't be created over its file", async () => {
    const path = join(dir, "site.wforge");
    const opened = idOf(await session.create(path));
    expect(await session.commit(changedDocuments(undefined, site))).toEqual({ status: "saved" });
    vi.spyOn(ProjectStore, "create").mockImplementationOnce(() => {
      throw Object.assign(new Error("EBUSY"), { code: "EBUSY" });
    });

    expect(await session.create(path)).toEqual({ status: "failed", reason: "unknown" });

    expect(session.current()).toMatchObject({ fileName: "site.wforge", sessionId: opened });
    expect(session.staleReason(opened)).toBeUndefined();
    expect(await session.readSite()).toEqual({ status: "ok", site });
  });
});

describe("ProjectSession site documents", () => {
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  });

  it("reports no site and an empty new site", async () => {
    expect(await session.readSite()).toEqual({ status: "none" });
    expect(await session.commit([])).toEqual({ status: "failed", reason: "no-site" });

    await session.create(join(dir, "new.wforge"));
    expect(await session.readSite()).toEqual({ status: "empty" });
  });

  it("saves the first pages of a new site and reads them back after reopening", async () => {
    const path = join(dir, "site.wforge");
    await session.create(path);

    expect(await session.commit(changedDocuments(undefined, site))).toEqual({ status: "saved" });
    await session.close();
    await session.open(path);

    expect(await session.readSite()).toEqual({ status: "ok", site });
  });

  it("refuses changes that would break the site and keeps the file as it was", async () => {
    const path = join(dir, "site.wforge");
    await session.create(path);
    await session.commit(changedDocuments(undefined, site));

    const deleteHome = [{ type: "delete" as const, id: pageDocumentId(site.homePageId) }];
    expect(await session.commit(deleteHome)).toEqual({ status: "failed", reason: "invalid" });
    const badTheme = [{ type: "put" as const, id: "theme", kind: "theme" as const, content: {} }];
    expect(await session.commit(badTheme)).toEqual({ status: "failed", reason: "invalid" });

    await session.close();
    await session.open(path);
    expect(await session.readSite()).toEqual({ status: "ok", site });
  });

  it("builds on the stored site when changes arrive before the editor read it", async () => {
    const path = join(dir, "site.wforge");
    await session.create(path);
    await session.commit(changedDocuments(undefined, site));
    await session.close();
    await session.open(path);

    const next = { ...site, theme: { ...DEFAULT_THEME, preset: "cupcake" } };
    expect(await session.commit(changedDocuments(site, next))).toEqual({ status: "saved" });
    expect(await session.readSite()).toEqual({ status: "ok", site: next });
  });

  it("reports a site whose documents are broken without throwing", async () => {
    const path = join(dir, "site.wforge");
    await session.create(path);
    await session.close();
    const store = ProjectStore.open(path);
    store.commit([{ type: "put", id: "site", kind: "site", content: { formatVersion: 99 } }]);
    store.close();
    await session.open(path);

    expect(await session.readSite()).toEqual({ status: "failed", reason: "newer-format" });
    expect(await session.commit([])).toEqual({ status: "failed", reason: "invalid" });
  });
});

describe("ProjectSession export choices (3.3)", () => {
  it("gives the defaults without a site, and remembers them with the open site", async () => {
    expect(await scoped(session).exportChoices()).toEqual(DEFAULT_EXPORT_CHOICES);
    // Without a site there is nothing to remember them in, and nothing fails.
    await scoped(session).setExportChoices({ ...DEFAULT_EXPORT_CHOICES, format: "zip" });

    const path = join(dir, "Bakery.wforge");
    await session.create(path);
    expect(await scoped(session).exportChoices()).toEqual(DEFAULT_EXPORT_CHOICES);
    const zip = { ...DEFAULT_EXPORT_CHOICES, format: "zip", minify: true } as const;
    await scoped(session).setExportChoices(zip);

    await session.close();
    await session.open(path);
    expect(await scoped(session).exportChoices()).toEqual(zip);
  });

  it("keeps the earlier choices of a site it can't write to, without failing", async () => {
    await session.create(join(dir, "Bakery.wforge"));
    const write = vi.spyOn(ProjectStore.prototype, "writeExportChoices");
    write.mockImplementationOnce(() => {
      throw new ReadOnlyProjectError();
    });

    await expect(scoped(session).setExportChoices(DEFAULT_EXPORT_CHOICES)).resolves.toBeUndefined();
    write.mockRestore();
  });
});

describe("ProjectSession editor mode", () => {
  it("has none without a site, and remembers it with the open site", async () => {
    expect(await session.uiState()).toBeNull();
    expect(await session.setUiState({ editorMode: "content" })).toEqual({
      status: "failed",
      reason: "no-site",
    });

    const path = join(dir, "Bakery.wforge");
    await session.create(path);
    expect(await session.uiState()).toEqual({ editorMode: "design", siteCheckIgnored: [] });
    expect(await session.setUiState({ editorMode: "content" })).toEqual({
      status: "saved",
    });
    // Each part on its own: Site Check's ignored items leave the mode as it is (3.6).
    expect(await session.setUiState({ siteCheckIgnored: ["altText:a"] })).toEqual({
      status: "saved",
    });

    await session.close();
    await session.open(path);
    expect(await session.uiState()).toEqual({
      editorMode: "content",
      siteCheckIgnored: ["altText:a"],
    });
  });

  it("reports a read-only site or a write error instead of throwing", async () => {
    await session.create(join(dir, "Bakery.wforge"));
    const write = vi.spyOn(ProjectStore.prototype, "writeEditorMode");

    write.mockImplementationOnce(() => {
      throw new ReadOnlyProjectError();
    });
    expect(await session.setUiState({ editorMode: "content" })).toEqual({
      status: "failed",
      reason: "read-only",
    });

    write.mockImplementationOnce(() => {
      throw Object.assign(new Error("disk full"), { code: "SQLITE_FULL" });
    });
    expect(await session.setUiState({ editorMode: "content" })).toEqual({
      status: "failed",
      reason: "unknown",
    });
    expect(console.error).toHaveBeenCalledWith(
      "Webforge could not remember the editor state (code=Error SQLITE_FULL)",
    );
  });
});

describe("ProjectSession events", () => {
  it("tells listeners when a site opens, is saved and closes", async () => {
    const events = { opened: vi.fn(), committed: vi.fn(), closed: vi.fn() };
    const observed = new ProjectSession(events);
    const path = join(dir, "events.wforge");
    const site = createSite({ name: "E", language: "en", homeTitle: "Home", notFoundTitle: "404" });

    await observed.create(path);
    // The store comes through the gate (R13b), not as it is.
    expect(events.opened).toHaveBeenCalledWith(expect.any(Function), path);
    await observed.commit(changedDocuments(undefined, site));
    expect(events.committed).toHaveBeenCalledTimes(1);
    await observed.commit([{ type: "delete", id: pageDocumentId(site.homePageId) }]);
    expect(events.committed).toHaveBeenCalledTimes(1);
    await observed.close();
    await observed.close();
    expect(events.closed).toHaveBeenCalledTimes(1);
  });
});

describe("ProjectSession site (A13)", () => {
  it("lets work for an opening reach the store only while that opening is open", async () => {
    const created = await session.create(join(dir, "Site store.wforge"));
    const sessionId = created.status === "opened" ? created.project.sessionId : "";
    const site = session.site(sessionId);
    const name = (kind: "shared" | "exclusive") =>
      site.withStore(
        kind,
        (store) => store.info.name,
        (reason) => reason,
      );

    expect(site.staleReason()).toBeUndefined();
    expect(site.openPath()).toBe(join(dir, "Site store.wforge"));
    expect(await name("shared")).toBe("Site store");
    expect(await name("exclusive")).toBe("Site store");

    await session.create(join(dir, "Other.wforge"));
    expect(site.staleReason()).toBe("stale-session");
    expect(await name("shared")).toBe("stale-session");
    expect(await session.site().withStore("shared", (store) => store.info.name, String)).toBe(
      "Other",
    );

    await session.close();
    expect(site.staleReason()).toBe("no-site");
    expect(session.site().staleReason()).toBe("no-site");
    expect(
      await site.writerTurn(
        async (path) => path,
        (reason) => reason,
      ),
    ).toBe("no-site");
  });

  it("stores an import only in the writer's turn, which a close that can't wait stops", async () => {
    const stop = vi.fn(async () => undefined);
    const store = vi.fn(() => new Promise<never>(() => undefined));
    const writer: StorageWriter = {
      warm: () => undefined,
      prepare: vi.fn(),
      store,
      discard: vi.fn(),
      putBlobs: vi.fn(),
      cleanUp: vi.fn(async () => ({ status: "failed" as const })),
      stop,
    };
    const gated = new ProjectSession({}, { writer });
    const created = await gated.create(join(dir, "Turn closed.wforge"));
    const sessionId = created.status === "opened" ? created.project.sessionId : "";
    const site = gated.site(sessionId);
    expect(Object.keys(site.writer).sort()).toEqual(["discard", "prepare"]);
    const outcome = await createWriterJobs().prepare(1, "photo.jpg", { data: heroPhoto() });
    if (outcome.status !== "prepared") throw new Error("The photo wasn't prepared");
    const prepared = { ...outcome, token: 1 };
    vi.useFakeTimers();

    // A turn whose store never finishes, as a writer thread that stops answering.
    void site.writerTurn(
      (sitePath, writing) =>
        writing.store(prepared, { sitePath, mediaId: "photo", originalName: "photo.jpg" }),
      () => ({ status: "failed" }),
    );
    await vi.advanceTimersByTimeAsync(0);
    const closing = gated.close();
    await vi.advanceTimersByTimeAsync(5_000);
    await closing;

    expect(store).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(gated.current()).toBeNull();
    vi.useRealTimers();
  });

  it("gives the writer's turn the open site's file, for its opening only", async () => {
    const created = await session.create(join(dir, "Turn.wforge"));
    const sessionId = created.status === "opened" ? created.project.sessionId : "";

    expect(await session.site(sessionId).writerTurn(async (path) => path, String)).toBe(
      join(dir, "Turn.wforge"),
    );
    expect(await session.site("another").writerTurn(async (path) => path, String)).toBe(
      "stale-session",
    );
  });
});

describe("ProjectSession listeners (A12)", () => {
  it("tells every listener, in order, that a site replaced by another closed", async () => {
    const told: string[] = [];
    const listening = new ProjectSession({ closed: () => told.push("first closed") });
    listening.listen({
      opened: (_access, path) => told.push(`second opened ${basename(path)}`),
      closed: () => told.push("second closed"),
    });

    await listening.create(join(dir, "One.wforge"));
    // A hand-off opens the other site in place of this one.
    await listening.create(join(dir, "Two.wforge"));
    await listening.close();

    expect(told).toEqual([
      "second opened One.wforge",
      "first closed",
      "second closed",
      "second opened Two.wforge",
      "first closed",
      "second closed",
    ]);
  });

  it("still tells the others, and still closes, when a listener throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const closed = vi.fn();
    const listening = new ProjectSession({
      closed: () => {
        throw Object.assign(new Error("EIO: C:SitesBakery"), { code: "EIO" });
      },
    });
    listening.listen({ closed });
    await listening.create(join(dir, "Thrown.wforge"));

    await listening.close();

    expect(closed).toHaveBeenCalledOnce();
    expect(listening.current()).toBeNull();
    expect(error).toHaveBeenCalledWith(
      "Webforge could not act on the site being closed (code=Error EIO)",
    );
  });
});

describe("ProjectSession storeCopiedMedia (1.25)", () => {
  const bytes = heroPhoto();
  const photo: ImageMeta = {
    id: "photo" as MediaId,
    hash: createHash("sha256").update(bytes).digest("hex"),
    name: "shop",
    fileName: "shop.jpg",
    kind: "image",
    mimeType: "image/jpeg",
    width: 10,
    height: 10,
    alt: "",
  };

  it("stores a pasted item the site lacks, reading its bytes only then", async () => {
    await session.create(join(dir, "Pasted.wforge"));
    const read = vi.fn(() => bytes);

    expect(await scoped(session).storeCopiedMedia(photo, read)).toEqual({
      status: "stored",
      hash: photo.hash,
    });
    expect([...((await scoped(session).readMedia(photo.hash))?.data ?? [])]).toEqual([...bytes]);
    // Already there: its bytes aren't read again.
    expect(await scoped(session).storeCopiedMedia(photo, read)).toEqual({
      status: "stored",
      hash: photo.hash,
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps the site's own item under that id, adding only missing bytes", async () => {
    await session.create(join(dir, "Own.wforge"));
    await scoped(session).importFile(photo.id, "a.png", { data: pngOf(4, 3) });

    await scoped(session).storeCopiedMedia(photo, () => bytes);

    expect([...((await scoped(session).readMedia(photo.hash))?.data ?? [])]).toEqual([...bytes]);
    const store = ProjectStore.open(join(dir, "Own.wforge"), { readOnly: true });
    try {
      expect(store.readAsset(photo.id)?.mime).toBe("image/png");
    } finally {
      store.close();
    }
  });

  it("stores pasted and downloaded files through the storage writer, never this thread's connection (#664)", async () => {
    await session.create(join(dir, "Through the writer.wforge"));
    const putBlob = vi.spyOn(ProjectStore.prototype, "putBlob");
    const putAsset = vi.spyOn(ProjectStore.prototype, "putAsset");
    const written = vi.spyOn(SiteFileWriter.prototype, "putBlobs");
    const code = new TextEncoder().encode("window.x = 1;");

    expect(await scoped(session).storeCopiedMedia(photo, () => bytes)).toEqual({
      status: "stored",
      hash: photo.hash,
    });
    expect(await scoped(session).storeBlobs([{ data: code, mime: "text/javascript" }])).toEqual({
      status: "stored",
      hashes: [createHash("sha256").update(code).digest("hex")],
    });
    expect(await scoped(session).storeBlobs([])).toEqual({ status: "stored", hashes: [] });

    expect(written).toHaveBeenCalledTimes(2);
    expect(putBlob).not.toHaveBeenCalled();
    expect(putAsset).not.toHaveBeenCalled();
    expect((await scoped(session).readMedia(photo.hash))?.mime).toBe("image/jpeg");
  });

  it("refuses kept bytes that aren't the pasted item's, storing nothing, so a paste after can store it (#664)", async () => {
    const path = join(dir, "Changed bytes.wforge");
    await session.create(path);
    const wrong = new Uint8Array([1, 2, 3]);

    expect(await scoped(session).storeCopiedMedia(photo, () => wrong)).toEqual({
      status: "failed",
      reason: "unknown",
    });
    const refused = ProjectStore.open(path, { readOnly: true });
    try {
      // No asset naming the wrong bytes, which the next paste would take as the item's.
      expect(refused.readAsset(photo.id)).toBeUndefined();
      expect(refused.hasBlob(createHash("sha256").update(wrong).digest("hex"))).toBe(false);
    } finally {
      refused.close();
    }
    expect(await scoped(session).storeCopiedMedia(photo, () => bytes)).toEqual({
      status: "stored",
      hash: photo.hash,
    });
    expect((await scoped(session).readMedia(photo.hash))?.mime).toBe("image/jpeg");
  });

  it("reports missing bytes, no site and a read-only site", async () => {
    expect(await scoped(session).storeCopiedMedia(photo, () => bytes)).toEqual({
      status: "failed",
      reason: "no-site",
    });
    await session.create(join(dir, "Missing.wforge"));
    expect(await scoped(session).storeCopiedMedia(photo, () => undefined)).toEqual({
      status: "missing",
    });
    // The same bytes under another item: those do.
    await scoped(session).importFile("other", "b.jpg", { data: bytes });
    expect(await scoped(session).storeCopiedMedia(photo, () => undefined)).toEqual({
      status: "stored",
      hash: photo.hash,
    });

    await session.close();
    const path = join(dir, "Missing.wforge");
    await session.open(path);
    // As a site from a newer Webforge will be, once the editor can show one.
    vi.spyOn(ProjectStore.prototype, "info", "get").mockReturnValue({
      projectId: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
      name: "Missing",
      formatVersion: FORMAT_VERSION,
      createdAt: "2026-11-01T10:00:00.000Z",
      readOnly: true,
      newerFormat: true,
    });
    const fresh = { ...photo, id: "fresh" as MediaId };
    expect(await scoped(session).storeCopiedMedia(fresh, () => bytes)).toEqual({
      status: "failed",
      reason: "read-only",
    });
  });
});

describe("withProjectExtension", () => {
  it("adds .wforge only when it is missing", () => {
    expect(withProjectExtension("site")).toBe("site.wforge");
    expect(withProjectExtension("site.wforge")).toBe("site.wforge");
    expect(withProjectExtension("SITE.WFORGE")).toBe("SITE.WFORGE");
  });
});

describe("findProjectArgument", () => {
  it("finds a .wforge path among the command-line arguments", () => {
    expect(findProjectArgument(["Webforge.exe", "C:\\Sites\\Bakery.wforge"])).toBe(
      "C:\\Sites\\Bakery.wforge",
    );
    expect(
      findProjectArgument(["electron", "apps/desktop", "--flag=x.wforge", "/sites/A.WFORGE"]),
    ).toBe("/sites/A.WFORGE");
  });

  it("ignores the executable and other arguments", () => {
    expect(findProjectArgument(["/Applications/x.wforge"])).toBeUndefined();
    expect(findProjectArgument(["Webforge.exe", "--remote-debugging-port=0"])).toBeUndefined();
  });
});

describe("ProjectSession and the store gate (R13b)", () => {
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  });
  const renamed = (title: string) => {
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    return [
      {
        type: "put" as const,
        id: pageDocumentId(home.id),
        kind: "page" as const,
        content: { ...home, title },
      },
    ];
  };

  it("reaches the file only while it holds the gate, whatever it does", async () => {
    const gate = createStoreGate();
    const outside: string[] = [];
    // The store as the session sees it: every call made without the gate is noted. Its facts
    // (`info`) are read when it opens, and kept in memory.
    const watched = (store: ProjectStore) =>
      new Proxy(store, {
        get(target, key) {
          const value = Reflect.get(target, key, target);
          if (typeof value !== "function") return value;
          return (...args: unknown[]) => {
            if (!gate.held()) outside.push(String(key));
            return Reflect.apply(value, target, args);
          };
        },
      });
    const opened: SiteStoreAccess[] = [];
    const gated = new ProjectSession(
      { opened: (access) => opened.push(access) },
      {
        gate,
        openStore: (path) => watched(ProjectStore.open(path)),
        createStore: (path, name) => watched(ProjectStore.create(path, { name })),
      },
    );
    const path = join(dir, "Gated.wforge");
    const bytes = heroPhoto();

    const created = await gated.create(path);
    const sessionId = created.status === "opened" ? created.project.sessionId : "";
    await gated.readSite();
    await gated.commit(changedDocuments(undefined, site), sessionId);
    await gated.readSite();
    const stored = await scoped(gated).importFile("photo", "a.jpg", { data: bytes });
    const hash = stored.status === "stored" ? stored.hash : "";
    await scoped(gated).readMedia(hash);
    await gated.forSession(sessionId).readMedia(hash);
    await gated.forSession(sessionId).importFile("again", "a.jpg", { data: bytes });
    await scoped(gated).storeCopiedMedia(
      {
        id: "pasted" as MediaId,
        hash,
        name: "pasted",
        fileName: "pasted.jpg",
        kind: "image",
        mimeType: "image/jpeg",
        width: 1,
        height: 1,
        alt: "",
      },
      () => bytes,
    );
    await gated.uiState();
    await gated.setUiState({ editorMode: "content" }, sessionId);
    await opened[0]?.((store) => store.isEmpty());
    await gated.close();
    await gated.open(path);
    await gated.commit(renamed("Welcome"));
    await gated.close();

    expect(outside).toEqual([]);
  });

  it("lands saves asked for while a writer has the file after it, in the order asked", async () => {
    const gate = createStoreGate();
    const gated = new ProjectSession({}, { gate });
    await gated.create(join(dir, "Ordered.wforge"));
    await gated.commit(changedDocuments(undefined, site));
    const commit = vi.spyOn(ProjectStore.prototype, "commit");
    let finishWriting: () => void = () => undefined;
    const writing = gate.run(
      "exclusive",
      () =>
        new Promise<void>((resolve) => {
          finishWriting = resolve;
        }),
    );

    const first = gated.commit(renamed("First"));
    const second = gated.commit(renamed("Second"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(commit).not.toHaveBeenCalled();

    finishWriting();
    await writing;
    expect(await first).toEqual({ status: "saved" });
    expect(await second).toEqual({ status: "saved" });
    expect(commit.mock.calls.map(([changes]) => changes)).toEqual([
      renamed("First"),
      renamed("Second"),
    ]);
    const read = await gated.readSite();
    expect(read.status === "ok" && read.site.pages[site.homePageId]?.title).toBe("Second");
    await gated.close();
  });

  it("checks a save's session once the gate lets it in, after a hand-off that waited ahead of it", async () => {
    const gate = createStoreGate();
    const gated = new ProjectSession({}, { gate });
    const first = await gated.create(join(dir, "First.wforge"));
    const firstId = first.status === "opened" ? first.project.sessionId : "";
    await gated.commit(changedDocuments(undefined, site));
    let finishWriting: () => void = () => undefined;
    const writing = gate.run(
      "exclusive",
      () =>
        new Promise<void>((resolve) => {
          finishWriting = resolve;
        }),
    );

    // The hand-off asks for the file first, the late save after it.
    const handOff = gated.open(join(dir, "First.wforge"));
    const late = gated.commit(renamed("Late"), firstId);
    await new Promise((resolve) => setTimeout(resolve, 10));
    finishWriting();
    await writing;
    await handOff;

    expect(await late).toEqual({ status: "failed", reason: "stale-session" });
    await gated.close();
  });

  it("closes the site even when work on it doesn't finish", async () => {
    vi.useFakeTimers();
    const gate = createStoreGate();
    const gated = new ProjectSession({}, { gate });
    await gated.create(join(dir, "Stuck.wforge"));
    void gate.run("exclusive", () => new Promise<void>(() => undefined));

    const closing = gated.close();
    await vi.advanceTimersByTimeAsync(5_000);
    await closing;

    expect(gated.current()).toBeNull();
    vi.useRealTimers();
  });

  it("saves while an import's file is still being read: reading holds nothing (#408 review)", async () => {
    // A writer that reads as slowly as a network share: as long as the test says.
    let finishReading: () => void = () => undefined;
    const jobs = createWriterJobs();
    const slow: StorageWriter = {
      warm: () => undefined,
      prepare: async (fileName, source) => {
        await new Promise<void>((resolve) => {
          finishReading = resolve;
        });
        const outcome = await jobs.prepare(1, fileName, source);
        return outcome.status === "prepared" ? { ...outcome, token: 1 } : outcome;
      },
      store: async (prepared, target) => jobs.store(prepared.token, target),
      discard: (prepared) => jobs.discard(prepared.token),
      putBlobs: async (sitePath, blobs, asset) => jobs.putBlobs(sitePath, blobs, asset),
      cleanUp: async (sitePath) => jobs.cleanUp(sitePath),
      stop: async () => undefined,
    };
    const gated = new ProjectSession({}, { writer: slow });
    await gated.create(join(dir, "Slow share.wforge"));
    await gated.commit(changedDocuments(undefined, site));
    const order: string[] = [];

    const importing = scoped(gated)
      .importFile("photo", "photo.jpg", { data: heroPhoto() })
      .then((result) => {
        order.push("import");
        return result;
      });
    const saving = gated.commit(renamed("Typed while it read")).then((result) => {
      order.push("save");
      return result;
    });

    expect(await saving).toEqual({ status: "saved" });
    finishReading();
    expect((await importing).status).toBe("stored");
    expect(order).toEqual(["save", "import"]);
    await gated.close();
  });

  it("closes the site when the storage writer doesn't finish, stopping it; the import fails", async () => {
    // A writer thread that prepares, then never answers while it stores, holding the gate.
    let answer: (message: unknown) => void = () => undefined;
    const thread = {
      postMessage: vi.fn((message: { id: number; type: string }) => {
        if (message.type !== "prepare") return;
        queueMicrotask(() =>
          answer({
            id: message.id,
            outcome: {
              status: "prepared",
              hash: "a".repeat(64),
              size: 1,
              media: { kind: "image", mimeType: "image/jpeg", width: 1, height: 1 },
            },
          }),
        );
      }),
      on: vi.fn((event: string, listener: (message: unknown) => void) => {
        if (event === "message") answer = listener;
      }),
      terminate: vi.fn(async () => 0),
    };
    const gated = new ProjectSession({}, { writer: createStorageWriter(() => thread) });
    await gated.create(join(dir, "Stuck writer.wforge"));
    vi.useFakeTimers();

    const importing = scoped(gated).importFile("photo", "photo.jpg", { data: heroPhoto() });
    await vi.advanceTimersByTimeAsync(0);
    expect(thread.postMessage.mock.calls.map(([message]) => message.type)).toEqual([
      "prepare",
      "store",
    ]);
    const closing = gated.close();
    await vi.advanceTimersByTimeAsync(5_000);
    // The clean-up after it is never answered either: it is stopped in its turn (#664).
    expect(thread.postMessage.mock.calls.at(-1)?.[0].type).toBe("clean-up");
    await vi.advanceTimersByTimeAsync(CLEAN_UP_WAIT_MS);
    await closing;

    expect(thread.terminate).toHaveBeenCalledTimes(2);
    expect(gated.current()).toBeNull();
    expect(await importing).toEqual({ status: "failed", reason: "unknown" });
    vi.useRealTimers();
  });

  it("lets a backup finish whole, from its own connection, when a close can wait no longer", async () => {
    const accesses: SiteStoreAccess[] = [];
    const gated = new ProjectSession({ opened: (access) => accesses.push(access) });
    await gated.create(join(dir, "Backed up.wforge"));
    await gated.commit(changedDocuments(undefined, site));
    const target = join(dir, "backup.wforge");
    let carryOn: () => void = () => undefined;
    // A backup that takes longer than closing waits: it is still to start when the store closes.
    const backup = accesses[0]?.(async (store) => {
      await new Promise<void>((resolve) => {
        carryOn = resolve;
      });
      await store.backupTo(target);
      return "done";
    });
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(0);

    const closing = gated.close();
    await vi.advanceTimersByTimeAsync(5_000);
    await closing;
    vi.useRealTimers();
    expect(gated.current()).toBeNull();
    carryOn();

    expect(await backup).toBe("done");
    const copy = ProjectStore.open(target);
    try {
      expect(copy.readSite()).toEqual(site);
    } finally {
      copy.close();
    }
    expect(readdirSync(dir).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });
});
