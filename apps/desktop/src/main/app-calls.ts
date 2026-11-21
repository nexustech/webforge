import { dirname } from "node:path";
import { t } from "@webforge/i18n";
import type { App, BrowserWindow, Menu, Session, Shell, WebContents } from "electron";
import { appEvents } from "../shared/ipc/app.js";
import type { AppFeature } from "./app-feature.js";
import { applicationMenu, runMenuCommand } from "./app-menu.js";
import { registerFailureLog } from "./failure-ipc.js";
import { registerGuideHandlers } from "./guides.js";
import { registerHelpHandlers } from "./help-ipc.js";
import type { HelpWindows } from "./help-window.js";
import { registerIpcHandler } from "./ipc.js";
import { licenceFiles, registerLicenceHandlers } from "./licences.js";
import { REPORT_EMAIL, registerReportHandlers, reportParts } from "./report-problem.js";
import { registerSpellCheckHandlers } from "./spellcheck.js";

/** What the app's own calls work with (#985). */
export type AppCallsDeps = {
  readonly app: Pick<
    App,
    "getVersion" | "isPackaged" | "getAppPath" | "getPreferredSystemLanguages"
  >;
  readonly menu: Pick<typeof Menu, "setApplicationMenu" | "buildFromTemplate">;
  readonly focusedWindow: () => BrowserWindow | null;
  /** Looked up when Electron is ready: the default session is made then. */
  readonly session: () => Session;
  /** Looked up as each is called: the E2E tests stand in for the browser and the file manager. */
  readonly shell: () => Pick<Shell, "openExternal" | "openPath">;
  readonly platform: NodeJS.Platform;
  /** Run from the dev server, whose menu has reload and the developer tools. */
  readonly development: boolean;
  readonly helpWindows: HelpWindows;
  /** The editor's window, which runs a menu's commands, and Report a Problem's screenshot takes. */
  readonly mainWindow: () =>
    | { readonly webContents: Pick<WebContents, "send" | "capturePage"> }
    | undefined;
  /** Local crash reports: Help → Open Crash Reports Folder, and the renderer's errors (R3). */
  readonly crashReports: { registerHandlers: NonNullable<AppFeature["register"]> };
  /** Help › Report a Problem (OL-10): its screenshot's Save dialog. */
  readonly reportDialogs: { chooseScreenshotToSave(): Promise<string | undefined> };
};

/**
 * The app's own calls, whichever site is open (#985): its name and version, the macOS menu bar,
 * spell check, the renderer's failures and crashes, guides, Help, and the open-source licences.
 */
export function appCallsFeature(deps: AppCallsDeps): AppFeature {
  return {
    register(ipc, isTrustedSender) {
      registerIpcHandler(ipc, "getAppInfo", isTrustedSender, () => ({
        name: t("app.name"),
        version: deps.app.getVersion(),
      }));
      // On macOS the editor's menus are the menu bar's (LF-13): rebuilt as its commands change.
      registerIpcHandler(ipc, "setNativeMenus", isTrustedSender, (menus) => {
        if (deps.platform !== "darwin") return null;
        const template = applicationMenu(deps.platform, deps.development, {
          menus,
          // Undo and Redo, whose keys the menu bar takes, act on the Help window when it's in front.
          run: (id) =>
            runMenuCommand(id, {
              focused: deps.focusedWindow,
              isOther: (window) => deps.helpWindows.is(window),
              runInEditor: (command) =>
                deps.mainWindow()?.webContents.send(appEvents.runCommand.channel, command),
            }),
        });
        deps.menu.setApplicationMenu(
          template === null ? null : deps.menu.buildFromTemplate(template),
        );
        return null;
      });
      registerSpellCheckHandlers(
        ipc,
        isTrustedSender,
        deps.session(),
        deps.platform,
        deps.app.getPreferredSystemLanguages(),
      );
      deps.crashReports.registerHandlers(ipc, isTrustedSender);
      registerFailureLog(ipc, isTrustedSender);
      const openExternal = (url: string) => deps.shell().openExternal(url);
      registerGuideHandlers(ipc, isTrustedSender, openExternal);
      // Help → Open-Source Licences (5.3): the build's notices, and Chromium's own.
      registerLicenceHandlers(
        ipc,
        isTrustedSender,
        licenceFiles({
          packaged: deps.app.isPackaged,
          platform: deps.platform,
          appPath: deps.app.getAppPath(),
          resourcesPath: process.resourcesPath,
          execDir: dirname(process.execPath),
        }),
        (path) => deps.shell().openPath(path),
      );
      registerHelpHandlers(ipc, isTrustedSender, deps.helpWindows, openExternal);
      // Help › Report a Problem (OL-10): opened in the browser or mail app; nothing sent from here.
      registerReportHandlers(ipc, isTrustedSender, {
        ...reportParts(deps.mainWindow, deps.reportDialogs),
        version: deps.app.getVersion(),
        email: REPORT_EMAIL,
        openExternal,
      });
    },
  };
}
