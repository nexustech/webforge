import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  changedDocuments,
  createSite,
  type ImageMeta,
  type MediaId,
  pageDocumentId,
} from "@webforge/model";
import { ProjectStore, ReadOnlyProjectError } from "@webforge/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findProjectArgument, ProjectSession, withProjectExtension } from "./project-session.js";

let dir: string;
let session: ProjectSession;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "webforge-desktop-"));
  session = new ProjectSession();
  // Failures are logged by design; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  session.close();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe("ProjectSession", () => {
  it("has no site until one is created or opened", () => {
    expect(session.current()).toBeNull();
  });

  it("creates a site named after its file and makes it current", () => {
    const result = session.create(join(dir, "Rosa's Bakery.wforge"));

    const project = {
      name: "Rosa's Bakery",
      fileName: "Rosa's Bakery.wforge",
      formatVersion: 1,
      syncService: null,
    };
    expect(result).toEqual({ status: "opened", project });
    expect(session.current()).toEqual(project);
  });

  it("adds the .wforge extension when the save dialog returns a path without it", () => {
    const result = session.create(join(dir, "Bakery"));

    expect(result).toMatchObject({ status: "opened", project: { fileName: "Bakery.wforge" } });
  });

  it("falls back to a default name when the file name is blank", () => {
    const result = session.create(join(dir, " .wforge"));

    expect(result).toMatchObject({ status: "opened", project: { name: "My site" } });
  });

  it("opens an existing site", () => {
    const path = join(dir, "site.wforge");
    session.create(path);
    session.close();

    expect(session.open(path)).toMatchObject({ status: "opened", project: { name: "site" } });
  });

  it("replaces the current site when it creates one over the same file", () => {
    const path = join(dir, "site.wforge");
    session.create(path);

    // Windows can't replace a file that is open; the session closes it first.
    expect(session.create(path)).toMatchObject({ status: "opened" });
    expect(session.current()?.fileName).toBe("site.wforge");
  });

  it("keeps the current site when another one fails to open", () => {
    session.create(join(dir, "good.wforge"));
    const bad = join(dir, "bad.wforge");
    writeFileSync(bad, "not a database");

    expect(session.open(bad)).toEqual({ status: "failed", reason: "not-a-project" });
    expect(session.open(join(dir, "missing.wforge"))).toEqual({
      status: "failed",
      reason: "not-found",
    });
    expect(session.current()?.fileName).toBe("good.wforge");
  });

  it("asks for an update instead of opening a site from a newer Webforge", () => {
    const path = join(dir, "newer.wforge");
    session.create(path);
    session.close();
    const store = ProjectStore.open(path);
    const close = vi.spyOn(store, "close");
    vi.spyOn(store, "info", "get").mockReturnValue({ ...store.info, newerFormat: true });
    vi.spyOn(ProjectStore, "open").mockReturnValue(store);

    expect(session.open(path)).toEqual({ status: "failed", reason: "newer-format" });
    expect(session.current()).toBeNull();
    expect(close).toHaveBeenCalled();
  });

  it("reports other errors as unknown without logging the path", () => {
    const folder = join(dir, "a-folder.wforge");
    mkdirSync(folder);

    expect(session.create(folder)).toEqual({ status: "failed", reason: "unknown" });
    for (const [message] of vi.mocked(console.error).mock.calls) {
      expect(String(message)).not.toContain(dir);
    }
  });
});

describe("ProjectSession site documents", () => {
  const site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Page not found",
  });

  it("reports no site and an empty new site", () => {
    expect(session.readSite()).toEqual({ status: "none" });
    expect(session.commit([])).toEqual({ status: "failed", reason: "no-site" });

    session.create(join(dir, "new.wforge"));
    expect(session.readSite()).toEqual({ status: "empty" });
  });

  it("saves the first pages of a new site and reads them back after reopening", () => {
    const path = join(dir, "site.wforge");
    session.create(path);

    expect(session.commit(changedDocuments(undefined, site))).toEqual({ status: "saved" });
    session.close();
    session.open(path);

    expect(session.readSite()).toEqual({ status: "ok", site });
  });

  it("refuses changes that would break the site and keeps the file as it was", () => {
    const path = join(dir, "site.wforge");
    session.create(path);
    session.commit(changedDocuments(undefined, site));

    const deleteHome = [{ type: "delete" as const, id: pageDocumentId(site.homePageId) }];
    expect(session.commit(deleteHome)).toEqual({ status: "failed", reason: "invalid" });
    const badTheme = [{ type: "put" as const, id: "theme", kind: "theme" as const, content: {} }];
    expect(session.commit(badTheme)).toEqual({ status: "failed", reason: "invalid" });

    session.close();
    session.open(path);
    expect(session.readSite()).toEqual({ status: "ok", site });
  });

  it("builds on the stored site when changes arrive before the editor read it", () => {
    const path = join(dir, "site.wforge");
    session.create(path);
    session.commit(changedDocuments(undefined, site));
    session.close();
    session.open(path);

    const next = { ...site, theme: { name: "cupcake" } };
    expect(session.commit(changedDocuments(site, next))).toEqual({ status: "saved" });
    expect(session.readSite()).toEqual({ status: "ok", site: next });
  });

  it("reports a site whose documents are broken without throwing", () => {
    const path = join(dir, "site.wforge");
    session.create(path);
    session.close();
    const store = ProjectStore.open(path);
    store.commit([{ type: "put", id: "site", kind: "site", content: { formatVersion: 99 } }]);
    store.close();
    session.open(path);

    expect(session.readSite()).toEqual({ status: "failed", reason: "newer-format" });
    expect(session.commit([])).toEqual({ status: "failed", reason: "invalid" });
  });
});

