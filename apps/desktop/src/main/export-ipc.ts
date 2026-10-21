import { basename } from "node:path";
import type { MediaItem, SiteSnapshot } from "@webforge/model";
import type { StoredBlob } from "@webforge/storage";
import type { IpcMain } from "electron";
import type { ExportOutcome } from "../shared/export-worker-protocol.js";
import type { ExportRequest } from "../shared/ipc/site.js";
import type { ExportResult } from "../shared/ipc-contract.js";
import { registerIpcHandler } from "./ipc.js";

/** Native dialogs, injected so the handler can be tested without Electron. */
export type ExportDialogs = {
  /** Asks which folder to export to; `undefined` if the user cancels. */
  chooseExportFolder(): Promise<string | undefined>;
};

/** Builds and writes the site; in the app, in a utility process. */
export type RunExport = (snapshot: SiteSnapshot, destination: string) => Promise<ExportOutcome>;

/** Turns the worker's outcome into what the renderer may see: counts and the folder's name. */
export function toExportResult(outcome: ExportOutcome, destination: string): ExportResult {
  if (outcome.type === "failed") {
    // Codes only: never paths or site content (standards §4).
    console.error(`Webforge could not export a site (${outcome.code}: ${outcome.detail})`);
    return { status: "failed", reason: outcome.code };
  }
  return {
    status: "exported",
    folderName: basename(destination),
    pages: outcome.pages,
    files: outcome.files,
    warnings: outcome.warnings,
  };
}

/**
 * The snapshot to build: the renderer's, with the bytes of its images read from the open site's
 * file. An image whose bytes aren't there is left out; the build fails only if a page uses it.
 */
function snapshotWithMedia(
  request: ExportRequest,
  readMedia: (hash: string) => StoredBlob | undefined,
): SiteSnapshot {
  const media = request.media.flatMap(({ hash, ...image }): MediaItem[] => {
    const blob = readMedia(hash);
    return blob === undefined ? [] : [{ ...image, data: blob.data }];
  });
  return { ...request.snapshot, media };
}

/**
 * Registers the export IPC call. The renderer sends the site snapshot but never a path: the main
 * process asks the user for the folder, so a compromised renderer cannot write anywhere it likes.
 * Image bytes come from the open site's file (`readMedia`), not from the renderer.
 */
export function registerExportHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  dialogs: ExportDialogs,
  runExport: RunExport,
  readMedia: (hash: string) => StoredBlob | undefined,
): void {
  registerIpcHandler(ipc, "exportSite", isTrustedSender, async (request) => {
    const destination = await dialogs.chooseExportFolder();
    if (destination === undefined) {
      return { status: "canceled" };
    }
    const snapshot = snapshotWithMedia(request, readMedia);
    return toExportResult(await runExport(snapshot, destination), destination);
  });
}
