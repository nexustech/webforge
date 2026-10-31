import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createSite } from "@webforge/model";
import { ProjectStore, writeSiteZip } from "@webforge/storage";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { ProjectResult } from "../shared/ipc-contract.js";
import { type ProjectDialogs, registerProjectHandlers } from "./project-ipc.js";
import type { ProjectSession } from "./project-session.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";
const tempDir = tempDirFactory();
const project = {
  name: "Bakery",
  fileName: "Bakery.wforge",
  formatVersion: 1,
  syncService: null,
  sessionId: "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d",
};
const opened: ProjectResult = { status: "opened", project };
const bakery = { name: "Rosa's Bakery", theme: "bistro", template: "cafe" };

function setUp(
  dialogs: Partial<ProjectDialogs> = {},
  options: Parameters<typeof registerProjectHandlers>[4] = {},
) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    },
  } as unknown as Pick<IpcMain, "handle">;
  const session = {
    create: vi.fn(() => opened),
    open: vi.fn(() => opened),
    current: vi.fn(() => project),
    currentPath: vi.fn((): string | undefined => "/sites/Bakery.wforge"),
    readSite: vi.fn(() => ({ status: "empty" })),
    commit: vi.fn(() => ({ status: "saved" })),
    uiState: vi.fn(() => ({ editorMode: "content" })),
    setUiState: vi.fn(() => ({ status: "saved" })),
    saveSiteZip: vi.fn(async (path: string) => ({ status: "saved", fileName: basename(path) })),
    staleReason: vi.fn((sessionId: string) =>
      sessionId === project.sessionId ? undefined : "stale-session",
    ),
  };
  registerProjectHandlers(
    ipc,
    (url) => url === APP_URL,
    session as unknown as ProjectSession,
    {
      chooseNewProjectPath: async () => "/sites/Bakery.wforge",
      chooseProjectToOpen: async () => "/sites/Bakery.wforge",
      chooseSiteZipToSave: async () => "/backups/Bakery.zip",
      chooseSiteZipToOpen: async () => "/backups/Bakery.zip",
      ...dialogs,
    },
    options,
  );
  const invoke = (channel: string, senderUrl = APP_URL, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (handler === undefined) {
      throw new Error(`No handler for ${channel}`);
    }
    return handler({ senderFrame: { url: senderUrl } } as unknown as IpcMainInvokeEvent, ...args);
  };
  return { invoke, session };
}

