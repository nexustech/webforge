import type { Area, WindowContext } from "../editor/areas.js";
import { registerStylesheetPanel } from "./register-stylesheet-panel.js";

/**
 * The Stylesheet panel (CT-8, 6.8): the site's own `custom.css` in a code editor in the bottom
 * drawer, in Advanced mode, live on the canvas, with *Target this element* and *Move this look to
 * CSS* for the selected element.
 */
export const stylesheetPanelArea: Area<WindowContext> = {
  id: "stylesheetPanel",
  register: ({ api, panels, session, commands, preferences, codeTrust }) =>
    registerStylesheetPanel({
      session,
      panels,
      commands,
      preferences,
      canvas: () => api.canvas,
      allowListConfirmed: codeTrust.allowListConfirmed,
    }),
};
