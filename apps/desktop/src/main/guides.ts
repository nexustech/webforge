import type { IpcMain } from "electron";
import type { Guide } from "../shared/ipc/app.js";
import { registerIpcHandler } from "./ipc.js";

/**
 * Where each of Site Check's guides goes (3.17, SEO-7): Google's own pages for a Business Profile
 * and for Search Console. Fixed here, so the renderer names a guide, never an address.
 */
export const GUIDE_ADDRESSES: Readonly<Record<Guide, string>> = {
  businessProfile: "https://www.google.com/business/",
  searchConsole: "https://search.google.com/search-console",
};

/**
 * Registers `app:open-guide`: opens a guide's page in the default browser (`shell.openExternal`),
 * answering `false` when it couldn't.
 */
export function registerGuideHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  openExternal: (url: string) => Promise<void>,
): void {
  registerIpcHandler(ipc, "openGuide", isTrustedSender, async (guide) => {
    try {
      await openExternal(GUIDE_ADDRESSES[guide]);
      return true;
    } catch {
      return false;
    }
  });
}
