import type { ClipboardApi } from "../../shared/ipc/clipboard.js";
import type { Call } from "./call.js";

/** `window.webforge.clipboard`. */
export const clipboardApi = (call: Call): ClipboardApi => ({
  write: (sessionId, elements) => call("writeClipboard", sessionId, elements),
  read: (sessionId) => call("readClipboard", sessionId),
});
