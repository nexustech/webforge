import { toast } from "@webforge/editor-ui";
import type { Area, EditorContext, WindowContext } from "../editor/areas.js";
import { connectCanvasItem } from "./canvas-item.js";
import { connectCanvasPosts } from "./canvas-posts.js";
import { registerPageCommands } from "./page-commands.js";
import { registerPageSettingsCommand } from "./page-settings-command.js";
import { registerSitePanel } from "./register-site-panel.js";

/** The post shown, in its Blog's design, and the site's posts in Latest posts, on the canvas (6.10a, 6.10b). */
export const canvasItemArea: Area<EditorContext> = {
  id: "canvasItem",
  register: ({ engine, session }) =>
    engine.whileMounted(({ engine: canvas }) => {
      const stopItem = connectCanvasItem(canvas, session);
      const stopPosts = connectCanvasPosts(canvas, session);
      return () => {
        stopPosts();
        stopItem();
      };
    }),
};

/** The Site panel's Pages and Menu (2.20, B1). */
export const sitePanelArea: Area<WindowContext> = {
  id: "sitePanel",
  register: ({ api, panels, session, siteWide, publishedYear }) =>
    registerSitePanel(panels, session, siteWide, publishedYear, {
      chooseFiles: () => api.posts.chooseFiles(),
      notify: (message, failed) => (failed ? toast.error(message) : toast.success(message)),
    }),
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
