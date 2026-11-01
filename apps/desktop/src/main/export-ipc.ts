import { basename } from "node:path";
import type { SiteSnapshot } from "@webforge/model";
import type { IpcMain } from "electron";
import type { ExportJob, ExportOutcome } from "../shared/export-worker-protocol.js";
import type { ExportProgress, SiteContent } from "../shared/ipc/site.js";
import type { ExportResult } from "../shared/ipc-contract.js";
import { registerIpcHandler } from "./ipc.js";
import { log } from "./log.js";
import type { SessionSite } from "./project-session.js";

/** Native dialogs, injected so the handler can be tested without Electron. */
export type ExportDialogs = {
  /** Asks which folder to export to; `undefined` if the user cancels. */
  chooseExportFolder(): Promise<string | undefined>;
  /** Asks where to save the site's ZIP, suggesting one named after it; `undefined` if cancelled. */
  chooseExportZip(siteName: string): Promise<string | undefined>;
};

/**
 * How one export runs: where its images' and documents' bytes come from (the site it is of, #663),
 * a signal that cancels it, and what to tell of its progress (3.1).
 */
type RunExportOptions = {
  readonly readMedia: SessionSite["readMedia"];
  readonly signal: AbortSignal;
  readonly onProgress: (progress: ExportProgress) => void;
};

/** The open site as an export of one opening of it reaches it (R6, #663). */
export type ExportSite = Pick<
  SessionSite,
  "staleReason" | "readMedia" | "exportChoices" | "setExportChoices"
>;

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
  /** Tells the window how far export `operationId` has come (3.1). */
  readonly sendProgress: (operationId: string, progress: ExportProgress) => void;
  /**
   * The open site for a call from a renderer loaded for opening `sessionId` (R6): its Media and its
   * export choices (3.3), read for the dialog and kept when an export goes ahead.
   */
  readonly site: (sessionId: string) => ExportSite;
  /**
   * Opens an export from disk: a folder's home page in the browser, a ZIP in the file manager;
   * `missing` when it isn't there any more.
   */
  readonly open: (
    target: Pick<ExportTarget, "destination" | "format">,
  ) => Promise<"opened" | "missing">;
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
      ...(outcome.image === undefined ? {} : { image: outcome.image }),
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
 * process never holds them all; one the site no longer stores is left out, with a warning. The
 * preview builds from the same (3.2).
 */
export function snapshotOf(request: SiteContent): SiteSnapshot {
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
 *
 * Each call names the opening of the site it is for (R6, #663). An export takes that site once, as
 * it starts: one whose site was replaced by a hand-off while the dialog was open, or while it ran,
 * is cancelled and writes nothing, and never keeps its choices with the next site, nor builds with
 * its Media.
 */
export function registerExportHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  deps: ExportDeps,
): void {
  // The exports under way (or waiting for the one before), by operation: a cancel stops its own.
  const underWay = new Map<string, AbortController>();
  // The last export written, and the opening of the site it was of, for Preview from disk.
  let last: { readonly target: ExportTarget; readonly sessionId: string } | undefined;
  registerIpcHandler(
    ipc,
    "exportSite",
    isTrustedSender,
    async (sessionId, request, operationId) => {
      // The site the export is of, taken once: it reads that site's Media only (#663).
      const site = deps.site(sessionId);
      // One name, one export.
      if (site.staleReason() !== undefined || underWay.has(operationId)) {
        return { status: "canceled" };
      }
      // Under way from the start, the id with it: a Cancel while the dialog is open, or while the
      // choices wait at the store gate, stops it before anything is written.
      const controller = new AbortController();
      underWay.set(operationId, controller);
      try {
        const { choices } = request;
        const destination =
          choices.format === "zip"
            ? await deps.dialogs.chooseExportZip(request.snapshot.name)
            : await deps.dialogs.chooseExportFolder();
        // Cancelled, or a hand-off replaced the site while the dialog was open: nothing is
        // written, and its choices aren't kept with the next site.
        if (
          destination === undefined ||
          controller.signal.aborted ||
          site.staleReason() !== undefined
        ) {
          return { status: "canceled" };
        }
        // Remembered once the person has gone ahead; a site that can't save them still exports.
        await site.setExportChoices(choices).catch(() => undefined);
        if (controller.signal.aborted) return { status: "canceled" };
        const target: ExportTarget = {
          destination,
          format: choices.format,
          output: request.output,
        };
        const outcome = await deps.runExport(snapshotOf(request), target, {
          // A site replaced while the export runs cancels it, as Cancel would: nothing changes on
          // disk, rather than a site written without its images. Checked again once a read comes
          // back empty: a hand-off can take the gate between the check and the read.
          readMedia: async (hash) => {
            const blob = site.staleReason() === undefined ? await site.readMedia(hash) : undefined;
            if (blob === undefined && site.staleReason() !== undefined) controller.abort();
            return blob;
          },
          signal: controller.signal,
          onProgress: (progress) => deps.sendProgress(operationId, progress),
        });
        if (outcome.type === "exported") last = { target, sessionId };
        return toExportResult(outcome, target);
      } finally {
        underWay.delete(operationId);
      }
    },
  );
  registerIpcHandler(ipc, "exportChoices", isTrustedSender, (sessionId) =>
    deps.site(sessionId).exportChoices(),
  );
  registerIpcHandler(ipc, "setExportChoices", isTrustedSender, async (sessionId, choices) => {
    await deps.site(sessionId).setExportChoices(choices);
    return null;
  });
  // Only this opening's export: after File → Open of another site, it has none yet.
  registerIpcHandler(ipc, "openExport", isTrustedSender, async (sessionId) =>
    last === undefined ||
    last.sessionId !== sessionId ||
    deps.site(sessionId).staleReason() !== undefined
      ? "none"
      : deps.open(last.target),
  );
  registerIpcHandler(ipc, "cancelExport", isTrustedSender, (operationId) => {
    underWay.get(operationId)?.abort();
    return null;
  });
}
