import { basename } from "node:path";
import type { IpcMain } from "electron";
import { MAX_MEDIA_FILES } from "../shared/ipc/media.js";
import type { MediaImportResult } from "../shared/ipc-contract.js";
import { registerIpcHandler } from "./ipc.js";
import { createMediaImport, importMediaFiles } from "./media-import.js";
import type { ProjectSession } from "./project-session.js";

/** The native dialog of the Media import, injected so the handlers can be tested. */
export type MediaDialogs = {
  /** Asks for images or PDFs to import; `undefined` if the user cancels. */
  chooseMediaFiles(): Promise<readonly string[] | undefined>;
};

/**
 * Registers the Media IPC calls (1.16). Dropped files arrive as bytes, never as paths; chosen files
 * are read from the paths the native dialog returned, so the renderer can't name a file.
 */
export function registerMediaHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  session: Pick<ProjectSession, "staleReason" | "forSession">,
  dialogs: MediaDialogs,
): void {
  // Into the site the renderer was loaded for only (R6), checked again as each file is stored.
  registerIpcHandler(ipc, "importMedia", isTrustedSender, (sessionId, files) => {
    const reason = session.staleReason(sessionId);
    return reason === undefined
      ? importMediaFiles(session.forSession(sessionId), files)
      : { status: "failed", reason };
  });
  registerIpcHandler(ipc, "chooseMedia", isTrustedSender, async (sessionId) => {
    // No dialog without the site to import into.
    const reason = session.staleReason(sessionId);
    if (reason !== undefined) {
      return { status: "failed", reason };
    }
    const paths = await dialogs.chooseMediaFiles();
    if (paths === undefined || paths.length === 0) {
      return { status: "canceled" };
    }
    // The dialog may have stayed open while a hand-off opened another site: stored only if not.
    return importFilesAt(session.forSession(sessionId), paths);
  });
}

/**
 * Imports the files at `paths` (chosen in the dialog, or copied in the file manager and pasted), at
 * most {@link MAX_MEDIA_FILES}, one at a time: the storage writer reads each, so only one is ever
 * in memory, and none on the main thread (R13b). A folder or a missing file is listed as not taken;
 * the others are still imported.
 */
export function importFilesAt(
  session: Pick<ProjectSession, "importFile">,
  paths: readonly string[],
): Promise<MediaImportResult> {
  return importMediaFiles(
    session,
    paths
      .slice(0, MAX_MEDIA_FILES)
      .map((path) => ({ fileName: basename(path).slice(0, 255) || "file", path })),
  );
}
