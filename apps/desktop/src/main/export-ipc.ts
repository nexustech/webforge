import { basename } from "node:path";
import type { SiteSnapshot } from "@webforge/model";
import type { IpcMain } from "electron";
import type { ExportOutcome } from "../shared/export-worker-protocol.js";
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
 * Registers the export IPC call. The renderer sends the site snapshot but never a path: the main
 * process asks the user for the folder, so a compromised renderer cannot write anywhere it likes.
 */
export function registerExportHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  dialogs: ExportDialogs,
  runExport: RunExport,
): void {
  registerIpcHandler(ipc, "exportSite", isTrustedSender, async (snapshot) => {
    const destination = await dialogs.chooseExportFolder();
    if (destination === undefined) {
      return { status: "canceled" };
    }
    return toExportResult(await runExport(snapshot, destination), destination);
  });
}
