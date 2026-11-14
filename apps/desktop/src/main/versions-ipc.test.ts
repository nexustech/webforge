import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedDocuments, createSite, type SiteDoc } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VersionSummary } from "../shared/ipc/versions.js";
import { ProjectSession } from "./project-session.js";
import {
  BEFORE_SITE_WIDE_GAP_MS,
  registerVersionsHandlers,
  type VersionsOptions,
} from "./versions-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

let dir: string;
let session: ProjectSession;
let site: SiteDoc;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "webforge-versions-"));
  session = new ProjectSession();
  site = createSite({
    name: "Rosa's Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "404",
  });
  await session.create(join(dir, "Rosa's Bakery.wforge"), {
    name: "Rosa's Bakery",
    fill: async ({ store }) => store.saveSite(site),
  });
  await session.readSite();
  // Failures are logged by design; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await session.close();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

function setUp(options: Partial<VersionsOptions> = {}) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const beforeSwitch = vi.fn(async () => undefined);
  registerVersionsHandlers(ipc, (url) => url === APP_URL, {
    session,
    dialogs: { chooseNewProjectPath: async (name) => join(dir, `${name}.wforge`) },
    captureCanvas: async () => JPEG,
    versionsKept: async () => 5,
    beforeSwitch,
    ...options,
  });
  const invoke = (channel: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (handler === undefined) throw new Error(`No handler for ${channel}`);
    return handler({ senderFrame: { url: APP_URL } } as IpcMainInvokeEvent, ...args);
  };
  return { invoke, beforeSwitch, sessionId: session.current()?.sessionId ?? "" };
}

/** The site renamed, saved as autosave saves it. */
async function rename(name: string): Promise<void> {
  const next = {
    ...site,
    settings: { ...site.settings, general: { ...site.settings.general, name } },
  };
  await session.commit(changedDocuments(site, next));
  site = next;
}

const listed = async (invoke: ReturnType<typeof setUp>["invoke"], sessionId: string) => {
  const result = (await invoke("versions:list", sessionId)) as {
    status: string;
    versions: VersionSummary[];
  };
  return result.versions;
};

