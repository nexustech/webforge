import type { Area, WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { registerAppSettings } from "./app-settings.js";

/**
 * Settings (LF-12): the app's parts, Interface, Devices, Updates and a line opening AI apps (#752), in the
 * window's one Settings dialog, where the site-settings area adds the open site's. Registered
 * once, with the window.
 */
export const settingsArea: Area<WindowContext> = {
  id: "settings",
  register: ({ settings, preferences, commands, appVersion }) =>
    registerAppSettings(
      settings,
      preferences,
      () => {
        commands.run(COMMAND_IDS.aiApps);
      },
      appVersion,
    ),
};
