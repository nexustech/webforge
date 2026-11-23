import type { IpcMain } from "electron";
import type { Guide } from "../shared/ipc/app.js";
import { registerIpcHandler } from "./ipc.js";

/**
 * Where each guide goes: Site Check's to Google's own pages for a Business Profile and for Search
 * Console (3.17, SEO-7), and the assistant's to OpenRouter's page for adding credit (5.20). Fixed
 * here, so the renderer names a guide, never an address.
 */
export const GUIDE_ADDRESSES: Readonly<Record<Guide, string>> = {
  businessProfile: "https://www.google.com/business/",
  searchConsole: "https://search.google.com/search-console",
  openRouterCredits: "https://openrouter.ai/settings/credits",
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
