import type { IpcMain } from "electron";
import type { AppFeature } from "./app-feature.js";
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

/** My themes as a feature (A12): their IPC calls, and their last write finished before Webforge exits. */
export function myThemesFeature(themes: MyThemes): AppFeature {
  return {
    register: (ipc, isTrustedSender) => {
      registerThemesHandlers(ipc, isTrustedSender, themes);
    },
    quit: () => themes.idle(),
  };
}
