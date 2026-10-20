import type { PrefsApi } from "../../shared/ipc/prefs.js";
import type { Call } from "./call.js";

/** `window.webforge.prefs`. */
export const prefsApi = (call: Call): PrefsApi => ({
  get: () => call("getPreferences"),
  set: (change) => call("setPreferences", change),
});
