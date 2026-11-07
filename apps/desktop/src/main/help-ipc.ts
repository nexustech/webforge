import type { IpcMain } from "electron";
import type { HelpWindows } from "./help-window.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";

/**
 * Registers the `help` IPC calls (5.4b), each from its own window only: the editor's opens Help,
 * and the Help window's page opens a page on the web in the browser. The Help window can call
 * nothing else, as every other call checks for the editor's page.
 */
export function registerHelpHandlers(
  ipc: Pick<IpcMain, "handle">,
  isEditorPage: (senderUrl: string) => boolean,
  help: Pick<HelpWindows, "open" | "isHelpPage">,
  openExternal: (url: string) => Promise<void>,
): void {
  registerIpcHandler(ipc, "helpOpen", isEditorPage, (target) => {
    help.open(target);
    return true;
  });
  registerIpcHandler(ipc, "helpOpenExternal", help.isHelpPage, async (url) => {
    try {
      await openExternal(url);
      return true;
    } catch (error) {
      logFailure("Webforge could not open a help page's link", error);
      return false;
    }
  });
}
