import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { Area, WindowContext } from "../editor/areas.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import { siteSession } from "../storage/index.js";

/**
 * File › Close Site (#1016): main saves the site's last changes and keeps its canvas for the
 * Recent list, as before another site opens, then closes it, and the window starts over on the
 * start screen. Off while it runs; a failure is a toast, with the site still open.
 */
export function registerCloseSiteCommand(
  registry: CommandRegistry,
  close: () => Promise<unknown>,
  restart: () => void,
): () => void {
  const run = async () => {
    registry.update(COMMAND_IDS.closeSite, { enabled: false });
    try {
      await close();
    } catch (error) {
      reportFailure("site.close", error);
      toast.error(t("site.closeFailed"));
      registry.update(COMMAND_IDS.closeSite, { enabled: true });
      return;
    }
    restart();
  };
  return registry.register({
    id: COMMAND_IDS.closeSite,
    label: t("command.closeSite"),
    menu: "file",
    run,
  });
}

/** Close Site, last in the File menu. */
export const closeSiteArea: Area<WindowContext> = {
  id: "closeSite",
  register: ({ api, commands }) =>
    // The site this page was loaded for (R6, #663).
    registerCloseSiteCommand(
      commands,
      () => api.project.close(siteSession()),
      () => window.location.reload(),
    ),
};
