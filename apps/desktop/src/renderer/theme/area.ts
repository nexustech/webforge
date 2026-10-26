import type { Area, WindowContext } from "../editor/areas.js";
import { registerThemePanel } from "./register-theme-panel.js";

/** The Theme tab (2.3a): the site's theme, its colours, fonts and styles. */
export const themePanelArea: Area<WindowContext> = {
  id: "themePanel",
  register: ({ panels, session, siteWide }) => registerThemePanel(panels, session, siteWide),
};
