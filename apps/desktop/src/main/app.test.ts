import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MEDIA_SCHEME } from "../shared/ipc/media.js";
import { ipcContract } from "../shared/ipc-contract.js";
import { type AppElectron, type AppParts, startApp } from "./app.js";
import { FONT_SCHEME } from "./fonts.js";
import { registerIpcHandler } from "./ipc.js";
import { ProjectSession } from "./project-session.js";
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
    // Ready a moment later, as Electron is: after the entry point has finished evaluating.
    whenReady: () =>
      Promise.resolve().then(() => {
        ready = true;
      }),
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
    clipboard: {
      read: vi.fn(async () => []),
      write: vi.fn(async () => undefined),
      has: vi.fn(async () => false),
    },
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
    shell: { openPath: vi.fn(async () => ""), showItemInFolder: vi.fn() },
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
    session,
    userData,
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

/** An image's bytes as a copy keeps them in the user's data (1.25); returns the folder. */
function keepCopiedImage(userData: string): string {
  const folder = join(userData, "clipboard");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "a".repeat(64)), "bytes");
  return folder;
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

    const kept = keepCopiedImage(fake.userData);

    fake.appEvents.emit("before-quit");
    fake.appEvents.emit("will-quit", { preventDefault });
    fake.appEvents.emit("will-quit", { preventDefault });
    await vi.waitFor(() => expect(fake.app.exit).toHaveBeenCalledWith(0));

    // The copied elements' images don't outlive Webforge (R13d).
    expect(existsSync(kept)).toBe(false);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(fake.app.exit).toHaveBeenCalledTimes(1);
    expect(fake.app.releaseSingleInstanceLock).toHaveBeenCalledTimes(1);
  });

  it("forgets the copied images when its window is focused after something else was copied", async () => {
    const fake = fakeElectron();
    await fake.start();
    // The fake system clipboard holds nothing, so no elements.
    const kept = keepCopiedImage(fake.userData);

    fake.windows[0]?.events.emit("focus");

    await vi.waitFor(() => expect(existsSync(kept)).toBe(false));
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
    const open = vi.spyOn(ProjectSession.prototype, "open");
    const preventDefault = vi.fn();
    const path = join(fake.parts.dir, "Missing.wforge");
    const started = fake.start();

    fake.appEvents.emit("open-file", { preventDefault }, path);
    expect(fake.app.isReady()).toBe(false);
    await started;

    expect(preventDefault).toHaveBeenCalled();
    // Opened as the start-up site, before the window, not handed over afterwards: no warning.
    expect(open).toHaveBeenCalledWith(path);
    expect(fake.dialog.showMessageBox).not.toHaveBeenCalled();
    expect(fake.windows).toHaveLength(1);
  });

  it("serves no Media or font that isn't there, and leaves the menu bar to macOS", async () => {
    const fake = fakeElectron();
    await fake.start();
    const handle = vi.mocked(fake.session.defaultSession.protocol.handle);
    const respond = (scheme: string, url: string) => {
      const handler = handle.mock.calls.find(([name]) => name === scheme)?.[1] as
        | ((request: { url: string }) => Promise<Response>)
        | undefined;
      if (handler === undefined) throw new Error(`no handler for ${scheme}`);
      return handler({ url });
    };

    expect((await respond(MEDIA_SCHEME, `${MEDIA_SCHEME}://media/${"a".repeat(64)}`)).ok).toBe(
      false,
    );
    expect((await respond(FONT_SCHEME, `${FONT_SCHEME}://fonts/missing.woff2`)).ok).toBe(false);
    await expect(fake.invoke("app:set-native-menus", [])).resolves.toBeNull();
  });

  it("opens a window again for a site handed over while none is open", async () => {
    const fake = fakeElectron();
    await fake.start();
    fake.windows[0]?.close();

    fake.appEvents.emit("second-instance", {}, ["webforge"], fake.parts.dir);

    await vi.waitFor(() => expect(fake.windows).toHaveLength(1));
  });

  it("keeps a second launch from releasing the lock it never held, or the copied images", async () => {
    const fake = fakeElectron({ primary: false });
    void fake.start();
    const kept = keepCopiedImage(fake.userData);

    fake.appEvents.emit("will-quit", { preventDefault: vi.fn() });
    await vi.waitFor(() => expect(fake.app.exit).toHaveBeenCalledWith(0));

    expect(fake.app.releaseSingleInstanceLock).not.toHaveBeenCalled();
    // The running Webforge's, in the same user data.
    expect(existsSync(kept)).toBe(true);
  });
});
