import type { Area, WindowContext } from "../editor/areas.js";
import { registerPageCommands } from "./page-commands.js";
import { registerSitePanel } from "./SitePanel.js";

/** The Site panel's Pages and Menu (2.20, B1). */
export const sitePanelArea: Area<WindowContext> = {
  id: "sitePanel",
  register: ({ panels, session, siteWide }) => registerSitePanel(panels, session, siteWide),
};

/** The command palette's Go to page (1.34, F-ED-26). */
export const pageCommandsArea: Area<WindowContext> = {
  id: "pageCommands",
  register: ({ commands, session }) => registerPageCommands(commands, session),
};
