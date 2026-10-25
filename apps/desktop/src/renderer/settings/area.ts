import type { Area, WindowContext } from "../editor/areas.js";
import { registerAppSettings } from "./app-settings.js";

/**
 * Settings (LF-12): the app's parts, Interface and Devices, in the window's one Settings dialog,
 * where the site-settings area adds the open site's. Registered once, with the window.
 */
export const settingsArea: Area<WindowContext> = {
  id: "settings",
  register: ({ settings, preferences }) => registerAppSettings(settings, preferences),
};
