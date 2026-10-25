import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ipcContract } from "../shared/ipc-contract.js";
import { type AppElectron, type AppParts, startApp } from "./app.js";
import { registerIpcHandler } from "./ipc.js";
import type { RecoveryDialogs } from "./recovery.js";

type Listener = (...args: unknown[]) => unknown;

/** Listeners by event, as Electron's emitters keep them. */
function emitter() {
  const listeners = new Map<string, Listener[]>();
  return {
    on(event: string, listener: Listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    },
    has: (event: string) => listeners.has(event),
  };
}

const folders: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/**
 * Electron as far as the app uses it, in a folder of its own for the user's data. `primary` is
 * whether this launch gets the single-instance lock.
 */
function fakeElectron(options: { primary?: boolean } = {}) {
  const userData = mkdtempSync(join(tmpdir(), "webforge-app-"));
  folders.push(userData);
  const appEvents = emitter();
  const handlers = new Map<string, Listener>();
  const windows: FakeWindow[] = [];
  let ready = false;

  class FakeWindow {
    readonly events = emitter();
    readonly webContents = Object.assign(emitter(), {
      reload: vi.fn(),
      send: vi.fn(),
      isCrashed: () => false,
    });
    readonly options: unknown;
    destroyed = false;
    readonly maximize = vi.fn();
    readonly show = vi.fn();
    readonly focus = vi.fn();
    readonly restore = vi.fn();
    readonly setBackgroundColor = vi.fn();
    readonly setTitleBarOverlay = vi.fn();
    readonly loadFile = vi.fn(async () => undefined);
    readonly loadURL = vi.fn(async () => undefined);

    constructor(options: unknown) {
      this.options = options;
      windows.push(this);
    }
    on(event: string, listener: Listener) {
      this.events.on(event, listener);
      return this;
    }
    once(event: string, listener: Listener) {
      return this.on(event, listener);
    }
    isMinimized = () => false;
    isMaximized = () => false;
    isFullScreen = () => false;
    isDestroyed = () => this.destroyed;
    getNormalBounds = () => ({ x: 0, y: 0, width: 1280, height: 800 });
    close() {
      this.destroyed = true;
      windows.splice(windows.indexOf(this), 1);
    }
    static getAllWindows = () => [...windows];
    static getFocusedWindow = () => windows[0] ?? null;
  }

  const app = {
    isPackaged: false,
    requestSingleInstanceLock: vi.fn(() => options.primary ?? true),
    releaseSingleInstanceLock: vi.fn(),
    quit: vi.fn(),
    exit: vi.fn(),
    enableSandbox: vi.fn(),
    on: (event: string, listener: Listener) => {
      appEvents.on(event, listener);
      return app;
    },
    whenReady: async () => {
      ready = true;
    },
    isReady: () => ready,
    getPath: () => userData,
    getAppPath: () => userData,
    getVersion: () => "1.2.3",
    getPreferredSystemLanguages: () => ["en-GB"],
  };
  const session = {
    defaultSession: {
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      protocol: { handle: vi.fn() },
      availableSpellCheckerLanguages: ["en-GB"],
      setSpellCheckerLanguages: vi.fn(),
      setSpellCheckerDictionaryDownloadURL: vi.fn(),
    },
  };
  const dialog = {
    showMessageBox: vi.fn(async () => ({ response: 0, checkboxChecked: false })),
    showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: "" })),
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
  };
  const electron = {
    app,
    BrowserWindow: FakeWindow,
    ClipboardItem: class {},
    clipboard: { read: vi.fn(async () => []), write: vi.fn(async () => undefined) },
    dialog,
    ipcMain: {
      handle: (channel: string, handler: Listener) => {
        expect(handlers.has(channel), channel).toBe(false);
        handlers.set(channel, handler);
      },
    },
    Menu: {
      buildFromTemplate: vi.fn((template: unknown) => template),
      setApplicationMenu: vi.fn(),
    },
    net: { fetch: vi.fn() },
    protocol: { registerSchemesAsPrivileged: vi.fn() },
    screen: { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }] },
    session,
    utilityProcess: { fork: vi.fn() },
  };
  const crashReports = {
    // The real ones (crash-wiring.ts) register Help → Open Crash Reports Folder and the
    // renderer's error reports.
    registerHandlers: vi.fn((ipc: Parameters<typeof registerIpcHandler>[0]) => {
      registerIpcHandler(
        ipc,
        "openCrashReports",
        () => true,
        () => null,
      );
      registerIpcHandler(
        ipc,
        "reportError",
        () => true,
        () => null,
      );
    }),
    watchWorker: <W>(worker: W) => worker,
    noticeAfterLaunch: vi.fn(async () => undefined),
  };
  const startCrashReports = vi.fn(() => crashReports);
  const parts: AppParts = {
    dir: join(userData, "out", "main"),
    startCrashReports: startCrashReports as unknown as AppParts["startCrashReports"],
    recoveryDialogs: {} as RecoveryDialogs,
    startStorageWriter: vi.fn(),
  };
  const appUrl = pathToFileURL(join(userData, "out", "renderer", "index.html")).href;

  return {
    electron: electron as unknown as AppElectron,
    parts,
    app,
    appEvents,
    dialog,
    windows,
    startCrashReports,
    crashReports,
    /** Calls `channel` as the editor would. */
    invoke: (channel: string, ...args: unknown[]) => {
      const handler = handlers.get(channel);
      if (handler === undefined) throw new Error(`no handler for ${channel}`);
      return handler({ senderFrame: { url: appUrl } }, ...args);
    },
    channels: () => [...handlers.keys()].sort(),
    /** Starts the app, as index.ts does. */
    start: () => startApp(electron as unknown as AppElectron, parts),
  };
}

