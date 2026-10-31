import { readFile, stat } from "node:fs/promises";
import {
  fillFromSiteZip,
  readSiteZip,
  SITE_ZIP_MAX_BYTES,
  type SiteZip,
  SiteZipError,
} from "@webforge/storage";
import type { IpcMain } from "electron";
import type { ProjectFailureReason } from "../shared/ipc-contract.js";
import type { Backups } from "./backups.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import { fillNewSite, type TemplateReader } from "./new-site.js";
import type { ProjectSession } from "./project-session.js";
import type { RecentSites } from "./recent-sites.js";
import { openOrRecover, type RecoveryDialogs } from "./recovery.js";

/** Native file dialogs, injected so the handlers can be tested without Electron. */
export type ProjectDialogs = {
  /**
   * Asks where to save a new site, offering a file named after it (`safeFileName`); `undefined` if
   * the user cancels.
   */
  chooseNewProjectPath(siteName: string): Promise<string | undefined>;
  /** Asks which site to open; `undefined` if the user cancels. */
  chooseProjectToOpen(): Promise<string | undefined>;
  /**
   * Asks where to save a copy of the site called `siteName` as a ZIP (4.7), offering a file named
   * after it; `undefined` if the user cancels.
   */
  chooseSiteZipToSave(siteName: string): Promise<string | undefined>;
  /** Asks which site's ZIP to open (4.7); `undefined` if the user cancels. */
  chooseSiteZipToOpen(): Promise<string | undefined>;
};

/** Why a site's ZIP can't be opened, as the open dialog's failure says it. */
const SITE_ZIP_FAILURES = {
  "not-a-site-zip": "not-a-project",
  damaged: "corrupt",
  "newer-format": "newer-format",
  "too-large": "too-large",
} as const satisfies Record<SiteZipError["code"], ProjectFailureReason>;

/** The site in the ZIP at `path`, read and checked, or why it can't be opened. */
async function readSiteZipFile(
  path: string,
): Promise<SiteZip | { readonly reason: ProjectFailureReason }> {
  try {
    const { size } = await stat(path);
    if (size > SITE_ZIP_MAX_BYTES) return { reason: "too-large" };
    return readSiteZip(await readFile(path));
  } catch (error) {
    if (error instanceof SiteZipError) return { reason: SITE_ZIP_FAILURES[error.code] };
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { reason: "not-found" };
    logFailure("Webforge could not read a site's ZIP", error);
    return { reason: "unknown" };
  }
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
    /** Asks the renderer to save its last changes, before a copy of the site is saved (4.7). */
    readonly flush?: () => Promise<void>;
  } = {},
): void {
  const {
    recovery,
    recent,
    beforeSwitch,
    flush,
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
  // Save a Copy as ZIP… (4.7): the site with its last changes, where the person chooses.
  // A copy of the site the renderer was loaded for: never of one a hand-off opened meanwhile (#663).
  registerIpcHandler(ipc, "saveSiteZip", isTrustedSender, async (sessionId) => {
    const site = session.forSession(sessionId);
    const stale = site.staleReason();
    if (stale === "stale-session") return { status: "canceled" };
    const current = site.current();
    if (stale !== undefined || current === null) return { status: "failed", reason: "no-site" };
    const path = await dialogs.chooseSiteZipToSave(current.name);
    if (path === undefined) return { status: "canceled" };
    await flush?.();
    return site.saveSiteZip(path);
  });
  // Open Site from ZIP… (4.7): the ZIP checked before anything else is asked, then saved as a new
  // site where the person chooses, named as it was.
  registerIpcHandler(ipc, "openSiteZip", isTrustedSender, async () => {
    const zipPath = await dialogs.chooseSiteZipToOpen();
    if (zipPath === undefined) return { status: "canceled" };
    const site = await readSiteZipFile(zipPath);
    if ("reason" in site) return { status: "failed", reason: site.reason };
    const path = await dialogs.chooseNewProjectPath(site.name);
    if (path === undefined) return { status: "canceled" };
    await beforeSwitch?.();
    return session.create(path, {
      name: site.name,
      fill: async ({ store }) => fillFromSiteZip(store, site),
    });
  });
  registerIpcHandler(
    ipc,
    "listRecentSites",
    isTrustedSender,
    async () => (await recent?.list(session.currentPath())) ?? [],
  );
  registerIpcHandler(ipc, "openRecentSite", isTrustedSender, async (id) => {
    const path = await recent?.pathOf(id);
    if (path === undefined) {
      return { status: "failed", reason: "not-found" };
    }
    const result = await open(path);
    if (result.status === "failed" && result.reason === "not-found") {
      await recent?.remove(id);
    }
    return result;
  });
  registerIpcHandler(ipc, "pinRecentSite", isTrustedSender, async (id, pinned) => {
    await recent?.setPinned(id, pinned);
    return null;
  });
  registerIpcHandler(ipc, "removeRecentSite", isTrustedSender, async (id) => {
    await recent?.remove(id);
    return null;
  });
  registerIpcHandler(ipc, "clearRecentSites", isTrustedSender, async () => {
    await recent?.clearUnpinned();
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
