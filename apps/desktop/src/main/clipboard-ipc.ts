import type { IpcMain } from "electron";
import type { ElementClipboard } from "./clipboard.js";
import { registerIpcHandler } from "./ipc.js";
import { importMediaFiles } from "./media-import.js";
import { importFilesAt } from "./media-ipc.js";
import type { ProjectSession } from "./project-session.js";

/**
 * Registers the clipboard IPC calls (1.25): copying and pasting elements, only from a renderer
 * loaded for the site open now (R6), as pasting can store images in it.
 */
export function registerClipboardHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  clipboard: ElementClipboard,
  session: Pick<ProjectSession, "staleReason" | "forSession">,
  /** Puts text on the system clipboard (`clipboard.writeText`). */
  writeText: (text: string) => void,
): void {
  registerIpcHandler(ipc, "writeClipboard", isTrustedSender, (sessionId, elements) => {
    const reason = session.staleReason(sessionId);
    return reason === undefined
      ? clipboard.write(session.forSession(sessionId), elements)
      : { status: "failed", reason };
  });
  registerIpcHandler(ipc, "readClipboard", isTrustedSender, (sessionId) => {
    const reason = session.staleReason(sessionId);
    if (reason !== undefined) return { status: "failed", reason };
    // Reading the clipboard waits: what it stores, it stores only if the site is still open.
    const site = session.forSession(sessionId);
    return clipboard.read(site, {
      files: (paths) => importFilesAt(site, paths),
      image: (file) => importMediaFiles(site, [file]),
    });
  });
  registerIpcHandler(ipc, "copyText", isTrustedSender, (text) => {
    writeText(text);
    return null;
  });
}
