import type { IpcMain } from "electron";
import type { ElementClipboard } from "./clipboard.js";
import { registerIpcHandler } from "./ipc.js";

/** Registers the clipboard IPC calls (1.25): copying and pasting elements. */
export function registerClipboardHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  clipboard: ElementClipboard,
): void {
  registerIpcHandler(ipc, "writeClipboard", isTrustedSender, (elements) =>
    clipboard.write(elements),
  );
  registerIpcHandler(ipc, "readClipboard", isTrustedSender, () => clipboard.read());
}
