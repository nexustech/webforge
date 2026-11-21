import type { startCrashReports } from "./crash-wiring.js";
import type { E2eDialog } from "./e2e-dialogs.js";
import type { RecoveryDialogs } from "./recovery.js";
import type { WriterThread } from "./storage-writer.js";
import type { Updater } from "./updates.js";

/** The parts of Electron the app uses; a fake in tests. */
export type AppElectron = Pick<
  typeof import("electron"),
  | "app"
  | "BrowserWindow"
  | "ClipboardItem"
  | "clipboard"
  | "dialog"
  | "ipcMain"
  | "Menu"
  | "nativeTheme"
  | "net"
  | "protocol"
  | "safeStorage"
  | "screen"
  | "session"
  | "shell"
  | "utilityProcess"
>;

/** What the entry point hands the app besides Electron: the modules that use Electron directly. */
export type AppParts = {
  /** The built main process's folder, beside the preload, the editor and the workers. */
  readonly dir: string;
  /** Local crash reports (crash-wiring.ts), started first, so even a failing start leaves one. */
  readonly startCrashReports: typeof startCrashReports;
  /** The native dialogs of the damaged-site recovery (recovery-dialogs.ts). */
  readonly recoveryDialogs: RecoveryDialogs;
  /** Starts the storage writer's thread from its script (R13b, ADR 0013). */
  readonly startStorageWriter: (script: string) => WriterThread;
  /** Loads electron-updater (0.5a), only in a build that updates itself (`updatesSupported`). */
  readonly updater: () => Promise<Updater>;
};

/**
 * A test's answer for a native file dialog, in `--mode e2e` builds only (see e2e-dialogs.ts):
 * the packaged E2E tests can't replace `dialog` as the unpacked ones do. Other builds drop the
 * branch, and the module with it.
 */
export async function testDialogAnswer(
  kind: E2eDialog,
): Promise<{ path: string | undefined } | undefined> {
  if (import.meta.env.MODE !== "e2e") {
    return undefined;
  }
  const { e2eDialogAnswer } = await import("./e2e-dialogs.js");
  return e2eDialogAnswer(kind);
}
