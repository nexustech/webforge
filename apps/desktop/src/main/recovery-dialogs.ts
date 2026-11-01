import { t } from "@webforge/i18n";
import { BrowserWindow, dialog, type MessageBoxOptions, type OpenDialogOptions } from "electron";
import { type RecoveryChoice, type RecoveryDialogs, recoveryMessage } from "./recovery.js";
import { PROJECT_EXTENSION } from "./site-paths.js";

// Electron wiring only: the flow lives in recovery.ts and is unit-tested; E2E tests replace the
// dialog functions, so they are looked up on the module at call time.

const CHOICES: readonly RecoveryChoice[] = ["latest", "choose", "cancel"];

async function showMessageBox(options: MessageBoxOptions): Promise<number> {
  const parent = BrowserWindow.getFocusedWindow();
  const result = await (parent === null
    ? dialog.showMessageBox(options)
    : dialog.showMessageBox(parent, options));
  return result.response;
}

/** The native dialogs of the damaged-site recovery (1.7). */
export const recoveryDialogs: RecoveryDialogs = {
  ask: async (backups) => {
    const latest = backups[0];
    if (latest === undefined) return "cancel";
    const response = await showMessageBox({
      type: "warning",
      ...recoveryMessage(latest),
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    return CHOICES[response] ?? "cancel";
  },
  chooseBackup: async (folder) => {
    const options: OpenDialogOptions = {
      title: t("storage.recovery.chooseTitle"),
      defaultPath: folder,
      filters: [{ name: t("site.fileType"), extensions: [PROJECT_EXTENSION.slice(1)] }],
      properties: ["openFile"],
    };
    const parent = BrowserWindow.getFocusedWindow();
    const result = await (parent === null
      ? dialog.showOpenDialog(options)
      : dialog.showOpenDialog(parent, options));
    return result.canceled ? undefined : result.filePaths[0];
  },
  noBackups: async () => {
    await showMessageBox({
      type: "error",
      title: t("storage.recovery.title"),
      message: t("storage.recovery.noBackups"),
    });
  },
};
