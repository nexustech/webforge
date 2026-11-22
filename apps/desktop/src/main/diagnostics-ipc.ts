import type { IpcMain } from "electron";
import { registerIpcHandler } from "./ipc.js";
import type { UsageSummary } from "./usage-summary.js";

/** What Help › Diagnostics… works with in main (5.41, BD-2); fakes in tests. */
export type DiagnosticsParts = {
  /** The usage summary, once it has loaded; none while it hasn't, or couldn't be read. */
  readonly summary: () => Promise<UsageSummary | undefined>;
  /** The newest crash reports, newest first, as they were written. */
  readonly crashReports: (
    most: number,
  ) => readonly { readonly name: string; readonly report: unknown }[];
  /** The folder of the summary and the crash reports. */
  readonly folder: string;
  readonly openPath: (path: string) => Promise<string>;
  /** Where the person chooses to save the report, or none if they cancel. */
  readonly chooseFile: () => Promise<string | undefined>;
  readonly writeFile: (path: string, text: string) => Promise<void>;
};

/**
 * Registers Help › Diagnostics…'s calls (5.41, BD-2) at start-up. What they do is in
 * `diagnostics.ts`, imported when first used, never with main at start-up (#892).
 */
export function registerDiagnosticsHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  parts: DiagnosticsParts,
): void {
  const shown = async () => {
    const summary = await parts.summary();
    if (summary === undefined) return null;
    const { flattenSummary } = await import("./diagnostics.js");
    return flattenSummary(await summary.read());
  };
  registerIpcHandler(ipc, "getDiagnostics", isTrustedSender, shown);
  registerIpcHandler(ipc, "clearDiagnostics", isTrustedSender, async () => {
    await (await parts.summary())?.clear();
    return shown();
  });
  registerIpcHandler(ipc, "openDiagnosticsFolder", isTrustedSender, async () => {
    // Electron answers an empty string when it opened the folder, and why not otherwise.
    try {
      return (await parts.openPath(parts.folder)) === "";
    } catch {
      return false;
    }
  });
  registerIpcHandler(ipc, "saveDiagnostics", isTrustedSender, async () => {
    const summary = await parts.summary();
    if (summary === undefined) return "failed";
    const path = await parts.chooseFile();
    if (path === undefined) return "cancelled";
    try {
      const { CRASH_REPORTS_SAVED, diagnosticsReport } = await import("./diagnostics.js");
      const report = diagnosticsReport(
        await summary.read(),
        parts.crashReports(CRASH_REPORTS_SAVED),
      );
      await parts.writeFile(path, report);
      return "saved";
    } catch {
      return "failed";
    }
  });
}
