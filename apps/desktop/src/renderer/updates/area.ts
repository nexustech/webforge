import type { Area, WindowContext } from "../editor/areas.js";
import { watchUpdates } from "./update-ready.js";

/**
 * Webforge's own updates (0.5a): main downloads them in the background and installs one as Webforge
 * closes. The editor's window says so once, quietly, when one is ready (`watchUpdates`); the start
 * screen, which has no areas, watches for itself.
 */
export const updatesArea: Area<WindowContext> = {
  id: "updates",
  register: ({ api }) => watchUpdates(api.updates),
};
