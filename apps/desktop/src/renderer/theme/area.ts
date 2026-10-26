import type { Area, WindowContext } from "../editor/areas.js";
import { registerThemePanel } from "./register-theme-panel.js";
import { registerThemeCommands } from "./theme-commands.js";

/** The Theme tab (2.3a), and View → Theme… that shows it (#452). */
export const themePanelArea: Area<WindowContext> = {
  id: "themePanel",
  register: ({ panels, commands, session, siteWide }) => {
    const removePanel = registerThemePanel(panels, session, siteWide);
    const removeCommands = registerThemeCommands(commands, panels);
    return () => {
      removeCommands();
      removePanel();
    };
  },
};
