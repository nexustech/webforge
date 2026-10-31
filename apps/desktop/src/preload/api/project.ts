import type { ProjectApi } from "../../shared/ipc/project.js";
import type { Call } from "./call.js";

/** `window.webforge.project`. */
export const projectApi = (call: Call): ProjectApi => ({
  create: (request) => call("createProject", request),
  open: () => call("openProject"),
  saveZip: () => call("saveSiteZip"),
  openZip: () => call("openSiteZip"),
  getCurrent: () => call("getCurrentProject"),
  readSite: () => call("readSite"),
  listRecent: () => call("listRecentSites"),
  openRecent: (id) => call("openRecentSite", id),
  pinRecent: (id, pinned) => call("pinRecentSite", id, pinned),
  removeRecent: (id) => call("removeRecentSite", id),
  clearRecent: () => call("clearRecentSites"),
  commit: (sessionId, changes) => call("commitSite", sessionId, [...changes]),
  getUiState: () => call("getUiState"),
  setUiState: (sessionId, state) => call("setUiState", sessionId, state),
});
