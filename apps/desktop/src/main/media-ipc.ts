import { type FileHandle, open } from "node:fs/promises";
import { basename } from "node:path";
import type { IpcMain } from "electron";
import { MAX_MEDIA_BYTES, MAX_MEDIA_FILES } from "../shared/ipc/media.js";
import type { MediaImportResult } from "../shared/ipc-contract.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import { createMediaImport, type ImportFile, importMediaFiles } from "./media-import.js";
import type { ProjectSession } from "./project-session.js";

/** The native dialog of the Media import, injected so the handlers can be tested. */
export type MediaDialogs = {
  /** Asks for images or PDFs to import; `undefined` if the user cancels. */
  chooseMediaFiles(): Promise<readonly string[] | undefined>;
};

/** How much of a file is read at a time. */
const CHUNK_BYTES = 1024 * 1024;

/**
 * The bytes of the open file `handle`, read to its end, or `undefined` once there are more than
 * `maxBytes`: a file that grows after its size was checked is never read whole.
 */
export async function readAtMost(
  handle: Pick<FileHandle, "read">,
  maxBytes: number,
): Promise<Uint8Array | undefined> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const chunk = new Uint8Array(Math.min(CHUNK_BYTES, maxBytes + 1 - total));
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
    if (bytesRead === 0) break;
    total += bytesRead;
    if (total > maxBytes) return undefined;
    chunks.push(chunk.subarray(0, bytesRead));
  }
  return Buffer.concat(chunks, total);
}

/**
 * Reads a chosen file through one open handle: its size is checked on that handle, and no more
 * than the size limit is read (`data` is `undefined` when it is over). `undefined` for a folder, or
 * a file that is gone (a copy pasted after the file moved).
 */
async function readChosenFile(path: string): Promise<ImportFile | undefined> {
  const fileName = basename(path).slice(0, 255);
  const handle = await open(path, "r").catch(() => undefined);
  if (handle === undefined) {
    return undefined;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      return undefined;
    }
    return {
      fileName,
      data: info.size > MAX_MEDIA_BYTES ? undefined : await readAtMost(handle, MAX_MEDIA_BYTES),
    };
  } finally {
    await handle.close();
  }
}

/**
 * Registers the Media IPC calls (1.16). Dropped files arrive as bytes, never as paths; chosen files
 * are read here from the paths the native dialog returned, so the renderer can't name a file.
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
 * most {@link MAX_MEDIA_FILES}. One file at a time, so only one is ever in memory. A folder or a
 * missing file is listed as not taken; the others are still imported.
 */
export async function importFilesAt(
  session: Pick<ProjectSession, "storeAsset">,
  paths: readonly string[],
): Promise<MediaImportResult> {
  const running = createMediaImport(session);
  try {
    for (const path of paths.slice(0, MAX_MEDIA_FILES)) {
      const file = await readChosenFile(path);
      if (file === undefined) {
        running.skip(basename(path).slice(0, 255));
        continue;
      }
      const failed = running.add(file);
      if (failed !== undefined) {
        return failed;
      }
    }
    return running.result();
  } catch (error) {
    logFailure("Webforge could not read a chosen file", error);
    return { status: "failed", reason: "unknown" };
  }
}
