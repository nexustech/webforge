import { fillFromSitePackage } from "@webforge/storage";
import type { IpcMain } from "electron";
import type { SaveVersionResult } from "../shared/ipc/versions.js";
import { registerIpcHandler } from "./ipc.js";
import type { ProjectDialogs } from "./project-ipc.js";
import type { ProjectSession } from "./project-session.js";

/** What the `versions` calls are made with: injectable for tests. */
export type VersionsOptions = {
  readonly session: Pick<ProjectSession, "forSession" | "create" | "cleanUp">;
  readonly dialogs: Pick<ProjectDialogs, "chooseNewProjectPath">;
  /** A JPEG of the canvas as it is now, for a version's picture; none when it can't be taken. */
  readonly captureCanvas: () => Promise<Uint8Array | undefined>;
  /** How many of Webforge's own versions the person keeps (P3). */
  readonly versionsKept: () => Promise<number>;
  /** Runs before another site replaces the open one, as for Open Site (the Recent list's picture). */
  readonly beforeSwitch?: () => Promise<void>;
  /** Asks the renderer to save its last changes, before a version is saved. */
  readonly flush?: () => Promise<void>;
  /** The time, in milliseconds: `Date.now` unless a test sets it. */
  readonly now?: () => number;
};

/**
 * The least time between two versions before a change to every page in one opening (4.6): the
 * first of a burst of changes (deleting ten pages, trying five themes) holds the site from before
 * them, and a burst can't push the daily versions out of Versions kept. AI apps' versions (4.9,
 * S20) are among them.
 */
export const BEFORE_SITE_WIDE_GAP_MS = 5 * 60_000;

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
  const now = options.now ?? Date.now;
  /** When each opening's last version before a change to every page was saved. */
  const lastBeforeSiteWide = new Map<string, number>();
  /** Saves the site's file as it is as a version of the opening `sessionId`, with its picture. */
  const save = async (
    sessionId: string,
    name: string,
    reason: "manual" | "before-restore" | "before-site-wide",
  ): Promise<SaveVersionResult> => {
    const site = session.forSession(sessionId);
    const stale = site.staleReason();
    if (stale !== undefined) return { status: "failed", reason: stale };
    const throttled = reason === "before-site-wide";
    if (throttled) {
      const last = lastBeforeSiteWide.get(sessionId);
      if (last !== undefined && now() - last < BEFORE_SITE_WIDE_GAP_MS)
        return { status: "skipped" };
      // Taken now, so a second request while this one saves is skipped too.
      lastBeforeSiteWide.set(sessionId, now());
    }
    // The site as the person sees it: autosave's last changes saved first (ADR 0018 §3).
    await flush?.();
    const [thumbnail, kept] = await Promise.all([captureCanvas(), versionsKept()]);
    const saved = await site.saveVersion({ name, reason, thumbnail, kept });
    // One that wasn't saved doesn't count: the next change tries again.
    if (throttled && saved.status !== "saved") lastBeforeSiteWide.delete(sessionId);
    return saved;
  };
  registerIpcHandler(ipc, "listVersions", isTrustedSender, (sessionId) =>
    session.forSession(sessionId).listVersions(),
  );
  registerIpcHandler(ipc, "saveVersion", isTrustedSender, (sessionId, { name, reason }) =>
    save(sessionId, name, reason),
  );
  registerIpcHandler(ipc, "deleteVersion", isTrustedSender, (sessionId, id) =>
    session.forSession(sessionId).deleteVersion(id),
  );
  // Clean up (P3): the last changes saved first, then collection and a VACUUM while saves wait.
  registerIpcHandler(ipc, "cleanUpVersions", isTrustedSender, async (sessionId) => {
    const stale = session.forSession(sessionId).staleReason();
    if (stale !== undefined) return { status: "failed", reason: stale };
    await flush?.();
    return session.cleanUp(sessionId);
  });
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
      const saved = await save(sessionId, name, "before-site-wide");
      return saved.status === "failed" ? "failed" : "saved";
    },
  };
}
