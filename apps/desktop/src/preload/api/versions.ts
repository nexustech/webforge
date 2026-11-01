import type { VersionsApi } from "../../shared/ipc/versions.js";
import type { Call } from "./call.js";

/** `window.webforge.versions`. */
export const versionsApi = (call: Call): VersionsApi => ({
  list: (sessionId) => call("listVersions", sessionId),
  save: (sessionId, version) => call("saveVersion", sessionId, version),
  delete: (sessionId, id) => call("deleteVersion", sessionId, id),
  readSite: (sessionId, id) => call("readVersionSite", sessionId, id),
  openAsNewSite: (sessionId, id) => call("openVersionAsNewSite", sessionId, id),
});
