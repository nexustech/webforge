import type { IpcMain } from "electron";
import { registerIpcHandler } from "./ipc.js";
import { log } from "./log.js";

/**
 * At most this many handled failures a minute reach the log, as for crash reports: a renderer
 * failing in a loop mustn't fill the 1 MB log and rotate out everything useful.
 */
const MAX_LOGGED_PER_MINUTE = 10;

/**
 * Registers `app:log-failure` (R12): a failure the renderer handled goes into the app's log, by
 * where it happened and the error's name and code. The contract lets nothing else through. Past
 * {@link MAX_LOGGED_PER_MINUTE}, failures are counted instead, and the next line that is logged
 * says how many were left out.
 */
export function registerFailureLog(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  now: () => number = Date.now,
): void {
  let recent: number[] = [];
  let dropped = 0;
  registerIpcHandler(ipc, "logFailure", isTrustedSender, (context, code) => {
    const time = now();
    recent = recent.filter((logged) => time - logged < 60_000);
    if (recent.length >= MAX_LOGGED_PER_MINUTE) {
      dropped += 1;
      return null;
    }
    recent.push(time);
    if (dropped > 0) {
      log.warn("The editor handled more failures than the log keeps", { dropped });
      dropped = 0;
    }
    log.warn("The editor handled a failure", { context, code });
    return null;
  });
}
