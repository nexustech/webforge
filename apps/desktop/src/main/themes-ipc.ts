import type { IpcMain } from "electron";
import { registerIpcHandler } from "./ipc.js";
import type { MyThemes } from "./my-themes.js";

/**
 * Registers the `themes` IPC calls (2.23): My themes, the person's own themes kept on this
 * computer, listed, kept and removed in `themes` (main checks each theme against the model).
 */
export function registerThemesHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  themes: MyThemes,
): void {
  registerIpcHandler(ipc, "listThemes", isTrustedSender, () => themes.list());
  registerIpcHandler(ipc, "keepTheme", isTrustedSender, (theme) => themes.keep(theme));
  registerIpcHandler(ipc, "removeTheme", isTrustedSender, async (id) => {
    await themes.remove(id);
    return null;
  });
}
