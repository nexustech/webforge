import type { Area, WindowContext } from "../editor/areas.js";
import { registerSiteCheckPanel } from "./register-site-check-panel.js";

/**
 * Site Check (3.6, F-CHK-1): its panel in the bottom drawer, checking the open site as it changes,
 * with what the person ignored remembered with the site.
 */
export const siteCheckArea: Area<WindowContext> = {
  id: "siteCheck",
  register: ({ panels, session, settings, siteCheckIgnored }) =>
    registerSiteCheckPanel(panels, {
      session,
      settings,
      ignored: siteCheckIgnored.initial,
      saveIgnored: siteCheckIgnored.save,
    }),
};