describe("registerProjectHandlers", () => {
  it("creates a site at the path chosen in the save dialog, which offers its name", async () => {
    const chooseNewProjectPath = vi.fn(async (_name: string) => "/sites/Bakery.wforge");
    const { invoke, session } = setUp({ chooseNewProjectPath });

    await expect(invoke("project:create", APP_URL, bakery)).resolves.toEqual(opened);
    expect(chooseNewProjectPath).toHaveBeenCalledWith("Rosa's Bakery");
    // Named as typed, whatever the file is called, and filled by New Site (2.14a).
    expect(session.create).toHaveBeenCalledWith("/sites/Bakery.wforge", {
      name: "Rosa's Bakery",
      fill: expect.any(Function),
    });
  });

  it("refuses a New Site request without a name, or for a template the app doesn't have", async () => {
    const { invoke, session } = setUp();

    for (const request of [
      undefined,
      { ...bakery, name: "  " },
      { ...bakery, template: "../../secrets" },
      { ...bakery, extra: true },
    ]) {
      await expect(invoke("project:create", APP_URL, request)).rejects.toThrow("ipc-failed");
    }
    expect(session.create).not.toHaveBeenCalled();
  });

  it("opens the site chosen in the open dialog", async () => {
    const { invoke, session } = setUp();

    await expect(invoke("project:open")).resolves.toEqual(opened);
    expect(session.open).toHaveBeenCalledWith("/sites/Bakery.wforge");
  });

  it("does nothing when the user cancels a dialog", async () => {
    const { invoke, session } = setUp({
      chooseNewProjectPath: async () => undefined,
      chooseProjectToOpen: async () => undefined,
    });

    await expect(invoke("project:create", APP_URL, bakery)).resolves.toEqual({
      status: "canceled",
    });
    await expect(invoke("project:open")).resolves.toEqual({ status: "canceled" });
    expect(session.create).not.toHaveBeenCalled();
    expect(session.open).not.toHaveBeenCalled();
  });

  it("returns the current site", async () => {
    const { invoke } = setUp();

    await expect(invoke("project:get-current")).resolves.toEqual(project);
  });

  it("reads the site and commits validated change lists", async () => {
    const { invoke, session } = setUp();
    const changes = [{ type: "delete", id: "page:about" }];

    await expect(invoke("project:read-site")).resolves.toEqual({ status: "empty" });
    await expect(invoke("project:commit", APP_URL, project.sessionId, changes)).resolves.toEqual({
      status: "saved",
    });
    expect(session.commit).toHaveBeenCalledWith(changes, project.sessionId);
  });

  it("refuses changes and the editor mode from a renderer loaded for another site (R6)", async () => {
    const { invoke, session } = setUp();
    const late = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

    await expect(
      invoke("project:commit", APP_URL, late, [{ type: "delete", id: "page:about" }]),
    ).resolves.toEqual({ status: "failed", reason: "stale-session" });
    await expect(
      invoke("project:set-ui-state", APP_URL, late, { editorMode: "design" }),
    ).resolves.toEqual({ status: "failed", reason: "stale-session" });
    expect(session.commit).not.toHaveBeenCalled();
    expect(session.setUiState).not.toHaveBeenCalled();
    // A renderer with no site (one in memory) sends the nil UUID: refused the same way.
    await expect(
      invoke("project:commit", APP_URL, "00000000-0000-0000-0000-000000000000", []),
    ).resolves.toEqual({ status: "failed", reason: "stale-session" });
    // Not a session id at all: refused by the contract.
    await expect(invoke("project:commit", APP_URL, "x", [])).rejects.toThrow();
  });

  it("rejects change lists that don't match the contract", async () => {
    const { invoke, session } = setUp();
    const bad = [
      [{ type: "rename", id: "x" }],
      [{ type: "put", id: "x", kind: "script" }],
      [{ type: "put", id: "junk", kind: "theme", content: {} }],
      [{ type: "put", id: "settings", kind: "page", content: {} }],
      [{ type: "delete", id: "settings" }],
      "x",
    ];

    for (const changes of bad) {
      await expect(invoke("project:commit", APP_URL, project.sessionId, changes)).rejects.toThrow();
    }
    expect(session.commit).not.toHaveBeenCalled();
  });

  it("offers a damaged site's backups when one is configured", async () => {
    const recovery = {
      backups: { list: vi.fn(() => []), restore: vi.fn(() => "") },
      dialogs: {
        ask: vi.fn(async () => "cancel" as const),
        chooseBackup: vi.fn(async () => undefined),
        noBackups: vi.fn(async () => undefined),
      },
    };
    const { invoke, session } = setUp({}, { recovery });
    session.open.mockReturnValueOnce({ status: "failed", reason: "corrupt" } as never);

    await expect(invoke("project:open")).resolves.toEqual({ status: "failed", reason: "corrupt" });
    expect(recovery.backups.list).toHaveBeenCalledWith("/sites/Bakery.wforge");
    expect(recovery.dialogs.noBackups).toHaveBeenCalled();
  });

  it("saves the open site before another replaces it", async () => {
    const order: string[] = [];
    const beforeSwitch = vi.fn(async () => {
      order.push("before");
    });
    const { invoke, session } = setUp({}, { beforeSwitch });
    session.create.mockImplementation(() => {
      order.push("create");
      return opened;
    });
    session.open.mockImplementation(() => {
      order.push("open");
      return opened;
    });

    await invoke("project:create", APP_URL, bakery);
    await invoke("project:open");

    expect(order).toEqual(["before", "create", "before", "open"]);
  });

  it("lists, opens and removes recent sites by id, never by path", async () => {
    const id = "a".repeat(32);
    const recent = {
      list: vi.fn(async (_openPath?: string) => []),
      pathOf: vi.fn(async (asked: string) => (asked === id ? "/sites/Bakery.wforge" : undefined)),
      remove: vi.fn(async () => undefined),
      setPinned: vi.fn(async () => undefined),
      clearUnpinned: vi.fn(async () => undefined),
    };
    const { invoke, session } = setUp({}, { recent });

    await expect(invoke("project:list-recent")).resolves.toEqual([]);
    // Main says which listed site is open, from the path only it knows.
    expect(recent.list).toHaveBeenCalledWith("/sites/Bakery.wforge");
    await expect(invoke("project:open-recent", APP_URL, id)).resolves.toEqual(opened);
    expect(session.open).toHaveBeenCalledWith("/sites/Bakery.wforge");
    await expect(invoke("project:open-recent", APP_URL, "b".repeat(32))).resolves.toEqual({
      status: "failed",
      reason: "not-found",
    });
    await expect(invoke("project:open-recent", APP_URL, "/etc/passwd")).rejects.toThrow();
    await expect(invoke("project:remove-recent", APP_URL, id)).resolves.toBeNull();
    expect(recent.remove).toHaveBeenCalledWith(id);
    await expect(invoke("project:pin-recent", APP_URL, id, true)).resolves.toBeNull();
    expect(recent.setPinned).toHaveBeenCalledWith(id, true);
    await expect(invoke("project:pin-recent", APP_URL, id, "yes")).rejects.toThrow();
    await expect(invoke("project:clear-recent")).resolves.toBeNull();
    expect(recent.clearUnpinned).toHaveBeenCalledOnce();
  });

  it("takes a recent site whose file has gone off the list", async () => {
    const id = "a".repeat(32);
    const recent = {
      list: vi.fn(async (_openPath?: string) => []),
      pathOf: vi.fn(async () => "/gone.wforge"),
      remove: vi.fn(async () => undefined),
      setPinned: vi.fn(async () => undefined),
      clearUnpinned: vi.fn(async () => undefined),
    };
    const { invoke, session } = setUp({}, { recent });
    session.open.mockReturnValueOnce({ status: "failed", reason: "not-found" } as never);

    await expect(invoke("project:open-recent", APP_URL, id)).resolves.toMatchObject({
      status: "failed",
    });
    expect(recent.remove).toHaveBeenCalledWith(id);
  });

  it("has an empty Recent list without one configured", async () => {
    const { invoke } = setUp();

    await expect(invoke("project:list-recent")).resolves.toEqual([]);
    await expect(invoke("project:open-recent", APP_URL, "a".repeat(32))).resolves.toEqual({
      status: "failed",
      reason: "not-found",
    });
    await expect(invoke("project:remove-recent", APP_URL, "a".repeat(32))).resolves.toBeNull();
    await expect(invoke("project:clear-recent")).resolves.toBeNull();
  });

  it("rejects calls from other frames before showing a dialog", async () => {
    const chooseNewProjectPath = vi.fn(async () => "/x.wforge");
    const { invoke } = setUp({ chooseNewProjectPath });

    await expect(invoke("project:create", "https://example.com/")).rejects.toThrow("ipc-failed");
    expect(chooseNewProjectPath).not.toHaveBeenCalled();
  });

  it("reads and remembers the editor mode, refusing modes it doesn't know", async () => {
    const { invoke, session } = setUp();

    await expect(invoke("project:get-ui-state")).resolves.toEqual({ editorMode: "content" });
    await expect(
      invoke("project:set-ui-state", APP_URL, project.sessionId, { editorMode: "design" }),
    ).resolves.toEqual({ status: "saved" });
    expect(session.setUiState).toHaveBeenCalledWith({ editorMode: "design" }, project.sessionId);
    await expect(
      invoke("project:set-ui-state", APP_URL, project.sessionId, { editorMode: "zoom" }),
    ).rejects.toThrow();
  });
});

