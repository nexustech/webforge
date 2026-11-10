import type { Area, WindowContext } from "../editor/areas.js";
import { registerRegionCommands } from "./regions.js";
import {
  registerInterfaceZoomCommands,
  registerViewCommands,
  registerViewOptionCommands,
} from "./view-commands.js";

/**
 * View → Zoom In/Out, Actual Size, Zoom to Fit and the device views (F-ED-27, 2.20, B1), Show/Hide
 * Outlines and Element Names (#857), Zoom In, Zoom Out and Reset Interface (the whole window), and Next and Previous Part of the Window (F6, 5.5).
 */
export const viewCommandsArea: Area<WindowContext> = {
  id: "viewCommands",
  register: ({ commands, session, canvasView, preferences }) => {
    const removeView = registerViewCommands(commands, session, canvasView);
    const removeOptions = registerViewOptionCommands(commands, preferences);
    const removeInterfaceZoom = registerInterfaceZoomCommands(commands, preferences);
    const removeRegions = registerRegionCommands(commands, document);
    return () => {
      removeRegions();
      removeInterfaceZoom();
      removeOptions();
      removeView();
    };
  },
};
