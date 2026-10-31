import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { siteLibrary } from "@webforge/site-components";
import type { SiteApi } from "../../shared/ipc/site.js";
import type { Area, WindowContext } from "../editor/areas.js";
import { reportFailure } from "../log.js";
import { SITE_CHECK_PANEL_ID } from "../site-check/index.js";
import { exportDialogsFor } from "./ExportDialogs.js";
import { type ExportSite, registerExportCommand } from "./export-command.js";
import { createExportDialogs } from "./export-dialogs.js";

/** Exports through main, telling `onProgress` each stage main reports until it answers. */
const exportThrough =
  (site: Pick<SiteApi, "export" | "onExportProgress">): ExportSite =>
  async (request, onProgress) => {
    const stop = site.onExportProgress(onProgress);
    try {
      return await site.export(request);
    } finally {
      stop();
    }
  };

/**
 * File → Export Site, of the site as it is when the command runs (2.20, B1), with its dialogs
 * (3.3): the web address prompt, the options and the report, drawn in the window.
 */
export const exportCommandArea: Area<WindowContext> = {
  id: "exportCommand",
  register: (context) => {
    const { api, commands, session, settings, preferences, windowDialogs, panels } = context;
    const dialogs = createExportDialogs();
    // Preview from disk: main opens what it exported itself, or says it isn't there any more.
    const openExport = () => {
      api.site
        .openExport()
        .then((opened) => {
          if (opened === "missing") toast.error(t("export.report.missing"));
        })
        .catch((error: unknown) => {
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
      exportSite: exportThrough(api.site),
      cancel: () => api.site.cancelExport(),
      choices: () => api.site.exportChoices(),
      saveChoices: (choices) => api.site.setExportChoices(choices),
      dialogs,
      showSettings: (part, group) => settings.show(part, group),
      showSiteCheck: () => panels.show(SITE_CHECK_PANEL_ID),
    });
    return () => {
      removeCommand();
      removeDialogs();
    };
  },
};
