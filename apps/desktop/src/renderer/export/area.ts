import { siteLibrary } from "@webforge/site-components";
import type { Area, WindowContext } from "../editor/areas.js";
import { registerExportCommand } from "./export-command.js";
import { exportRequestFor } from "./export-request.js";

/** File → Export Site, of the site as it is when the command runs (2.20, B1). */
export const exportCommandArea: Area<WindowContext> = {
  id: "exportCommand",
  register: ({ commands, session, exportSite, cancelExport }) =>
    registerExportCommand(
      commands,
      (onProgress) =>
        exportSite(exportRequestFor(session.history.document.getState(), siteLibrary), onProgress),
      cancelExport,
    ),
};
