import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateStatus } from "../shared/ipc/updates.js";
import { setLogSink } from "./log.js";
import {
  CHECK_EVERY_MS,
  createUpdateService,
  type ElectronAutoUpdater,
  electronUpdater,
  FIRST_CHECK_MS,
  type Updater,
  updatesSupported,
} from "./updates.js";

/** An updater whose events the test fires, and whose checks it counts. */
function fakeUpdater() {
  const listeners = {
    available: [] as ((version: string) => void)[],
    downloaded: [] as ((version: string) => void)[],
    error: [] as ((error: unknown) => void)[],
  };
  const updater = {
    check: vi.fn(async () => undefined),
    onAvailable: (listener: (version: string) => void) => listeners.available.push(listener),
    onDownloaded: (listener: (version: string) => void) => listeners.downloaded.push(listener),
    onError: (listener: (error: unknown) => void) => listeners.error.push(listener),
    install: vi.fn(),
  } satisfies Updater;
  return {
    updater,
    available: (version: string) => {
      for (const listener of listeners.available) listener(version);
    },
    downloaded: (version: string) => {
      for (const listener of listeners.downloaded) listener(version);
    },
    error: (error: unknown) => {
      for (const listener of listeners.error) listener(error);
    },
  };
}

function serviceWith(fake = fakeUpdater()) {
  const statuses: UpdateStatus[] = [];
  const service = createUpdateService({
    updater: fake.updater,
    onStatus: (status) => statuses.push(status),
    timers: {
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    },
  });
  return { ...fake, service, statuses };
}

let lines: string[];
beforeEach(() => {
  vi.useFakeTimers();
  lines = [];
  setLogSink((level, line) => lines.push(`${level} ${line}`));
});
afterEach(() => {
  vi.useRealTimers();
  setLogSink();
});

describe("createUpdateService (0.5a)", () => {
  it("checks 10 seconds after it starts, then every 6 hours", async () => {
    const { service, updater } = serviceWith();
    service.start();

    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS - 1);
    expect(updater.check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(updater.check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(updater.check).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(updater.check).toHaveBeenCalledTimes(3);
    expect(FIRST_CHECK_MS).toBe(10_000);
    expect(CHECK_EVERY_MS).toBe(6 * 60 * 60 * 1_000);
  });

  it("starts once however often it's told to", async () => {
    const { service, updater } = serviceWith();
    service.start();
    service.start();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS);
    expect(updater.check).toHaveBeenCalledTimes(1);
  });

  it("tells the window an update found, then downloaded, and stops checking", async () => {
    const fake = serviceWith();
    expect(fake.service.status()).toEqual({ state: "idle" });
    fake.service.start();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS);

    fake.available("1.2.0");
    expect(fake.service.status()).toEqual({ state: "available", version: "1.2.0" });
    fake.downloaded("1.2.0");
    expect(fake.service.status()).toEqual({ state: "downloaded", version: "1.2.0" });
    expect(fake.statuses).toEqual([
      { state: "available", version: "1.2.0" },
      { state: "downloaded", version: "1.2.0" },
    ]);

    await vi.advanceTimersByTimeAsync(3 * CHECK_EVERY_MS);
    expect(fake.updater.check).toHaveBeenCalledTimes(1);
    expect(lines).toEqual([
      "info Webforge found an update (version=1.2.0)",
      "info Webforge downloaded an update (version=1.2.0)",
    ]);
  });

  it("logs a failure by its code only, says so, and tries again at the next check", async () => {
    const fake = serviceWith();
    fake.service.start();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS);

    const failure = Object.assign(
      new Error("net::ERR_NAME_NOT_RESOLVED at https://example.com/a"),
      {
        code: "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND",
      },
    );
    fake.error(failure);
    expect(fake.service.status()).toEqual({ state: "error" });
    expect(lines).toEqual([
      "error Webforge could not update itself (code=Error ERR_UPDATER_CHANNEL_FILE_NOT_FOUND)",
    ]);

    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(fake.updater.check).toHaveBeenCalledTimes(2);
    // That check found nothing: the failure is no longer the state.
    expect(fake.service.status()).toEqual({ state: "idle" });
  });

  it("keeps checking when the updater itself throws", async () => {
    const fake = serviceWith();
    fake.updater.check.mockRejectedValueOnce(new TypeError("broken"));
    fake.service.start();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_MS);
    expect(lines).toEqual(["error Webforge could not check for updates (code=TypeError)"]);

    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(fake.updater.check).toHaveBeenCalledTimes(2);
  });

  it("keeps a downloaded update when a later event fails or finds the same one", () => {
    const fake = serviceWith();
    fake.downloaded("1.2.0");
    fake.error(new Error("later"));
    fake.available("1.2.0");
    expect(fake.service.status()).toEqual({ state: "downloaded", version: "1.2.0" });
  });

  it("installs a downloaded update as Webforge quits, silently, and checks no more", async () => {
    const fake = serviceWith();
    fake.service.start();
    fake.downloaded("1.2.0");
    fake.service.installOnQuit();

    expect(fake.updater.install).toHaveBeenCalledTimes(1);
    expect(lines.at(-1)).toBe("info Webforge is installing an update (version=1.2.0)");
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(fake.updater.check).not.toHaveBeenCalled();
  });

  it("installs nothing as Webforge quits without a downloaded update, and stops checking", async () => {
    const fake = serviceWith();
    fake.service.start();
    fake.available("1.2.0");
    fake.service.installOnQuit();

    expect(fake.updater.install).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(fake.updater.check).not.toHaveBeenCalled();
  });

  it("logs an installer that won't start, and lets Webforge quit", () => {
    const fake = serviceWith();
    fake.updater.install.mockImplementation(() => {
      throw new Error("UpdateInstallFailed");
    });
    fake.downloaded("1.2.0");

    expect(() => fake.service.installOnQuit()).not.toThrow();
    expect(lines.at(-1)).toBe("error Webforge could not install an update (code=Error)");
  });

  it("checks no more once stopped", async () => {
    const fake = serviceWith();
    fake.service.start();
    fake.service.stop();
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(fake.updater.check).not.toHaveBeenCalled();
    fake.service.start();
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(fake.updater.check).not.toHaveBeenCalled();
  });
});

