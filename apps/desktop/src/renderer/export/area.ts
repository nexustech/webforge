import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { siteLibrary } from "@webforge/site-components";
import type { SiteApi } from "../../shared/ipc/site.js";
import type { Area, WindowContext } from "../editor/areas.js";
import { reportFailure } from "../log.js";
import { SITE_CHECK_PANEL_ID } from "../site-check/index.js";
import { siteSession } from "../storage/index.js";
import { exportDialogsFor } from "./ExportDialogs.js";
import { type ExportSite, registerExportCommand } from "./export-command.js";
import { createExportDialogs } from "./export-dialogs.js";

/**
 * Exports through main as operation `operationId`, telling `onProgress` each stage main reports of
 * it until it answers: another export's progress isn't this one's (A14). The export names the
 * opening of the site this page was loaded for (R6, #663): main refuses it once a hand-off has
 * replaced that site.
 */
const exportThrough =
  (site: Pick<SiteApi, "export" | "onExportProgress">): ExportSite =>
  async (request, operationId, onProgress) => {
    const stop = site.onExportProgress((of, progress) => {
      if (of === operationId) onProgress(progress);
    });
    try {
      return await site.export(siteSession(), request, operationId);
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
    const { api, commands, session, settings, preferences, windowDialogs, panels, codeTrust } =
      context;
    const dialogs = createExportDialogs();
    // Preview from disk: main opens what it exported itself, or says it isn't there any more.
    const openExport = () => {
      api.site
        .openExport(siteSession())
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
      cancel: (operationId) => api.site.cancelExport(operationId),
      choices: () => api.site.exportChoices(siteSession()),
      saveChoices: (choices) => api.site.setExportChoices(siteSession(), choices),
      dialogs,
      showSettings: (part, group) => settings.show(part, group),
      showSiteCheck: () => panels.show(SITE_CHECK_PANEL_ID),
      confirmCode: (site) => codeTrust.confirm(site),
    });
    return () => {
      removeCommand();
      removeDialogs();
    };
  },
};
