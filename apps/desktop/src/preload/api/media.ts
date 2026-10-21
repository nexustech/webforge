import type { MediaApi } from "../../shared/ipc/media.js";
import type { Call } from "./call.js";

/** `window.webforge.media`. */
export const mediaApi = (call: Call): MediaApi => ({
  import: (files) => call("importMedia", [...files]),
  choose: () => call("chooseMedia"),
});
