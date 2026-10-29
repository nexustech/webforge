import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { ProjectResult } from "../shared/ipc-contract.js";
import { type ProjectDialogs, registerProjectHandlers, siteFileName } from "./project-ipc.js";
import type { ProjectSession } from "./project-session.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";
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
    readSite: vi.fn(() => ({ status: "empty" })),
    commit: vi.fn(() => ({ status: "saved" })),
    uiState: vi.fn(() => ({ editorMode: "content" })),
    setUiState: vi.fn(() => ({ status: "saved" })),
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
      list: vi.fn(() => []),
      pathOf: vi.fn((asked: string) => (asked === id ? "/sites/Bakery.wforge" : undefined)),
      remove: vi.fn(),
      setPinned: vi.fn(),
      clearUnpinned: vi.fn(),
    };
    const { invoke, session } = setUp({}, { recent });

    await expect(invoke("project:list-recent")).resolves.toEqual([]);
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
      list: vi.fn(() => []),
      pathOf: vi.fn(() => "/gone.wforge"),
      remove: vi.fn(),
      setPinned: vi.fn(),
      clearUnpinned: vi.fn(),
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

describe("siteFileName (2.14a)", () => {
  it("offers the site's name as the file name, without what no file name may have", () => {
    expect(siteFileName("Rosa's Bakery", "My site")).toBe("Rosa's Bakery");
    expect(siteFileName('Fish & Chips: "Best" in town?', "My site")).toBe(
      "Fish & Chips- -Best- in town-",
    );
    expect(siteFileName(String.raw`A/B\C|D*E<F>G` + "\u0007", "My site")).toBe("A-B-C-D-E-F-G-");
    // Windows drops trailing dots and spaces.
    expect(siteFileName("  Café Rosa...  ", "My site")).toBe("Café Rosa");
  });

  it("falls back when nothing usable is left", () => {
    expect(siteFileName("...", "My site")).toBe("My site");
    expect(siteFileName("CON", "My site")).toBe("My site");
    expect(siteFileName("lpt1", "My site")).toBe("My site");
  });
});
