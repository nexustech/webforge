import { basename } from "node:path";
import type { SiteSnapshot } from "@webforge/model";
import type { IpcMain } from "electron";
import type { ExportOutcome } from "../shared/export-worker-protocol.js";
import type { ExportProgress, ExportRequest } from "../shared/ipc/site.js";
import type { ExportResult } from "../shared/ipc-contract.js";
import { registerIpcHandler } from "./ipc.js";
import { log } from "./log.js";

/** Native dialogs, injected so the handler can be tested without Electron. */
export type ExportDialogs = {
  /** Asks which folder to export to; `undefined` if the user cancels. */
  chooseExportFolder(): Promise<string | undefined>;
};

/** How one export runs: a signal that cancels it, and what to tell of its progress (3.1). */
type RunExportOptions = {
  readonly signal: AbortSignal;
  readonly onProgress: (progress: ExportProgress) => void;
};

/** Builds and writes the site; in the app, in a utility process. */
export type RunExport = (
  snapshot: SiteSnapshot,
  destination: string,
  options: RunExportOptions,
) => Promise<ExportOutcome>;

/** Turns the worker's outcome into what the renderer may see: counts and the folder's name. */
export function toExportResult(outcome: ExportOutcome, destination: string): ExportResult {
  // Cancelled: as when the folder dialog was, nothing changed on disk (R15).
  if (outcome.type === "cancelled") return { status: "canceled" };
  if (outcome.type === "failed") {
    // Codes only: never paths or site content (standards §4).
    log.error("Webforge could not export a site", { code: outcome.code, detail: outcome.detail });
    // The page's title goes to the renderer, which has the site anyway; never to the log.
    return {
      status: "failed",
      reason: outcome.code,
      ...(outcome.page === undefined ? {} : { page: outcome.page }),
    };
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
 * The snapshot to build: the renderer's, its images and documents named by hash. The export
 * worker asks for each one's bytes from the open site's file as it reaches it (R15), so this
 * process never holds them all; one the site no longer stores is left out, with a warning.
 */
function snapshotOf(request: ExportRequest): SiteSnapshot {
  return {
    ...request.snapshot,
    media: request.media.map((image) => ({ ...image })),
    documents: (request.documents ?? []).map((file) => ({ ...file })),
  };
}

/**
 * Registers the export IPC calls. The renderer sends the site snapshot but never a path: the main
 * process asks the user for the folder, so a compromised renderer cannot write anywhere it likes.
 * Image bytes come from the open site's file, as the export worker asks for them, never from the
 * renderer. Its progress goes to `sendProgress`, and the renderer can cancel it (3.1).
 */
export function registerExportHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  dialogs: ExportDialogs,
  runExport: RunExport,
  sendProgress: (progress: ExportProgress) => void,
): void {
  // The exports under way (or waiting for the one before): a cancel stops them all.
  const underWay = new Set<AbortController>();
  registerIpcHandler(ipc, "exportSite", isTrustedSender, async (request) => {
    const destination = await dialogs.chooseExportFolder();
    if (destination === undefined) {
      return { status: "canceled" };
    }
    const controller = new AbortController();
    underWay.add(controller);
    try {
      const outcome = await runExport(snapshotOf(request), destination, {
        signal: controller.signal,
        onProgress: sendProgress,
      });
      return toExportResult(outcome, destination);
    } finally {
      underWay.delete(controller);
    }
  });
  registerIpcHandler(ipc, "cancelExport", isTrustedSender, () => {
    for (const controller of underWay) controller.abort();
    return null;
  });
}
