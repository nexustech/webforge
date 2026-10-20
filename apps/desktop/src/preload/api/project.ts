import type { ProjectApi } from "../../shared/ipc/project.js";
import type { Call } from "./call.js";

/** `window.webforge.project`. */
export const projectApi = (call: Call): ProjectApi => ({
  create: () => call("createProject"),
  open: () => call("openProject"),
  getCurrent: () => call("getCurrentProject"),
  readSite: () => call("readSite"),
  listRecent: () => call("listRecentSites"),
  openRecent: (id) => call("openRecentSite", id),
  removeRecent: (id) => call("removeRecentSite", id),
  commit: (changes) => call("commitSite", [...changes]),
  getUiState: () => call("getUiState"),
  setUiState: (state) => call("setUiState", state),
});
