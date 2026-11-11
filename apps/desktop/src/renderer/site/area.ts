import type { Area, EditorContext, WindowContext } from "../editor/areas.js";
import { connectCanvasItem } from "./canvas-item.js";
import { registerPageCommands } from "./page-commands.js";
import { registerPageSettingsCommand } from "./page-settings-command.js";
import { registerSitePanel } from "./SitePanel.js";

/** The fields of the post shown, in its Blog's design on the canvas (6.10a). */
export const canvasItemArea: Area<EditorContext> = {
  id: "canvasItem",
  register: ({ engine, session }) =>
    engine.whileMounted(({ engine: canvas }) => connectCanvasItem(canvas, session)),
};

/** The Site panel's Pages and Menu (2.20, B1). */
export const sitePanelArea: Area<WindowContext> = {
  id: "sitePanel",
  register: ({ panels, session, siteWide, publishedYear }) =>
    registerSitePanel(panels, session, siteWide, publishedYear),
};

/** The command palette's Go to page (1.34, F-ED-26), and Page Settings… for the page shown (3.17). */
export const pageCommandsArea: Area<WindowContext> = {
  id: "pageCommands",
  register: ({ commands, session, windowDialogs, publishedYear }) => {
    const removeGoTo = registerPageCommands(commands, session);
    const removeSettings = registerPageSettingsCommand(
      commands,
      windowDialogs,
      session,
      () => publishedYear.getState() !== undefined,
    );
    return () => {
      removeSettings();
      removeGoTo();
    };
  },
};
