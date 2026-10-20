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

function setUp(dialogs: Partial<ProjectDialogs> = {}) {
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
  registerProjectHandlers(ipc, (url) => url === APP_URL, session as unknown as ProjectSession, {
    chooseNewProjectPath: async () => "/sites/Bakery.wforge",
    chooseProjectToOpen: async () => "/sites/Bakery.wforge",
    ...dialogs,
  });
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
