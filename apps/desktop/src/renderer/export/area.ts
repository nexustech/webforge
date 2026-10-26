import { siteLibrary } from "@webforge/site-components";
import type { Area, WindowContext } from "../editor/areas.js";
import { reportFailure } from "../log.js";
import { exportDialogsFor } from "./ExportDialogs.js";
import { registerExportCommand } from "./export-command.js";
import { createExportDialogs } from "./export-dialogs.js";

/**
 * File → Export Site, of the site as it is when the command runs (2.20, B1), with its dialogs
 * (3.3): the web address prompt, the options and the report, drawn in the window.
 */
export const exportCommandArea: Area<WindowContext> = {
  id: "exportCommand",
  register: (context) => {
    const { commands, session, settings, preferences, windowDialogs } = context;
    const dialogs = createExportDialogs();
    // Preview from disk: main opens what it exported itself.
    const openExport = () => {
      context.openExport().catch((error: unknown) => {
        reportFailure("export.open", error);
      });
    };
    const removeDialogs = windowDialogs.register({
      id: "export",
      component: exportDialogsFor(dialogs, openExport),
    });
    const removeCommand = registerExportCommand(commands, {
      site: () => session.history.document.getState(),
      library: siteLibrary,
      advanced: () => preferences.getState().preferences.editorLevel === "advanced",
      exportSite: context.exportSite,
      cancel: context.cancelExport,
      choices: context.exportChoices,
      dialogs,
      showSettings: (part, group) => settings.show(part, group),
    });
    return () => {
      removeCommand();
      removeDialogs();
    };
  },
};
