import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { ProjectResult } from "../shared/ipc-contract.js";
import { type ProjectDialogs, registerProjectHandlers } from "./project-ipc.js";
import type { ProjectSession } from "./project-session.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";
const project = {
  name: "Bakery",
  fileName: "Bakery.wforge",
  formatVersion: 1,
  syncService: null,
};
const opened: ProjectResult = { status: "opened", project };

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
  it("creates a site at the path chosen in the save dialog", async () => {
    const { invoke, session } = setUp();

    await expect(invoke("project:create")).resolves.toEqual(opened);
    expect(session.create).toHaveBeenCalledWith("/sites/Bakery.wforge");
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

    await expect(invoke("project:create")).resolves.toEqual({ status: "canceled" });
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
    await expect(invoke("project:commit", APP_URL, changes)).resolves.toEqual({ status: "saved" });
    expect(session.commit).toHaveBeenCalledWith(changes);
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
      await expect(invoke("project:commit", APP_URL, changes)).rejects.toThrow();
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

    await invoke("project:create");
    await invoke("project:open");

    expect(order).toEqual(["before", "create", "before", "open"]);
  });

  it("lists, opens and removes recent sites by id, never by path", async () => {
    const id = "a".repeat(32);
    const recent = {
      list: vi.fn(() => []),
      pathOf: vi.fn((asked: string) => (asked === id ? "/sites/Bakery.wforge" : undefined)),
      remove: vi.fn(),
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
  });

  it("takes a recent site whose file has gone off the list", async () => {
    const id = "a".repeat(32);
    const recent = { list: vi.fn(() => []), pathOf: vi.fn(() => "/gone.wforge"), remove: vi.fn() };
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
  });

  it("rejects calls from other frames before showing a dialog", async () => {
    const chooseNewProjectPath = vi.fn(async () => "/x.wforge");
    const { invoke } = setUp({ chooseNewProjectPath });

    await expect(invoke("project:create", "https://example.com/")).rejects.toThrow(/untrusted/);
    expect(chooseNewProjectPath).not.toHaveBeenCalled();
  });

  it("reads and remembers the editor mode, refusing modes it doesn't know", async () => {
    const { invoke, session } = setUp();

    await expect(invoke("project:get-ui-state")).resolves.toEqual({ editorMode: "content" });
    await expect(
      invoke("project:set-ui-state", APP_URL, { editorMode: "design" }),
    ).resolves.toEqual({ status: "saved" });
    expect(session.setUiState).toHaveBeenCalledWith({ editorMode: "design" });
    await expect(invoke("project:set-ui-state", APP_URL, { editorMode: "zoom" })).rejects.toThrow();
  });
});
