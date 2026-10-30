import type { IpcMain } from "electron";
import type { Backups } from "./backups.js";
import { registerIpcHandler } from "./ipc.js";
import { fillNewSite, type TemplateReader } from "./new-site.js";
import type { ProjectSession } from "./project-session.js";
import type { RecentSites } from "./recent-sites.js";
import { openOrRecover, type RecoveryDialogs } from "./recovery.js";

/** Native file dialogs, injected so the handlers can be tested without Electron. */
export type ProjectDialogs = {
  /**
   * Asks where to save a new site, offering a file named after it (`siteFileName`); `undefined` if
   * the user cancels.
   */
  chooseNewProjectPath(siteName: string): Promise<string | undefined>;
  /** Asks which site to open; `undefined` if the user cancels. */
  chooseProjectToOpen(): Promise<string | undefined>;
};

/** Characters no file name may have on Windows, macOS or Linux. */
const UNSAFE_IN_FILE_NAMES = /[<>:"/\\|?*\p{Cc}]/gu;

/** Names Windows keeps for devices, which no file may have, whatever its extension. */
const RESERVED_FILE_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/**
 * The file name New Site's save dialog offers for a site called `name` (2.14a), without the
 * extension: characters a file name can't have become "-", and trailing dots and spaces go, as
 * Windows drops them. `fallback` when nothing usable is left.
 */
export function siteFileName(name: string, fallback: string): string {
  const cleaned = name
    .replace(UNSAFE_IN_FILE_NAMES, "-")
    .trim()
    .replace(/[. ]+$/, "");
  return cleaned === "" || RESERVED_FILE_NAMES.test(cleaned) ? fallback : cleaned;
}

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
    readonly recent?: Pick<
      RecentSites,
      "list" | "pathOf" | "remove" | "setPinned" | "clearUnpinned"
    >;
    /**
     * Runs before another site replaces the open one: the renderer saves its last changes and
     * the canvas is captured for the Recent list.
     */
    readonly beforeSwitch?: () => Promise<void>;
    /** Reads a template the app ships, which New Site makes a site from (2.14a, 2.15c). */
    readonly template?: TemplateReader;
  } = {},
): void {
  const {
    recovery,
    recent,
    beforeSwitch,
    template = (id) => {
      throw new Error(`No template ${id}`);
    },
  } = options;
  const open = async (path: string) => {
    await beforeSwitch?.();
    return recovery === undefined
      ? session.open(path)
      : openOrRecover(session, path, recovery.backups, recovery.dialogs);
  };
  registerIpcHandler(ipc, "createProject", isTrustedSender, async (request) => {
    const path = await dialogs.chooseNewProjectPath(request.name);
    if (path === undefined) {
      return { status: "canceled" };
    }
    await beforeSwitch?.();
    return session.create(path, {
      name: request.name,
      fill: (target) => fillNewSite(target, request, template),
    });
  });
  registerIpcHandler(ipc, "openProject", isTrustedSender, async () => {
    const path = await dialogs.chooseProjectToOpen();
    return path === undefined ? { status: "canceled" } : open(path);
  });
  registerIpcHandler(
    ipc,
    "listRecentSites",
    isTrustedSender,
    () => recent?.list(session.currentPath()) ?? [],
  );
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
  registerIpcHandler(ipc, "pinRecentSite", isTrustedSender, (id, pinned) => {
    recent?.setPinned(id, pinned);
    return null;
  });
  registerIpcHandler(ipc, "removeRecentSite", isTrustedSender, (id) => {
    recent?.remove(id);
    return null;
  });
  registerIpcHandler(ipc, "clearRecentSites", isTrustedSender, () => {
    recent?.clearUnpinned();
    return null;
  });
  registerIpcHandler(ipc, "getCurrentProject", isTrustedSender, () => session.current());
  registerIpcHandler(ipc, "readSite", isTrustedSender, () => session.readSite());
  // Only from a renderer loaded for the site open now (R6): a save on its way while another site
  // replaced it is refused, now and again once the store gate lets it in (R13b).
  registerIpcHandler(ipc, "commitSite", isTrustedSender, (sessionId, changes) => {
    const reason = session.staleReason(sessionId);
    return reason === undefined ? session.commit(changes, sessionId) : { status: "failed", reason };
  });
  registerIpcHandler(ipc, "getUiState", isTrustedSender, () => session.uiState());
  registerIpcHandler(ipc, "setUiState", isTrustedSender, (sessionId, state) => {
    const reason = session.staleReason(sessionId);
    return reason === undefined
      ? session.setUiState(state, sessionId)
      : { status: "failed", reason };
  });
}
