import type { Area, WindowContext } from "../editor/areas.js";
import { registerThemePanel } from "./register-theme-panel.js";
import { registerThemeStudio } from "./register-theme-studio.js";
import { createStudio } from "./studio/studio-state.js";
import { registerThemeCommands } from "./theme-commands.js";

/** The Theme tab (2.3a) and Theme Studio (2.3b), and View → Theme… and Theme Studio… (#452). */
export const themePanelArea: Area<WindowContext> = {
  id: "themePanel",
  register: ({ panels, commands, windowDialogs, session, siteWide }) => {
    const studio = createStudio();
    const removePanel = registerThemePanel(panels, session, siteWide, studio);
    const removeCommands = registerThemeCommands(commands, panels, studio);
    const removeStudio = registerThemeStudio(windowDialogs, session, studio, siteWide);
    return () => {
      removeStudio();
      removeCommands();
      removePanel();
    };
  },
};
