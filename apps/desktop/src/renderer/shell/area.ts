import type { Area, WindowContext } from "../editor/areas.js";
import { registerViewCommands } from "./view-commands.js";

/** View → Zoom In/Out, Actual Size, Zoom to Fit and the device views (F-ED-27, 2.20, B1). */
export const viewCommandsArea: Area<WindowContext> = {
  id: "viewCommands",
  register: ({ commands, session, canvasView }) =>
    registerViewCommands(commands, session, canvasView),
};
