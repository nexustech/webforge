import type { IpcMain, IpcMainInvokeEvent, Session } from "electron";
import { describe, expect, it, vi } from "vitest";
import { type AppCallsDeps, appCallsFeature } from "./app-calls.js";
import type { HelpWindows } from "./help-window.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/** The app's calls, registered on `platform`, with what they reached. */
function setUp(platform: NodeJS.Platform) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const menu = { setApplicationMenu: vi.fn(), buildFromTemplate: vi.fn(() => ({})) };
  const spellCheck = {
    availableSpellCheckerLanguages: [],
    setSpellCheckerLanguages: vi.fn(),
    setSpellCheckerDictionaryDownloadURL: vi.fn(),
  };
  const session = vi.fn(() => spellCheck as unknown as Session);
  const deps: AppCallsDeps = {
    app: {
      getVersion: () => "1.2.3",
      isPackaged: false,
      getAppPath: () => "/no/such/app",
      getPreferredSystemLanguages: () => ["en-GB"],
    },
    menu: menu as unknown as AppCallsDeps["menu"],
    focusedWindow: () => null,
    session,
    shell: () => ({ openExternal: vi.fn(), openPath: vi.fn() }),
    platform,
    development: false,
    helpWindows: {} as HelpWindows,
    mainWindow: () => undefined,
    crashReports: { registerHandlers: vi.fn() },
    reportDialogs: { chooseScreenshotToSave: async () => undefined },
  };
  const feature = appCallsFeature(deps);
  const invoke = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  return { feature, ipc, handlers, invoke, menu, spellCheck, session, deps };
}

describe("appCallsFeature (#985)", () => {
  it("looks the default session up only once Electron is ready, without dictionary downloads", () => {
    const { feature, ipc, session, spellCheck, deps } = setUp("win32");
    expect(session).not.toHaveBeenCalled();

    feature.register?.(ipc, () => true);

    expect(spellCheck.setSpellCheckerDictionaryDownloadURL).toHaveBeenCalledOnce();
    expect(deps.crashReports.registerHandlers).toHaveBeenCalledOnce();
  });

  it("registers Help's, the guides', the licences', spell check's and its own calls", () => {
    const { feature, ipc, handlers } = setUp("win32");
    feature.register?.(ipc, () => true);

    expect([...handlers.keys()]).toEqual(
      expect.arrayContaining([
        "app:get-info",
        "app:set-native-menus",
        "app:set-spellcheck-language",
        "app:open-guide",
        "app:list-licences",
        "help:open",
      ]),
    );
  });

  it("answers its version", async () => {
    const { feature, ipc, invoke } = setUp("win32");
    feature.register?.(ipc, () => true);

    expect(await invoke("app:get-info")).toMatchObject({ version: "1.2.3" });
  });

  it("leaves the menu bar alone off macOS, and sets it on macOS (LF-13)", async () => {
    const windows = setUp("win32");
    windows.feature.register?.(windows.ipc, () => true);
    expect(await windows.invoke("app:set-native-menus", [])).toBeNull();
    expect(windows.menu.setApplicationMenu).not.toHaveBeenCalled();

    const mac = setUp("darwin");
    mac.feature.register?.(mac.ipc, () => true);
    expect(await mac.invoke("app:set-native-menus", [])).toBeNull();
    expect(mac.menu.setApplicationMenu).toHaveBeenCalledOnce();
  });
});
