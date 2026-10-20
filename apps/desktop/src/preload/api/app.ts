import type { AppApi } from "../../shared/ipc/app.js";
import type { Call } from "./call.js";

/** `window.webforge.app`. */
export const appApi = (call: Call): AppApi => ({
  getInfo: () => call("getAppInfo"),
});
