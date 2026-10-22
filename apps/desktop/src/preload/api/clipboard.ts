import type { ClipboardApi } from "../../shared/ipc/clipboard.js";
import type { Call } from "./call.js";

/** `window.webforge.clipboard`. */
export const clipboardApi = (call: Call): ClipboardApi => ({
  write: (elements) => call("writeClipboard", elements),
  read: () => call("readClipboard"),
});
