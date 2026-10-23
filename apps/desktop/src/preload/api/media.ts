import type { MediaApi } from "../../shared/ipc/media.js";
import type { Call } from "./call.js";

/** `window.webforge.media`. */
export const mediaApi = (call: Call): MediaApi => ({
  import: (sessionId, files) => call("importMedia", sessionId, [...files]),
  choose: () => call("chooseMedia"),
});