describe("ProjectSession editor mode", () => {
  it("has none without a site, and remembers it with the open site", () => {
    expect(session.uiState()).toBeNull();
    expect(session.setUiState({ editorMode: "content" })).toEqual({
      status: "failed",
      reason: "no-site",
    });

    const path = join(dir, "Bakery.wforge");
    session.create(path);
    expect(session.uiState()).toEqual({ editorMode: "design" });
    expect(session.setUiState({ editorMode: "content" })).toEqual({ status: "saved" });

    session.close();
    session.open(path);
    expect(session.uiState()).toEqual({ editorMode: "content" });
  });

  it("reports a read-only site or a write error instead of throwing", () => {
    session.create(join(dir, "Bakery.wforge"));
    const write = vi.spyOn(ProjectStore.prototype, "writeEditorMode");

    write.mockImplementationOnce(() => {
      throw new ReadOnlyProjectError();
    });
    expect(session.setUiState({ editorMode: "content" })).toEqual({
      status: "failed",
      reason: "read-only",
    });

    write.mockImplementationOnce(() => {
      throw Object.assign(new Error("disk full"), { code: "SQLITE_FULL" });
    });
    expect(session.setUiState({ editorMode: "content" })).toEqual({
      status: "failed",
      reason: "unknown",
    });
    expect(console.error).toHaveBeenCalledWith(
      "Webforge could not remember the editor mode (SQLITE_FULL)",
    );
  });
});

describe("ProjectSession events", () => {
  it("tells listeners when a site opens, is saved and closes", () => {
    const events = { opened: vi.fn(), committed: vi.fn(), closed: vi.fn() };
    const observed = new ProjectSession(events);
    const path = join(dir, "events.wforge");
    const site = createSite({ name: "E", language: "en", homeTitle: "Home", notFoundTitle: "404" });

    observed.create(path);
    expect(events.opened).toHaveBeenCalledWith(expect.any(ProjectStore), path);
    observed.commit(changedDocuments(undefined, site));
    expect(events.committed).toHaveBeenCalledTimes(1);
    observed.commit([{ type: "delete", id: pageDocumentId(site.homePageId) }]);
    expect(events.committed).toHaveBeenCalledTimes(1);
    observed.close();
    observed.close();
    expect(events.closed).toHaveBeenCalledTimes(1);
  });
});

describe("ProjectSession storeCopiedMedia (1.25)", () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
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

  it("stores a pasted item the site lacks, reading its bytes only then", () => {
    session.create(join(dir, "Pasted.wforge"));
    const read = vi.fn(() => bytes);

    expect(session.storeCopiedMedia(photo, read)).toEqual({ status: "stored", hash: photo.hash });
    expect([...(session.readMedia(photo.hash)?.data ?? [])]).toEqual([...bytes]);
    // Already there: its bytes aren't read again.
    expect(session.storeCopiedMedia(photo, read)).toEqual({ status: "stored", hash: photo.hash });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps the site's own item under that id, adding only missing bytes", () => {
    session.create(join(dir, "Own.wforge"));
    const replaced = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    session.storeAsset({
      mediaId: photo.id,
      data: replaced,
      mime: "image/png",
      originalName: "a.png",
    });

    session.storeCopiedMedia(photo, () => bytes);

    expect([...(session.readMedia(photo.hash)?.data ?? [])]).toEqual([...bytes]);
    const store = ProjectStore.open(join(dir, "Own.wforge"), { readOnly: true });
    try {
      expect(store.readAsset(photo.id)?.mime).toBe("image/png");
    } finally {
      store.close();
    }
  });

  it("reports missing bytes, no site and a read-only site", () => {
    expect(session.storeCopiedMedia(photo, () => bytes)).toEqual({
      status: "failed",
      reason: "no-site",
    });
    session.create(join(dir, "Missing.wforge"));
    expect(session.storeCopiedMedia(photo, () => undefined)).toEqual({ status: "missing" });

    session.close();
    const path = join(dir, "Missing.wforge");
    vi.spyOn(ProjectStore.prototype, "putAsset").mockImplementation(() => {
      throw new ReadOnlyProjectError();
    });
    session.open(path);
    expect(session.storeCopiedMedia(photo, () => bytes)).toEqual({
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
