import { basename } from "node:path";
import type { SiteSnapshot } from "@webforge/model";
import type { IpcMain } from "electron";
import type { ExportJob, ExportOutcome } from "../shared/export-worker-protocol.js";
import type { ExportChoices, ExportProgress, ExportRequest } from "../shared/ipc/site.js";
import type { ExportResult } from "../shared/ipc-contract.js";
import { registerIpcHandler } from "./ipc.js";
import { log } from "./log.js";

/** Native dialogs, injected so the handler can be tested without Electron. */
export type ExportDialogs = {
  /** Asks which folder to export to; `undefined` if the user cancels. */
  chooseExportFolder(): Promise<string | undefined>;
  /** Asks where to save the site's ZIP, suggesting one named after it; `undefined` if cancelled. */
  chooseExportZip(siteName: string): Promise<string | undefined>;
};

/** How one export runs: a signal that cancels it, and what to tell of its progress (3.1). */
type RunExportOptions = {
  readonly signal: AbortSignal;
  readonly onProgress: (progress: ExportProgress) => void;
};

/** Where and how an export is written (3.3). */
export type ExportTarget = Pick<ExportJob, "destination" | "format" | "output">;

/** Builds and writes the site; in the app, in a utility process. */
export type RunExport = (
  snapshot: SiteSnapshot,
  target: ExportTarget,
  options: RunExportOptions,
) => Promise<ExportOutcome>;

/** What the export handlers reach outside this module; injected for tests. */
export type ExportDeps = {
  readonly dialogs: ExportDialogs;
  readonly runExport: RunExport;
  /** Tells the window how far the export has come (3.1). */
  readonly sendProgress: (progress: ExportProgress) => void;
  /** The open site's export choices (3.3): read for the dialog, kept when an export goes ahead. */
  readonly choices: {
    read(): Promise<ExportChoices>;
    write(choices: ExportChoices): Promise<void>;
  };
  /** Opens an export from disk: a folder's home page in the browser, a ZIP in the file manager. */
  readonly open: (target: Pick<ExportTarget, "destination" | "format">) => Promise<void>;
};

/**
 * Turns the worker's outcome into what the renderer may see: counts, the warnings for the report,
 * and the folder's or file's name, never its path.
 */
export function toExportResult(
  outcome: ExportOutcome,
  target: Pick<ExportTarget, "destination" | "format">,
): ExportResult {
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
    format: target.format,
    name: basename(target.destination),
    pages: outcome.pages,
    files: outcome.files,
    bytes: outcome.bytes,
    // The renderer has the site: its pages' paths and links are no news to it. Never logged.
    warnings: outcome.warnings,
    warningCount: outcome.warningCount,
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
 * Registers the export IPC calls. The renderer sends the site snapshot and the person's choices but
 * never a path: the main process asks for the folder or ZIP file, so a compromised renderer cannot
 * write anywhere it likes, and opens only what it exported itself. Image bytes come from the open
 * site's file, as the export worker asks for them, never from the renderer. Its progress goes to
 * `sendProgress`, and the renderer can cancel it (3.1).
 */
export function registerExportHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  deps: ExportDeps,
): void {
  // The exports under way (or waiting for the one before): a cancel stops them all.
  const underWay = new Set<AbortController>();
  // The last export written, for Preview from disk.
  let last: Pick<ExportTarget, "destination" | "format"> | undefined;
  registerIpcHandler(ipc, "exportSite", isTrustedSender, async (request) => {
    const { choices } = request;
    const destination =
      choices.format === "zip"
        ? await deps.dialogs.chooseExportZip(request.snapshot.name)
        : await deps.dialogs.chooseExportFolder();
    if (destination === undefined) {
      return { status: "canceled" };
    }
    // Remembered once the person has gone ahead; a site that can't save them still exports.
    await deps.choices.write(choices).catch(() => undefined);
    const target: ExportTarget = {
      destination,
      format: choices.format,
      output: { minify: choices.minify, developerFiles: choices.developerFiles },
    };
    const controller = new AbortController();
    underWay.add(controller);
    try {
      const outcome = await deps.runExport(snapshotOf(request), target, {
        signal: controller.signal,
        onProgress: deps.sendProgress,
      });
      if (outcome.type === "exported") last = target;
      return toExportResult(outcome, target);
    } finally {
      underWay.delete(controller);
    }
  });
  registerIpcHandler(ipc, "exportChoices", isTrustedSender, () => deps.choices.read());
  registerIpcHandler(ipc, "openExport", isTrustedSender, async () => {
    if (last === undefined) return "none";
    await deps.open(last);
    return "opened";
  });
  registerIpcHandler(ipc, "cancelExport", isTrustedSender, () => {
    for (const controller of underWay) controller.abort();
    return null;
  });
}
