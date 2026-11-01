import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SiteSnapshot } from "@webforge/model";
import type { Shell } from "electron";
import type { AppFeature } from "./app-feature.js";
import { type ExportDeps, type RunExport, registerExportHandlers } from "./export-ipc.js";
import { createExportRunner, type ExportRunner } from "./export-worker-client.js";
import type { SiteFonts } from "./site-fonts.js";
import type { WorkerProcess } from "./worker-process.js";

/** What the export feature reaches outside itself; fakes in tests. */
export type ExportFeatureDeps = Pick<ExportDeps, "dialogs" | "sendProgress" | "site"> & {
  /** Starts the export worker, a utility process whose crash becomes a local report (R3). */
  readonly startWorker: () => WorkerProcess;
  /** The font files and downloaded families of a theme, read and checked here (2.2). */
  readonly fontsOf: SiteFonts["fontsOf"];
  /** The snapshot an export builds: the one sent, with only the code its owner trusts (#649). */
  readonly snapshotFor: (sent: SiteSnapshot) => Promise<SiteSnapshot>;
  /** Electron's `shell`, whose methods are looked up as they're called (the E2E tests replace them). */
  readonly shell: Pick<Shell, "showItemInFolder" | "openPath">;
  /** Whether a path exists; `existsSync` unless a test says. */
  readonly exists?: (path: string) => boolean;
};

/**
 * Opens an export from disk (3.1): a folder's home page in the browser, a ZIP in the file manager,
 * or `missing` when it was moved or deleted.
 */
export function openExport(
  shell: ExportFeatureDeps["shell"],
  exists: (path: string) => boolean = existsSync,
): ExportDeps["open"] {
  return async ({ destination, format }) => {
    if (format === "zip") {
      if (!exists(destination)) return "missing";
      shell.showItemInFolder(destination);
      return "opened";
    }
    // An error message, rather than a throw, when the folder was moved or deleted.
    const failed = await shell.openPath(join(destination, "index.html"));
    return failed === "" ? "opened" : "missing";
  };
}

/**
 * Export (3.1, A12). Each export runs in a utility process, so building never blocks the window
 * (07): one worker while the site is open, keeping the images it encoded in memory (R15), which
 * goes when the site closes. The worker resolves nothing itself: it gets the site's font files,
 * read and checked here, and asks for each image and document as it reaches it, read from the site
 * the export's handler took as it started (#663). Its runner publishes too (4.5, ADR 0018 §1), in
 * the same worker: the feature gives it for Publish.
 */
export function createExportFeature(
  deps: ExportFeatureDeps,
): AppFeature & { readonly runner: ExportRunner } {
  const exports = createExportRunner(deps.startWorker);
  const runExport: RunExport = async (sent, target, { readMedia, signal, onProgress }) => {
    const snapshot = await deps.snapshotFor(sent);
    return exports.run(
      { type: "export", snapshot, ...target, ...(await deps.fontsOf(snapshot.theme)) },
      { readMedia, signal, onProgress },
    );
  };
  return {
    runner: exports,
    register: (ipc, isTrustedSender) => {
      registerExportHandlers(ipc, isTrustedSender, {
        dialogs: deps.dialogs,
        runExport,
        sendProgress: deps.sendProgress,
        site: deps.site,
        open: openExport(deps.shell, deps.exists),
      });
    },
    // The worker goes, and the images it kept in memory with it (R15).
    site: { closed: () => exports.close() },
  };
}
