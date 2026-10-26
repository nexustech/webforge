import type { Area, WindowContext } from "../editor/areas.js";
import { createOwnThemes } from "./own-themes.js";
import { registerOwnThemes } from "./register-own-themes.js";
import { registerThemePanel } from "./register-theme-panel.js";
import { registerThemeStudio } from "./register-theme-studio.js";
import { createStudio } from "./studio/studio-state.js";
import { registerThemeCommands } from "./theme-commands.js";

/**
 * The Theme tab (2.3a) and Theme Studio (2.3b), View → Theme… and Theme Studio… (#452), and My
 * themes (2.22): the person's own themes, kept on this computer.
 */
export const themePanelArea: Area<WindowContext> = {
  id: "themePanel",
  register: ({ panels, commands, windowDialogs, session, siteWide }) => {
    const studio = createStudio();
    const ownThemes = createOwnThemes(() => window.webforge.themes);
    const removePanel = registerThemePanel(panels, session, siteWide, studio, ownThemes);
    const removeCommands = registerThemeCommands(commands, panels, studio);
    const removeStudio = registerThemeStudio(windowDialogs, session, studio, siteWide, ownThemes);
    const removeOwn = registerOwnThemes(windowDialogs, session, ownThemes);
    return () => {
      removeOwn();
      removeStudio();
      removeCommands();
      removePanel();
    };
  },
};
