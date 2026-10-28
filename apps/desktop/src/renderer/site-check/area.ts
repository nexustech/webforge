import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { createElement } from "react";
import type { Area, WindowContext } from "../editor/areas.js";
import { reportFailure } from "../log.js";
import { siteSession } from "../storage/index.js";
import { BundleDialog, createBundleConfirm } from "./bundle.js";
import { registerSiteCheckPanel } from "./register-site-check-panel.js";

/**
 * Site Check (3.6, F-CHK-1): its panel in the bottom drawer, checking the open site as it changes,
 * with what the person ignored remembered with the site, and Download and bundle's question (3.9).
 */
export const siteCheckArea: Area<WindowContext> = {
  id: "siteCheck",
  register: ({ panels, session, settings, commands, siteCheckIgnored, windowDialogs }) => {
    // Download and bundle's question (3.9), drawn once in the window.
    const question = createBundleConfirm();
    const removeDialog = windowDialogs.register({
      id: "bundleFile",
      component: () => createElement(BundleDialog, { state: question.state }),
    });
    const removePanel = registerSiteCheckPanel(panels, {
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
      bundle: {
        confirm: question.confirm,
        download: (url) => window.webforge.site.bundleFile(siteSession(), url),
        notify: (message) => toast.error(message),
      },
    });
    return () => {
      removePanel();
      removeDialog();
    };
  },
};
