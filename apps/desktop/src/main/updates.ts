import type { UpdateStatus } from "../shared/ipc/updates.js";
import { log, logFailure } from "./log.js";
import { defaultTimers, type Timers } from "./timers.js";

/** The first check, once Webforge has started and opened its site (0.5a). */
export const FIRST_CHECK_MS = 10 * 1_000;
/** The checks after it, while Webforge stays open. */
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1_000;

/**
 * What the update service needs of electron-updater, so it can be tested with a fake one
 * ({@link electronUpdater} makes it from the real `autoUpdater`).
 */
export type Updater = {
  /**
   * Looks for an update on the feed and, if there is one, starts downloading it in the background.
   * Never rejects: a failure arrives through `onError`.
   */
  check(): Promise<void>;
  /** Calls `listener` with the version of an update found, as its download starts. */
  onAvailable(listener: (version: string) => void): void;
  /** Calls `listener` with the version of an update downloaded and ready to install. */
  onDownloaded(listener: (version: string) => void): void;
  /** Calls `listener` when a check or a download fails. */
  onError(listener: (error: unknown) => void): void;
  /** Starts the downloaded update's installer, silently, to run once Webforge has exited. */
  install(): void;
};

/** The update service: checks, downloads in the background and installs as Webforge exits. */
export type UpdateService = {
  /** Checks {@link FIRST_CHECK_MS} from now, then every {@link CHECK_EVERY_MS}. */
  start(): void;
  /** The update's state now. */
  status(): UpdateStatus;
  /** Webforge is exiting: installs a downloaded update, which replaces it once it has exited. */
  installOnQuit(): void;
  /** No more checks. */
  stop(): void;
};

/**
 * Webforge's own updates (0.5a, ADR 0024): electron-updater checks the feed {@link FIRST_CHECK_MS}
 * after `start`, then every {@link CHECK_EVERY_MS}, downloads an update in the background and
 * installs it once Webforge exits. Nothing interrupts the person: `onStatus` tells the window, which
 * shows a quiet notice once one is downloaded. A failure is logged by its code only and never shown;
 * the next check tries again. Once an update is downloaded the checks stop: it installs as Webforge
 * closes, and the next launch looks for any later one.
 */
export function createUpdateService({
  updater,
  onStatus,
  timers = defaultTimers,
}: {
  readonly updater: Updater;
  /** The update's state changed. */
  readonly onStatus: (status: UpdateStatus) => void;
  readonly timers?: Timers;
}): UpdateService {
  let current: UpdateStatus = { state: "idle" };
  let timer: unknown;
  let stopped = false;

  const set = (next: UpdateStatus) => {
    current = next;
    onStatus(next);
  };
  const downloaded = () => current.state === "downloaded";

  updater.onAvailable((version) => {
    if (downloaded()) return;
    log.info("Webforge found an update", { version });
    set({ state: "available", version });
  });
  updater.onDownloaded((version) => {
    log.info("Webforge downloaded an update", { version });
    set({ state: "downloaded", version });
    stop();
  });
  updater.onError((error) => {
    logFailure("Webforge could not update itself", error);
    // A downloaded update still installs: a later failure doesn't undo it.
    if (!downloaded()) set({ state: "error" });
  });

  const check = async () => {
    timer = undefined;
    if (stopped || downloaded()) return;
    // The last failure is behind it: this check finds an update, nothing, or fails again.
    if (current.state === "error") set({ state: "idle" });
    try {
      await updater.check();
    } catch (error) {
      // `check` reports through onError, but a broken updater must not stop the next check.
      logFailure("Webforge could not check for updates", error);
    }
    schedule(CHECK_EVERY_MS);
  };
  const schedule = (ms: number) => {
    if (stopped || downloaded() || timer !== undefined) return;
    timer = timers.setTimeout(() => void check(), ms);
  };
  const stop = () => {
    if (timer !== undefined) timers.clearTimeout(timer);
    timer = undefined;
  };

  return {
    start: () => schedule(FIRST_CHECK_MS),
    status: () => current,
    installOnQuit: () => {
      stopped = true;
      stop();
      if (!downloaded()) return;
      try {
        updater.install();
        log.info("Webforge is installing an update", { version: current.version });
      } catch (error) {
        logFailure("Webforge could not install an update", error);
      }
    },
    stop: () => {
      stopped = true;
      stop();
    },
  };
}

/** The part of electron-updater's `autoUpdater` that {@link electronUpdater} uses. */
export type ElectronAutoUpdater = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger: unknown;
  checkForUpdates(): Promise<unknown>;
  on(
    event: "update-available" | "update-downloaded",
    listener: (info: { version: string }) => void,
  ): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  install(isSilent?: boolean, isForceRunAfter?: boolean): boolean;
};

/**
 * {@link Updater} on electron-updater's `autoUpdater`. It downloads what it finds at once. It
 * doesn't install on Electron's "quit" event, which Webforge's own exit (`app.exit` once the site
 * has closed) never emits: the service installs from Webforge's quit instead. Its own log is off,
 * as it writes paths and addresses; the service logs codes only.
 */
export function electronUpdater(autoUpdater: ElectronAutoUpdater): Updater {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = null;
  return {
    // checkForUpdates rejects after emitting "error" with the same failure, which onError reports.
    check: () =>
      autoUpdater.checkForUpdates().then(
        () => undefined,
        () => undefined,
      ),
    onAvailable: (listener) => autoUpdater.on("update-available", (info) => listener(info.version)),
    onDownloaded: (listener) =>
      autoUpdater.on("update-downloaded", (info) => listener(info.version)),
    onError: (listener) => autoUpdater.on("error", listener),
    install: () => {
      // Silent, and not started again: the person closed Webforge.
      if (!autoUpdater.install(true, false)) throw new Error("UpdateInstallFailed");
    },
  };
}

/**
 * Whether this build updates itself (0.5a): a packaged Windows app. Not one run from its build
 * folder, which has no feed, and not yet on macOS, where an update must be signed to install (0.5b).
 */
export function updatesSupported(packaged: boolean, platform: NodeJS.Platform): boolean {
  return packaged && platform === "win32";
}
