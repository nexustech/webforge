import type { IpcMain } from "electron";
import type { Backups } from "./backups.js";
import { registerIpcHandler } from "./ipc.js";
import type { ProjectSession } from "./project-session.js";
import type { RecentSites } from "./recent-sites.js";
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
  options: {
    /** Offers a damaged site's backups when it opens as `corrupt` (1.7). */
    readonly recovery?: {
      readonly backups: Pick<Backups, "list" | "restore">;
      readonly dialogs: RecoveryDialogs;
    };
    /** The start screen's Recent list (1.8). */
    readonly recent?: Pick<RecentSites, "list" | "pathOf" | "remove">;
    /**
     * Runs before another site replaces the open one: the renderer saves its last changes and
     * the canvas is captured for the Recent list.
     */
    readonly beforeSwitch?: () => Promise<void>;
  } = {},
): void {
  const { recovery, recent, beforeSwitch } = options;
  const open = async (path: string) => {
    await beforeSwitch?.();
    return recovery === undefined
      ? session.open(path)
      : openOrRecover(session, path, recovery.backups, recovery.dialogs);
  };
  registerIpcHandler(ipc, "createProject", isTrustedSender, async () => {
    const path = await dialogs.chooseNewProjectPath();
    if (path === undefined) {
      return { status: "canceled" };
    }
    await beforeSwitch?.();
    return session.create(path);
  });
  registerIpcHandler(ipc, "openProject", isTrustedSender, async () => {
    const path = await dialogs.chooseProjectToOpen();
    return path === undefined ? { status: "canceled" } : open(path);
  });
  registerIpcHandler(ipc, "listRecentSites", isTrustedSender, () => recent?.list() ?? []);
  registerIpcHandler(ipc, "openRecentSite", isTrustedSender, async (id) => {
    const path = recent?.pathOf(id);
    if (path === undefined) {
      return { status: "failed", reason: "not-found" };
    }
    const result = await open(path);
    if (result.status === "failed" && result.reason === "not-found") {
      recent?.remove(id);
    }
    return result;
  });
  registerIpcHandler(ipc, "removeRecentSite", isTrustedSender, (id) => {
    recent?.remove(id);
    return null;
  });
  registerIpcHandler(ipc, "getCurrentProject", isTrustedSender, () => session.current());
  registerIpcHandler(ipc, "readSite", isTrustedSender, () => session.readSite());
  // Only from a renderer loaded for the site open now (R6): a save on its way while another site
  // replaced it is refused.
  registerIpcHandler(ipc, "commitSite", isTrustedSender, (sessionId, changes) => {
    const reason = session.staleReason(sessionId);
    return reason === undefined ? session.commit(changes) : { status: "failed", reason };
  });
  registerIpcHandler(ipc, "getUiState", isTrustedSender, () => session.uiState());
  registerIpcHandler(ipc, "setUiState", isTrustedSender, (sessionId, state) => {
    const reason = session.staleReason(sessionId);
    return reason === undefined ? session.setUiState(state) : { status: "failed", reason };
  });
}