describe("startApp", () => {
  it("handles every channel of the IPC contract, and no other", async () => {
    const fake = fakeElectron();

    await fake.start();

    expect(fake.channels()).toEqual(
      Object.values(ipcContract)
        .map((entry) => entry.channel)
        .sort(),
    );
  });

  it("sets Webforge up before Electron is ready: one instance, crash reports, sandbox", () => {
    const fake = fakeElectron();

    void fake.start();

    expect(fake.app.requestSingleInstanceLock).toHaveBeenCalled();
    expect(fake.startCrashReports).toHaveBeenCalledWith(true);
    expect(fake.app.enableSandbox).toHaveBeenCalled();
    expect(fake.app.quit).not.toHaveBeenCalled();
    expect(fake.appEvents.has("web-contents-created")).toBe(true);
  });

  it("opens the editor in its window, shown once it is ready, and tells of a crash", async () => {
    const fake = fakeElectron();

    await fake.start();

    expect(fake.windows).toHaveLength(1);
    const [window] = fake.windows;
    expect(window?.options).toMatchObject({ show: false, minWidth: expect.any(Number) });
    expect(window?.loadFile).toHaveBeenCalledWith(
      join(fake.parts.dir, "..", "renderer", "index.html"),
    );
    expect(window?.maximize).toHaveBeenCalled();
    window?.events.emit("ready-to-show");
    expect(window?.show).toHaveBeenCalled();
    expect(fake.crashReports.noticeAfterLaunch).toHaveBeenCalled();
  });

  it("answers the editor's calls: its name and version, and its theme in the window's colours", async () => {
    const fake = fakeElectron();
    await fake.start();
    const [window] = fake.windows;

    await expect(fake.invoke("app:get-info")).resolves.toEqual({
      name: "Webforge",
      version: "1.2.3",
    });
    await fake.invoke("prefs:set", { theme: "light" });
    await fake.invoke("prefs:set", { theme: "light" });

    expect(window?.setBackgroundColor).toHaveBeenCalledTimes(1);
  });

  it("only quits as a second launch, having handed its site over", async () => {
    const fake = fakeElectron({ primary: false });

    const started = fake.start();
    await Promise.race([started, new Promise((resolve) => setTimeout(resolve, 20))]);

    expect(fake.app.quit).toHaveBeenCalled();
    expect(fake.startCrashReports).toHaveBeenCalledWith(false);
    expect(fake.windows).toHaveLength(0);
  });

  it("closes the site, releases the lock and exits when quitting, once", async () => {
    const fake = fakeElectron();
    await fake.start();
    const preventDefault = vi.fn();

    fake.appEvents.emit("before-quit");
    fake.appEvents.emit("will-quit", { preventDefault });
    fake.appEvents.emit("will-quit", { preventDefault });
    await vi.waitFor(() => expect(fake.app.exit).toHaveBeenCalledWith(0));

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(fake.app.exit).toHaveBeenCalledTimes(1);
    expect(fake.app.releaseSingleInstanceLock).toHaveBeenCalledTimes(1);
  });

  it("quits when its window closes, and opens one again from the Dock", async () => {
    const fake = fakeElectron();
    await fake.start();

    fake.appEvents.emit("window-all-closed");
    expect(fake.app.quit).toHaveBeenCalled();
    fake.windows[0]?.close();
    fake.appEvents.emit("activate");
    fake.appEvents.emit("activate");

    expect(fake.windows).toHaveLength(1);
  });

  it("tells the person when a site handed over by a second launch can't be opened", async () => {
    const fake = fakeElectron();
    await fake.start();

    fake.appEvents.emit("second-instance", {}, ["webforge", "Missing.wforge"], fake.parts.dir);

    await vi.waitFor(() =>
      expect(fake.dialog.showMessageBox).toHaveBeenCalledWith(
        fake.windows[0],
        expect.objectContaining({ type: "warning" }),
      ),
    );
  });

  it("opens a site macOS hands it before it is ready, once it is", async () => {
    const fake = fakeElectron();
    const preventDefault = vi.fn();
    const started = fake.start();

    fake.appEvents.emit("open-file", { preventDefault }, join(fake.parts.dir, "Missing.wforge"));
    await started;

    expect(preventDefault).toHaveBeenCalled();
    // The site couldn't be opened, so the window shows the start screen.
    expect(fake.windows).toHaveLength(1);
  });
});
