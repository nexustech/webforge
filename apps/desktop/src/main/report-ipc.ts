import type { IpcMain } from "electron";
import { registerIpcHandler } from "./ipc.js";
import type { ReportCalls } from "./report-problem.js";

/**
 * Registers Help › Report a Problem's calls (5.23, OL-10) at start-up, each answered by
 * `report-problem.ts`'s, which `calls` loads when the person first uses it (#892).
 */
export function registerReportHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  calls: () => Promise<ReportCalls>,
): void {
  registerIpcHandler(ipc, "getReportInfo", isTrustedSender, async () =>
    (await calls()).getReportInfo(),
  );
  registerIpcHandler(ipc, "openReport", isTrustedSender, async (route, text) =>
    (await calls()).openReport(route, text),
  );
  registerIpcHandler(ipc, "captureWindow", isTrustedSender, async () =>
    (await calls()).captureWindow(),
  );
  registerIpcHandler(ipc, "saveWindowCapture", isTrustedSender, async () =>
    (await calls()).saveWindowCapture(),
  );
  registerIpcHandler(ipc, "discardWindowCapture", isTrustedSender, async () =>
    (await calls()).discardWindowCapture(),
  );
}
