import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { Area, WindowContext } from "../editor/areas.js";
import { reportFailure } from "../log.js";
import { registerSiteCheckPanel } from "./register-site-check-panel.js";

/**
 * Site Check (3.6, F-CHK-1): its panel in the bottom drawer, checking the open site as it changes,
 * with what the person ignored remembered with the site.
 */
export const siteCheckArea: Area<WindowContext> = {
  id: "siteCheck",
  register: ({ panels, session, settings, commands, siteCheckIgnored }) =>
    registerSiteCheckPanel(panels, {
      session,
      settings,
      commands,
      // A guide's page (3.17), by its name: main knows the address.
      openGuide: (guide) => {
        window.webforge.app
          .openGuide(guide)
          .then((opened) => {
            if (!opened) toast.error(t("siteCheck.guide.failed"));
          })
          .catch((error: unknown) => reportFailure("siteCheck.guide", error));
      },
      ignored: siteCheckIgnored.initial,
      saveIgnored: siteCheckIgnored.save,
    }),
};
