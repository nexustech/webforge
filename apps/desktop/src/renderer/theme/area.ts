import { toast } from "@webforge/editor-ui";
import type { Area, WindowContext } from "../editor/areas.js";
import { PRELOAD_ITEM_CSS } from "../editor/ItemCssView.js";
import { createOwnThemes } from "./own-themes.js";
import { registerOwnThemes } from "./register-own-themes.js";
import { registerThemePanel } from "./register-theme-panel.js";
import { registerThemeStudio } from "./register-theme-studio.js";
import { createStudio } from "./studio/studio-state.js";
import { registerStyleDialog } from "./style/register-style-dialog.js";
import { createStyleDialog } from "./style/style-state.js";
import { registerThemeCommands } from "./theme-commands.js";

/**
 * The Theme tab (2.3a) and Theme Studio (2.3b), View → Theme… and Theme Studio… (#452), My themes
 * (2.23): the person's own themes, kept on this computer, and *Style this ‹kind›…* (3.13a), whose
 * changes can become the theme's look for a kind.
 */
export const themePanelArea: Area<WindowContext> = {
  id: "themePanel",
  register: ({
    panels,
    commands,
    windowDialogs,
    session,
    preferences,
    siteWide,
    kindPreviews,
    itemPreviews,
  }) => {
    const studio = createStudio();
    const ownThemes = createOwnThemes(() => window.webforge.themes, {
      notify: (message) => toast.error(message),
    });
    const removePanel = registerThemePanel(panels, session, siteWide, studio, ownThemes);
    const removeCommands = registerThemeCommands(commands, panels, studio);
    const removeStudio = registerThemeStudio(windowDialogs, session, studio, {
      siteWide,
      ownThemes,
      kindPreviews,
    });
    const removeOwn = registerOwnThemes(windowDialogs, session, ownThemes);
    const removeStyle = registerStyleDialog(
      windowDialogs,
      commands,
      session,
      preferences,
      createStyleDialog(),
      {
        asks: {
          siteWide,
          theme: { siteWide, names: ownThemes, notify: (message) => toast(message) },
          notify: (message) => toast(message),
        },
        itemPreviews,
        itemCss: PRELOAD_ITEM_CSS,
      },
    );
    return () => {
      removeStyle();
      removeOwn();
      removeStudio();
      removeCommands();
      removePanel();
    };
  },
};
