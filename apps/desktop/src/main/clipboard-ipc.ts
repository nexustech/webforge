import type { IpcMain } from "electron";
import type { ElementClipboard } from "./clipboard.js";
import { registerIpcHandler } from "./ipc.js";
import type { ProjectSession } from "./project-session.js";

/**
 * Registers the clipboard IPC calls (1.25): copying and pasting elements, only from a renderer
 * loaded for the site open now (R6), as pasting can store images in it.
 */
export function registerClipboardHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  clipboard: ElementClipboard,
  session: Pick<ProjectSession, "staleReason">,
): void {
  registerIpcHandler(ipc, "writeClipboard", isTrustedSender, (sessionId, elements) => {
    const reason = session.staleReason(sessionId);
    return reason === undefined ? clipboard.write(elements) : { status: "failed", reason };
  });
  registerIpcHandler(ipc, "readClipboard", isTrustedSender, (sessionId) => {
    const reason = session.staleReason(sessionId);
    return reason === undefined ? clipboard.read() : { status: "failed", reason };
  });
}
