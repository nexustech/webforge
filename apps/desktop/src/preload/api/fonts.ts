import type { FontsApi } from "../../shared/ipc/fonts.js";
import type { Call } from "./call.js";

/** `window.webforge.fonts`. */
export const fontsApi = (call: Call): FontsApi => ({
  list: () => call("listFonts"),
  browse: () => call("browseFonts"),
  download: (id) => call("downloadFont", id),
});
