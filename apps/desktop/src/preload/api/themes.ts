import type { ThemesApi } from "../../shared/ipc/themes.js";
import type { Call } from "./call.js";

/** `window.webforge.themes`. */
export const themesApi = (call: Call): ThemesApi => ({
  list: () => call("listThemes"),
  keep: (theme) => call("keepTheme", theme),
  remove: (id) => call("removeTheme", id),
});
