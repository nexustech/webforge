import type { IpcMain } from "electron";
import type { Backups } from "./backups.js";
import { registerIpcHandler } from "./ipc.js";
import type { ProjectSession } from "./project-session.js";
import { openOrRecover, type RecoveryDialogs } from "./recovery.js";

/** Native file dialogs, injected so the handlers can be tested without Electron. */
export type ProjectDialogs = {
  /** Asks where to save a new site; `undefined` if the user cancels. */
  chooseNewProjectPath(): Promise<string | undefined>;
  /** Asks which site to open; `undefined` if the user cancels. */
  chooseProjectToOpen(): Promise<string | undefined>;
};

/**
 * Registers the site IPC calls. The renderer never sends a file path: the main process asks the
 * user with a native dialog, so a compromised renderer cannot open or overwrite arbitrary files.
 */
export function registerProjectHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  session: ProjectSession,
  dialogs: ProjectDialogs,
  /** Offers a damaged site's backups when it opens as `corrupt` (1.7). */
  recovery?: {
    readonly backups: Pick<Backups, "list" | "restore">;
    readonly dialogs: RecoveryDialogs;
  },
): void {
  registerIpcHandler(ipc, "createProject", isTrustedSender, async () => {
    const path = await dialogs.chooseNewProjectPath();
    return path === undefined ? { status: "canceled" } : session.create(path);
  });
  registerIpcHandler(ipc, "openProject", isTrustedSender, async () => {
    const path = await dialogs.chooseProjectToOpen();
    if (path === undefined) {
      return { status: "canceled" };
    }
    return recovery === undefined
      ? session.open(path)
      : openOrRecover(session, path, recovery.backups, recovery.dialogs);
  });
  registerIpcHandler(ipc, "getCurrentProject", isTrustedSender, () => session.current());
  registerIpcHandler(ipc, "readSite", isTrustedSender, () => session.readSite());
  registerIpcHandler(ipc, "commitSite", isTrustedSender, (changes) => session.commit(changes));
}
