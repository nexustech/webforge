import type { Area, WindowContext } from "../editor/areas.js";
import { registerRegionCommands } from "./regions.js";
import { registerViewCommands } from "./view-commands.js";

/**
 * View → Zoom In/Out, Actual Size, Zoom to Fit and the device views (F-ED-27, 2.20, B1), and Next
 * and Previous Part of the Window (F6, 5.5).
 */
export const viewCommandsArea: Area<WindowContext> = {
  id: "viewCommands",
  register: ({ commands, session, canvasView }) => {
    const removeView = registerViewCommands(commands, session, canvasView);
    const removeRegions = registerRegionCommands(commands, document);
    return () => {
      removeRegions();
      removeView();
    };
  },
};