/** electron-updater's `autoUpdater`, as far as {@link electronUpdater} uses it. */
function fakeAutoUpdater() {
  const listeners = new Map<string, (arg: never) => void>();
  const auto = {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    logger: console as unknown,
    checkForUpdates: vi.fn(async (): Promise<unknown> => null),
    on: (event: string, listener: (arg: never) => void) => listeners.set(event, listener),
    install: vi.fn((_isSilent?: boolean, _isForceRunAfter?: boolean) => true),
  };
  return {
    auto,
    emit: (event: string, arg: unknown) => listeners.get(event)?.(arg as never),
  };
}

describe("electronUpdater", () => {
  it("downloads at once, installs only when told, and keeps its own log off", () => {
    const { auto } = fakeAutoUpdater();
    electronUpdater(auto as ElectronAutoUpdater);
    expect(auto).toMatchObject({ autoDownload: true, autoInstallOnAppQuit: false, logger: null });
  });

  it("passes on each event's version, and errors as they are", () => {
    const { auto, emit } = fakeAutoUpdater();
    const updater = electronUpdater(auto as ElectronAutoUpdater);
    const seen: unknown[] = [];
    updater.onAvailable((version) => seen.push(["available", version]));
    updater.onDownloaded((version) => seen.push(["downloaded", version]));
    updater.onError((error) => seen.push(["error", error]));
    const failure = new Error("offline");

    emit("update-available", { version: "1.2.0" });
    emit("update-downloaded", { version: "1.2.0" });
    emit("error", failure);
    expect(seen).toEqual([
      ["available", "1.2.0"],
      ["downloaded", "1.2.0"],
      ["error", failure],
    ]);
  });

  it("checks without rejecting, as the failure comes as an error event", async () => {
    const { auto } = fakeAutoUpdater();
    auto.checkForUpdates.mockRejectedValueOnce(new Error("offline"));
    const updater = electronUpdater(auto as ElectronAutoUpdater);
    await expect(updater.check()).resolves.toBeUndefined();
    await expect(updater.check()).resolves.toBeUndefined();
    expect(auto.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it("installs silently without starting Webforge again, and throws if the installer won't start", () => {
    const { auto } = fakeAutoUpdater();
    const updater = electronUpdater(auto as ElectronAutoUpdater);
    updater.install();
    expect(auto.install).toHaveBeenCalledWith(true, false);
    auto.install.mockReturnValueOnce(false);
    expect(() => updater.install()).toThrow("UpdateInstallFailed");
  });
});

describe("updatesSupported", () => {
  it("is a packaged Windows app only, until macOS updates are signed (0.5b)", () => {
    expect(updatesSupported(true, "win32")).toBe(true);
    expect(updatesSupported(false, "win32")).toBe(false);
    expect(updatesSupported(true, "darwin")).toBe(false);
    expect(updatesSupported(true, "linux")).toBe(false);
  });
});
