import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  changedDocuments,
  createSite,
  DEFAULT_THEME,
  type ImageMeta,
  type MediaId,
  pageDocumentId,
} from "@webforge/model";
import { ProjectStore, ReadOnlyProjectError } from "@webforge/storage";
import { heroPhoto } from "@webforge/test-utils";
import type { IpcMain } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImportJobs } from "../worker/store-import.js";
import { registerProjectHandlers } from "./project-ipc.js";
import {
  findProjectArgument,
  ProjectSession,
  type SiteStoreAccess,
  withProjectExtension,
} from "./project-session.js";
import { createStorageWriter, type StorageWriter } from "./storage-writer.js";
import { createStoreGate } from "./store-gate.js";

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
      formatVersion: 1,
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

  it("replaces the current site when it creates one over the same file", async () => {
    const path = join(dir, "site.wforge");
    await session.create(path);

    // Windows can't replace a file that is open; the session closes it first.
    expect(await session.create(path)).toMatchObject({ status: "opened" });
    expect(session.current()?.fileName).toBe("site.wforge");
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

describe("ProjectSession editor mode", () => {
  it("has none without a site, and remembers it with the open site", async () => {
    expect(await session.uiState()).toBeNull();
    expect(await session.setUiState({ editorMode: "content" })).toEqual({
      status: "failed",
      reason: "no-site",
    });

    const path = join(dir, "Bakery.wforge");
    await session.create(path);
    expect(await session.uiState()).toEqual({ editorMode: "design" });
    expect(await session.setUiState({ editorMode: "content" })).toEqual({ status: "saved" });

    await session.close();
    await session.open(path);
    expect(await session.uiState()).toEqual({ editorMode: "content" });
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
      "Webforge could not remember the editor mode (code=Error SQLITE_FULL)",
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

    expect(await session.storeCopiedMedia(photo, read)).toEqual({
      status: "stored",
      hash: photo.hash,
    });
    expect([...((await session.readMedia(photo.hash))?.data ?? [])]).toEqual([...bytes]);
    // Already there: its bytes aren't read again.
    expect(await session.storeCopiedMedia(photo, read)).toEqual({
      status: "stored",
      hash: photo.hash,
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps the site's own item under that id, adding only missing bytes", async () => {
    await session.create(join(dir, "Own.wforge"));
    await session.importFile(photo.id, "a.png", { data: pngOf(4, 3) });

    await session.storeCopiedMedia(photo, () => bytes);

    expect([...((await session.readMedia(photo.hash))?.data ?? [])]).toEqual([...bytes]);
    const store = ProjectStore.open(join(dir, "Own.wforge"), { readOnly: true });
    try {
      expect(store.readAsset(photo.id)?.mime).toBe("image/png");
    } finally {
      store.close();
    }
  });

  it("reports missing bytes, no site and a read-only site", async () => {
    expect(await session.storeCopiedMedia(photo, () => bytes)).toEqual({
      status: "failed",
      reason: "no-site",
    });
    await session.create(join(dir, "Missing.wforge"));
    expect(await session.storeCopiedMedia(photo, () => undefined)).toEqual({ status: "missing" });
    // The same bytes under another item: those do.
    await session.importFile("other", "b.jpg", { data: bytes });
    expect(await session.storeCopiedMedia(photo, () => undefined)).toEqual({
      status: "stored",
      hash: photo.hash,
    });

    await session.close();
    const path = join(dir, "Missing.wforge");
    vi.spyOn(ProjectStore.prototype, "putAsset").mockImplementation(() => {
      throw new ReadOnlyProjectError();
    });
    await session.open(path);
    const fresh = { ...photo, id: "fresh" as MediaId };
    expect(await session.storeCopiedMedia(fresh, () => bytes)).toEqual({
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
    const stored = await gated.importFile("photo", "a.jpg", { data: bytes });
    const hash = stored.status === "stored" ? stored.hash : "";
    await gated.readMedia(hash);
    await gated.forSession(sessionId).readMedia(hash);
    await gated.forSession(sessionId).importFile("again", "a.jpg", { data: bytes });
    await gated.storeCopiedMedia(
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
    const jobs = createImportJobs();
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
      stop: async () => undefined,
    };
    const gated = new ProjectSession({}, { writer: slow });
    await gated.create(join(dir, "Slow share.wforge"));
    await gated.commit(changedDocuments(undefined, site));
    const order: string[] = [];

    const importing = gated
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

    const importing = gated.importFile("photo", "photo.jpg", { data: heroPhoto() });
    await vi.advanceTimersByTimeAsync(0);
    expect(thread.postMessage.mock.calls.map(([message]) => message.type)).toEqual([
      "prepare",
      "store",
    ]);
    const closing = gated.close();
    await vi.advanceTimersByTimeAsync(5_000);
    await closing;

    expect(thread.terminate).toHaveBeenCalled();
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
