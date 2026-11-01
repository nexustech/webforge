import { fillFromSitePackage } from "@webforge/storage";
import type { IpcMain } from "electron";
import type { SaveVersionResult } from "../shared/ipc/versions.js";
import { registerIpcHandler } from "./ipc.js";
import type { ProjectDialogs } from "./project-ipc.js";
import type { ProjectSession } from "./project-session.js";

/** What the `versions` calls are made with: injectable for tests. */
export type VersionsOptions = {
  readonly session: Pick<ProjectSession, "forSession" | "create">;
  readonly dialogs: Pick<ProjectDialogs, "chooseNewProjectPath">;
  /** A JPEG of the canvas as it is now, for a version's picture; none when it can't be taken. */
  readonly captureCanvas: () => Promise<Uint8Array | undefined>;
  /** How many of Webforge's own versions the person keeps (P3). */
  readonly versionsKept: () => Promise<number>;
  /** Runs before another site replaces the open one, as for Open Site (the Recent list's picture). */
  readonly beforeSwitch?: () => Promise<void>;
  /** Asks the renderer to save its last changes, before main saves a version itself. */
  readonly flush?: () => Promise<void>;
};

/** What main's own callers save versions with. */
export type Versions = {
  /**
   * Saves an automatic version before a change that isn't the person's own edit, with its last
   * changes saved first: the security review's S20 version before an AI app's first change in a
   * connection ("Before ‹app›'s changes", 4.9). The same path as the renderer's before-site-wide
   * version, so it keeps Versions kept too.
   */
  saveVersionBefore(sessionId: string, name: string): Promise<"saved" | "failed">;
};

/**
 * Registers the `versions` IPC calls (F-SITE-4, 4.6): each on the opening of the site the renderer
 * was loaded for (R6), never on one a hand-off opened since.
 */
export function registerVersionsHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  options: VersionsOptions,
): Versions {
  const { session, dialogs, captureCanvas, versionsKept, beforeSwitch, flush } = options;
  /** Saves the site's file as it is as a version of the opening `sessionId`, with its picture. */
  const save = async (
    sessionId: string,
    name: string,
    reason: "manual" | "before-restore" | "before-site-wide",
  ): Promise<SaveVersionResult> => {
    const site = session.forSession(sessionId);
    const stale = site.staleReason();
    if (stale !== undefined) return { status: "failed", reason: stale };
    const [thumbnail, kept] = await Promise.all([captureCanvas(), versionsKept()]);
    return site.saveVersion({ name, reason, thumbnail, kept });
  };
  registerIpcHandler(ipc, "listVersions", isTrustedSender, (sessionId) =>
    session.forSession(sessionId).listVersions(),
  );
  // The renderer saved its last changes before it asked (ADR 0018 §3).
  registerIpcHandler(ipc, "saveVersion", isTrustedSender, (sessionId, { name, reason }) =>
    save(sessionId, name, reason),
  );
  registerIpcHandler(ipc, "deleteVersion", isTrustedSender, (sessionId, id) =>
    session.forSession(sessionId).deleteVersion(id),
  );
  registerIpcHandler(ipc, "readVersionSite", isTrustedSender, (sessionId, id) =>
    session.forSession(sessionId).readVersionSite(id),
  );
  // Open version as new site (P5): the version read first, then a new site where the person
  // chooses, with its pages, Media and choices but no destinations (ADR 0018 §2).
  registerIpcHandler(ipc, "openVersionAsNewSite", isTrustedSender, async (sessionId, id, name) => {
    const site = session.forSession(sessionId);
    const stale = site.staleReason();
    if (stale === "stale-session") return { status: "canceled" };
    const read = await site.versionPackage(id);
    if (!("pack" in read)) {
      return read.status === "failed" && read.reason === "stale-session"
        ? { status: "canceled" }
        : { status: "failed", reason: read.status === "not-found" ? "not-found" : "corrupt" };
    }
    const path = await dialogs.chooseNewProjectPath(name);
    if (path === undefined) return { status: "canceled" };
    await beforeSwitch?.();
    return session.create(path, {
      name,
      fill: async ({ store }) => fillFromSitePackage(store, read.pack),
    });
  });
  return {
    saveVersionBefore: async (sessionId, name) => {
      await flush?.();
      const saved = await save(sessionId, name, "before-site-wide");
      return saved.status === "saved" ? "saved" : "failed";
    },
  };
}
