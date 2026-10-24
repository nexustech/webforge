import type { IpcMain } from "electron";
import { registerIpcHandler } from "./ipc.js";
import { log } from "./log.js";

/**
 * Registers `app:log-failure` (R12): a failure the renderer handled goes into the app's log, by
 * where it happened and the error's name and code. The contract lets nothing else through.
 */
export function registerFailureLog(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
): void {
  registerIpcHandler(ipc, "logFailure", isTrustedSender, (context, code) => {
    log.warn("The editor handled a failure", { context, code });
    return null;
  });
}
