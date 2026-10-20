import { mkdirSync } from "node:fs";
import { release } from "node:os";
import { join } from "node:path";
import { t } from "@webforge/i18n";
import { app, BrowserWindow, crashReporter, dialog, type IpcMain, shell } from "electron";
import { installCrashHandlers, noticeAfterCrash } from "./crash-handlers.js";
import { createCrashReports } from "./crash-reports.js";
import { registerIpcHandler } from "./ipc.js";

// Electron wiring only: reports, redaction and the handlers live in crash-reports.ts and
// crash-handlers.ts and are unit-tested.

/**
 * Starts local crash reporting (F-SITE-7, architecture §9) as early as possible: crashReporter for
 * native crashes, handlers for uncaught errors and processes that went away, all writing to
 * `userData/crash-reports`. Nothing is ever uploaded.
 */
export function startCrashReports() {
  const reports = createCrashReports({ dir: join(app.getPath("userData"), "crash-reports") });
  installCrashHandlers(
    { process, app, crashReporter },
    reports,
    {
      appVersion: app.getVersion(),
      versions: {
        electron: process.versions.electron ?? "",
        chrome: process.versions.chrome ?? "",
        node: process.versions.node,
      },
      os: { platform: process.platform, arch: process.arch, release: release() },
      appPath: app.getAppPath(),
      privatePaths: [app.getPath("home"), app.getPath("userData"), app.getPath("temp")],
      memory: () => process.memoryUsage(),
    },
    // An uncaught exception leaves the main process in an unknown state; the report is written.
    () => app.exit(1),
  );

  const openFolder = async () => {
    mkdirSync(reports.dir, { recursive: true });
    await shell.openPath(reports.dir);
  };

  return {
    /** Registers Help → Open Crash Reports Folder's IPC call. */
    registerHandlers(ipc: Pick<IpcMain, "handle">, isTrustedSender: (url: string) => boolean) {
      registerIpcHandler(ipc, "openCrashReports", isTrustedSender, async () => {
        await openFolder();
        return null;
      });
    },
    /** Shows the next-launch notice if Webforge crashed since the user was last told. */
    noticeAfterLaunch(): Promise<void> {
      return noticeAfterCrash(
        reports,
        async () => {
          const options = {
            type: "info" as const,
            title: t("storage.crash.title"),
            message: t("storage.crash.message"),
            detail: t("storage.crash.detail"),
            buttons: [t("storage.crash.openFolder"), t("storage.crash.ok")],
            defaultId: 1,
            cancelId: 1,
            noLink: true,
          };
          const parent = BrowserWindow.getFocusedWindow();
          const result = await (parent === null
            ? dialog.showMessageBox(options)
            : dialog.showMessageBox(parent, options));
          return result.response === 0;
        },
        openFolder,
      );
    },
  };
}
