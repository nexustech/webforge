import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { IpcMain } from "electron";
import { MAX_MEDIA_BYTES, MAX_MEDIA_FILES } from "../shared/ipc/media.js";
import type { MediaImportResult } from "../shared/ipc-contract.js";
import { registerIpcHandler } from "./ipc.js";
import { createMediaImport, type ImportFile, importMediaFiles } from "./media-import.js";
import type { ProjectSession } from "./project-session.js";

/** The native dialog of the Media import, injected so the handlers can be tested. */
export type MediaDialogs = {
  /** Asks for images or PDFs to import; `undefined` if the user cancels. */
  chooseMediaFiles(): Promise<readonly string[] | undefined>;
};

/** Reads a chosen file, unless it is too large to import (then its bytes aren't read at all). */
async function readChosenFile(path: string): Promise<ImportFile> {
  const fileName = basename(path).slice(0, 255);
  const { size } = await stat(path);
  return { fileName, data: size > MAX_MEDIA_BYTES ? undefined : await readFile(path) };
}

/**
 * Registers the Media IPC calls (1.16). Dropped files arrive as bytes, never as paths; chosen files
 * are read here from the paths the native dialog returned, so the renderer can't name a file.
 */
export function registerMediaHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  session: Pick<ProjectSession, "storeAsset" | "current">,
  dialogs: MediaDialogs,
): void {
  registerIpcHandler(ipc, "importMedia", isTrustedSender, (files) =>
    importMediaFiles(session, files),
  );
  registerIpcHandler(ipc, "chooseMedia", isTrustedSender, async () => {
    // No dialog without a site to import into.
    if (session.current() === null) {
      return { status: "failed", reason: "no-site" };
    }
    const paths = await dialogs.chooseMediaFiles();
    if (paths === undefined || paths.length === 0) {
      return { status: "canceled" };
    }
    return importFilesAt(session, paths);
  });
}

/**
 * Imports the files at `paths` (chosen in the dialog, or copied in the file manager and pasted), at
 * most {@link MAX_MEDIA_FILES}. One file at a time, so only one is ever in memory.
 */
export async function importFilesAt(
  session: Pick<ProjectSession, "storeAsset">,
  paths: readonly string[],
): Promise<MediaImportResult> {
  const running = createMediaImport(session);
  try {
    for (const path of paths.slice(0, MAX_MEDIA_FILES)) {
      const failed = running.add(await readChosenFile(path));
      if (failed !== undefined) {
        return failed;
      }
    }
    return running.result();
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "no code";
    console.error(`Webforge could not read a chosen file (${code})`);
    return { status: "failed", reason: "unknown" };
  }
}