describe("a site's ZIP (4.7)", () => {
  /** A ZIP of a new site called `name`, with a version, written as Save a Copy as ZIP writes it. */
  async function siteZip(name: string): Promise<string> {
    const dir = tempDir();
    const store = ProjectStore.create(join(dir, "source.wforge"), { name });
    store.saveSite(createSite({ name, language: "en", homeTitle: "Home", notFoundTitle: "Oops" }));
    store.saveVersion("Before the change", "manual");
    const path = join(dir, "Rosa's Bakery.zip");
    await writeSiteZip(store, path);
    store.close();
    return path;
  }

  it("saves a copy of the open site where the person chooses, its last changes first", async () => {
    const order: string[] = [];
    const chooseSiteZipToSave = vi.fn(async (_name: string) => {
      order.push("dialog");
      return "/backups/Bakery.zip";
    });
    const { invoke, session } = setUp(
      { chooseSiteZipToSave },
      {
        flush: async () => {
          order.push("flush");
        },
      },
    );
    session.saveSiteZip.mockImplementation(async (path: string) => {
      order.push("save");
      return { status: "saved", fileName: basename(path) };
    });

    await expect(invoke("project:save-zip")).resolves.toEqual({
      status: "saved",
      fileName: "Bakery.zip",
    });
    expect(chooseSiteZipToSave).toHaveBeenCalledWith("Bakery");
    expect(session.saveSiteZip).toHaveBeenCalledWith("/backups/Bakery.zip");
    expect(order).toEqual(["dialog", "flush", "save"]);
  });

  it("saves nothing without an open site, or when the person cancels", async () => {
    const closed = setUp();
    closed.session.current.mockReturnValue(null as unknown as typeof project);
    await expect(closed.invoke("project:save-zip")).resolves.toEqual({
      status: "failed",
      reason: "no-site",
    });

    const canceled = setUp({ chooseSiteZipToSave: async () => undefined });
    await expect(canceled.invoke("project:save-zip")).resolves.toEqual({ status: "canceled" });
    expect(canceled.session.saveSiteZip).not.toHaveBeenCalled();
  });

  it("opens a site's ZIP as a new site, named as it was, where the person chooses", async () => {
    const zip = await siteZip("Rosa's Bakery");
    const chooseNewProjectPath = vi.fn(async (_name: string) => "/sites/Rosa.wforge");
    const beforeSwitch = vi.fn(async () => undefined);
    const { invoke, session } = setUp(
      { chooseSiteZipToOpen: async () => zip, chooseNewProjectPath },
      { beforeSwitch },
    );

    await expect(invoke("project:open-zip")).resolves.toEqual(opened);
    expect(chooseNewProjectPath).toHaveBeenCalledWith("Rosa's Bakery");
    expect(beforeSwitch).toHaveBeenCalled();
    expect(session.create).toHaveBeenCalledWith("/sites/Rosa.wforge", {
      name: "Rosa's Bakery",
      fill: expect.any(Function),
    });

    // Its fill writes the site, with its version, into the new file.
    const fill = (session.create.mock.calls[0] as unknown[] | undefined)?.[1] as {
      fill: (target: { store: ProjectStore }) => Promise<void>;
    };
    const target = ProjectStore.create(join(tempDir(), "new.wforge"), { name: "Rosa's Bakery" });
    await fill.fill({ store: target });
    expect(target.readSite().settings.general.name).toBe("Rosa's Bakery");
    expect(target.listVersions().map((version) => version.name)).toEqual(["Before the change"]);
    // A project of its own, so publishing never takes it for the site it was saved from (A8).
    const source = ProjectStore.open(join(dirname(zip), "source.wforge"));
    expect(target.info.projectId).not.toBe(source.info.projectId);
    source.close();
    target.close();
  });

  it("says why a ZIP can't be opened before asking where to save it", async () => {
    const dir = tempDir();
    const notAZip = join(dir, "photo.zip");
    writeFileSync(notAZip, "not a zip");
    const chooseNewProjectPath = vi.fn(async () => "/sites/Rosa.wforge");

    for (const [path, reason] of [
      [notAZip, "not-a-project"],
      [join(dir, "gone.zip"), "not-found"],
    ] as const) {
      const { invoke, session } = setUp({
        chooseSiteZipToOpen: async () => path,
        chooseNewProjectPath,
      });
      await expect(invoke("project:open-zip")).resolves.toEqual({ status: "failed", reason });
      expect(session.create).not.toHaveBeenCalled();
    }
    expect(chooseNewProjectPath).not.toHaveBeenCalled();
  });

  it("does nothing when the person cancels either dialog", async () => {
    const zip = await siteZip("Rosa's Bakery");
    for (const dialogs of [
      { chooseSiteZipToOpen: async () => undefined },
      { chooseSiteZipToOpen: async () => zip, chooseNewProjectPath: async () => undefined },
    ]) {
      const { invoke, session } = setUp(dialogs);
      await expect(invoke("project:open-zip")).resolves.toEqual({ status: "canceled" });
      expect(session.create).not.toHaveBeenCalled();
    }
  });
});