describe("the versions IPC calls (4.6)", () => {
  it("saves a version with the person's name and a picture of the canvas, newest first", async () => {
    const { invoke, sessionId } = setUp();

    const saved = await invoke("versions:save", sessionId, {
      name: " Before the menu ",
      reason: "manual",
    });
    await rename("Rosa's");
    await invoke("versions:save", sessionId, { name: "", reason: "before-site-wide" });

    expect(saved).toMatchObject({
      status: "saved",
      version: { name: "Before the menu", reason: "manual", thumbnailHash: expect.any(String) },
    });
    const versions = await listed(invoke, sessionId);
    expect(versions.map((version) => version.reason)).toEqual(["before-site-wide", "manual"]);
    // The picture is a blob of the site's, which the media protocol serves by its hash.
    const hash = versions[1]?.thumbnailHash ?? "";
    expect((await session.forSession(sessionId).readMedia(hash))?.mime).toBe("image/jpeg");
  });

  it("says where and when each version was last published, by its destination's name (4.6b)", async () => {
    const { invoke, sessionId } = setUp();
    await invoke("versions:save", sessionId, { name: "Spring", reason: "manual" });
    await invoke("versions:save", sessionId, { name: "Summer", reason: "manual" });
    const [summer, spring] = await listed(invoke, sessionId);
    const destination = {
      id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
      name: "Rosa's host",
      kind: "file-transfer" as const,
      settings: { protocol: "ftps" as const, host: "ftp.example.com", user: "rosa", folder: "/" },
    };
    const at = (destinationId: string) => ({
      destinationId,
      publishedAt: "2026-11-07T09:15:00.000Z",
      check: "live" as const,
    });
    await session.site(sessionId).withStore(
      "shared",
      (store) => {
        store.writePublishDestinations([destination]);
        store.recordPublish(summer?.id ?? "", at(destination.id));
        // Published to a destination removed since.
        store.recordPublish(spring?.id ?? "", at("0b9a8f6e-3c2d-4e1f-8a7b-6c5d4e3f2a10"));
      },
      () => undefined,
    );

    const versions = await listed(invoke, sessionId);
    expect(versions.map((version) => version.published)).toEqual([
      { at: "2026-11-07T09:15:00.000Z", to: "Rosa's host" },
      { at: "2026-11-07T09:15:00.000Z" },
    ]);
  });

  it("keeps the person's Versions kept of Webforge's own versions, and every one of the person's", async () => {
    let time = 0;
    const { invoke, sessionId } = setUp({ versionsKept: async () => 2, now: () => time });
    await invoke("versions:save", sessionId, { name: "Mine", reason: "manual" });
    for (let index = 0; index < 4; index++) {
      await invoke("versions:save", sessionId, { name: "", reason: "before-site-wide" });
      time += BEFORE_SITE_WIDE_GAP_MS;
    }

    const versions = await listed(invoke, sessionId);
    expect(versions.map((version) => version.reason)).toEqual([
      "before-site-wide",
      "before-site-wide",
      "manual",
    ]);
  });

  it("asks the renderer to save its last changes before it saves a version (ADR 0018 §3)", async () => {
    const order: string[] = [];
    const { invoke, sessionId } = setUp({
      flush: async () => {
        order.push("flush");
      },
      captureCanvas: async () => {
        order.push("capture");
        return JPEG;
      },
    });
    await invoke("versions:save", sessionId, { name: "Mine", reason: "manual" });
    expect(order).toEqual(["flush", "capture"]);
  });

  it("saves one version before a burst of changes to every page, and keeps the daily one (4.6)", async () => {
    let time = Date.parse("2026-11-06T10:00:00Z");
    const { invoke, sessionId } = setUp({ now: () => time, versionsKept: async () => 5 });
    await session.forSession(sessionId).saveVersion({
      name: "",
      reason: "daily",
      thumbnail: undefined,
      kept: 5,
    });

    // Ten pages deleted inside five minutes.
    const results = [];
    for (let page = 0; page < 10; page++) {
      results.push(
        await invoke("versions:save", sessionId, { name: "", reason: "before-site-wide" }),
      );
      time += 20_000;
    }

    expect(results.map((result) => (result as { status: string }).status)).toEqual([
      "saved",
      ...Array.from({ length: 9 }, () => "skipped"),
    ]);
    expect((await listed(invoke, sessionId)).map((version) => version.reason)).toEqual([
      "before-site-wide",
      "daily",
    ]);
    // Five minutes after the first, the next change is a new burst; the person's own are never held back.
    time = Date.parse("2026-11-06T10:05:00Z");
    expect(
      await invoke("versions:save", sessionId, { name: "", reason: "before-site-wide" }),
    ).toMatchObject({ status: "saved" });
    expect(
      await invoke("versions:save", sessionId, { name: "Mine", reason: "manual" }),
    ).toMatchObject({ status: "saved" });
  });

  it("counts main's own version before an app's changes in the same burst (4.9, S20)", async () => {
    const versions = registerVersionsHandlers({ handle: () => undefined } as never, () => true, {
      session,
      dialogs: { chooseNewProjectPath: async () => undefined },
      captureCanvas: async () => undefined,
      versionsKept: async () => 5,
      now: () => 0,
    });
    const sessionId = session.current()?.sessionId ?? "";

    expect(await versions.saveVersionBefore(sessionId, "Before Claude's changes")).toMatchObject({
      status: "saved",
      version: { name: "Before Claude's changes" },
    });
    // The second of a burst isn't saved: the first holds the site from before it.
    expect(await versions.saveVersionBefore(sessionId, "Before Claude's changes")).toEqual({
      status: "skipped",
    });

    const result = await session.forSession(sessionId).listVersions();
    expect(result.status === "ok" ? result.versions.length : 0).toBe(1);
  });

  it("cleans up once the renderer has saved its last changes, for its own opening only (P3)", async () => {
    const flush = vi.fn(async () => undefined);
    const { invoke, sessionId } = setUp({ flush });

    expect(await invoke("versions:clean-up", sessionId)).toMatchObject({ status: "cleaned" });
    expect(flush).toHaveBeenCalledOnce();
    expect(await invoke("versions:clean-up", "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d")).toEqual({
      status: "failed",
      reason: "stale-session",
    });
    expect(flush).toHaveBeenCalledOnce();
  });

  it("saves without a picture when the canvas can't be captured", async () => {
    const { invoke, sessionId } = setUp({ captureCanvas: async () => undefined });
    await invoke("versions:save", sessionId, { name: "No picture", reason: "manual" });
    expect((await listed(invoke, sessionId))[0]?.thumbnailHash).toBeUndefined();
  });

  it("reads a version's site as it was, and deletes it", async () => {
    const { invoke, sessionId } = setUp();
    const saved = (await invoke("versions:save", sessionId, {
      name: "First",
      reason: "manual",
    })) as {
      version: VersionSummary;
    };
    await rename("Rosa's");

    expect(await invoke("versions:read-site", sessionId, saved.version.id)).toMatchObject({
      status: "ok",
      site: { settings: { general: { name: "Rosa's Bakery" } } },
    });
    expect(await invoke("versions:delete", sessionId, saved.version.id)).toEqual({
      status: "deleted",
    });
    expect(await invoke("versions:delete", sessionId, saved.version.id)).toEqual({
      status: "not-found",
    });
    expect(await invoke("versions:read-site", sessionId, saved.version.id)).toEqual({
      status: "not-found",
    });
  });

  it("does nothing for a renderer loaded for another opening of the site (R6)", async () => {
    const { invoke } = setUp();
    const other = "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d";
    expect(await invoke("versions:save", other, { name: "x", reason: "manual" })).toEqual({
      status: "failed",
      reason: "stale-session",
    });
    expect(await invoke("versions:list", other)).toEqual({
      status: "failed",
      reason: "stale-session",
    });
    expect(await invoke("versions:open-as-new-site", other, crypto.randomUUID(), "Copy")).toEqual({
      status: "canceled",
    });
  });

  it("refuses a renderer it doesn't trust", async () => {
    const handlers = new Map<string, Handler>();
    registerVersionsHandlers(
      { handle: (channel: string, handler: Handler) => handlers.set(channel, handler) } as never,
      () => false,
      {
        session,
        dialogs: { chooseNewProjectPath: async () => undefined },
        captureCanvas: async () => undefined,
        versionsKept: async () => 5,
      },
    );
    await expect(
      handlers.get("versions:list")?.(
        { senderFrame: { url: "https://x" } } as IpcMainInvokeEvent,
        "",
      ),
    ).rejects.toThrow();
  });

  it("opens a version as a new site, which replaces the open one with no destinations (P5)", async () => {
    const { invoke, sessionId, beforeSwitch } = setUp();
    const saved = (await invoke("versions:save", sessionId, {
      name: "First",
      reason: "manual",
    })) as {
      version: VersionSummary;
    };
    await rename("Rosa's");

    const opened = await invoke(
      "versions:open-as-new-site",
      sessionId,
      saved.version.id,
      "Rosa's Bakery (First)",
    );

    // Named as the renderer words it; its site's own name is the version's.
    expect(opened).toMatchObject({ status: "opened", project: { name: "Rosa's Bakery (First)" } });
    expect(beforeSwitch).toHaveBeenCalledOnce();
    expect(session.current()?.sessionId).not.toBe(sessionId);
    expect(await session.readSite()).toMatchObject({
      status: "ok",
      site: { settings: { general: { name: "Rosa's Bakery" } } },
    });
    await session.close();
    // A site of its own: no versions of the first, and its own id.
    const copy = ProjectStore.open(join(dir, "Rosa's Bakery (First).wforge"));
    try {
      expect(copy.listVersions()).toEqual([]);
    } finally {
      copy.close();
    }
  });

  it("saves main's own version before an app's changes, the last changes saved first (4.9, S20)", async () => {
    const flush = vi.fn(async () => undefined);
    const handlers = new Map<string, Handler>();
    const versions = registerVersionsHandlers(
      { handle: (channel: string, handler: Handler) => handlers.set(channel, handler) } as never,
      () => true,
      {
        session,
        dialogs: { chooseNewProjectPath: async () => undefined },
        captureCanvas: async () => JPEG,
        versionsKept: async () => 5,
        flush,
      },
    );
    const sessionId = session.current()?.sessionId ?? "";

    expect(await versions.saveVersionBefore(sessionId, "Before Claude's changes")).toMatchObject({
      status: "saved",
    });
    expect(
      await versions.saveVersionBefore("9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d", "x"),
    ).toMatchObject({ status: "failed" });

    // Once, for the opening it saves in; another opening's request saves nothing.
    expect(flush).toHaveBeenCalledOnce();
    expect((await session.forSession(sessionId).listVersions()).status).toBe("ok");
    const listed = await session.forSession(sessionId).listVersions();
    expect(listed.status === "ok" ? listed.versions : []).toMatchObject([
      {
        name: "Before Claude's changes",
        reason: "before-site-wide",
        thumbnailHash: expect.any(String),
      },
    ]);
  });

  it("opens nothing when the version has gone, or the person cancels", async () => {
    const { invoke, sessionId } = setUp({
      dialogs: { chooseNewProjectPath: async () => undefined },
    });
    expect(
      await invoke("versions:open-as-new-site", sessionId, crypto.randomUUID(), "Copy"),
    ).toEqual({
      status: "failed",
      reason: "not-found",
    });
    const saved = (await invoke("versions:save", sessionId, {
      name: "First",
      reason: "manual",
    })) as {
      version: VersionSummary;
    };
    expect(await invoke("versions:open-as-new-site", sessionId, saved.version.id, "Copy")).toEqual({
      status: "canceled",
    });
    expect(session.current()?.sessionId).toBe(sessionId);
  });
});
