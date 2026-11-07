import { componentHelp, helpComponentsOf } from "@webforge/help";
import { t } from "@webforge/i18n";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import type { HelpTarget } from "../../shared/ipc/help.js";
import type { Area, WindowContext } from "../editor/areas.js";
import { fieldTarget } from "../editor/field-target.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { openHelpWith } from "./HelpCommands.js";
import { bundledHelpLibrary } from "./help-library.js";

/** Each component type's page and heading (UX-24), worked out once: neither changes as the app runs. */
let links: ReadonlyMap<string, HelpTarget> | undefined;
function elementHelp(): ReadonlyMap<string, HelpTarget> {
  links ??= componentHelp(bundledHelpLibrary().ordered, helpComponentsOf(CATALOGUE));
  return links;
}

/**
 * *Help for this element* (5.4b, UX-24): in the canvas's and Layers' right-click menu, and Search
 * Commands, it opens the Help window at the selected element's page and heading; a Gallery's image
 * at the Gallery's. Off while nothing, or more than one thing, is selected.
 */
export const helpForElementArea: Area<WindowContext> = {
  id: "helpForElement",
  register: ({ api, session, commands }) => {
    const selected = (): HelpTarget | undefined => {
      const { pageId, nodeId, others = [] } = session.ui.getState();
      if (others.length > 0) return undefined;
      const target = fieldTarget(
        session.history.document.getState(),
        session.library,
        pageId,
        nodeId,
      );
      return target === undefined ? undefined : elementHelp().get(target.node.type);
    };
    let enabled = false;
    const update = () => {
      const now = selected() !== undefined;
      if (now === enabled) return;
      enabled = now;
      commands.update(COMMAND_IDS.helpForElement, { enabled });
    };
    const removers = [
      commands.register({
        id: COMMAND_IDS.helpForElement,
        label: t("command.helpForElement"),
        enabled,
        run: () => {
          const target = selected();
          if (target !== undefined) openHelpWith(api.help, target);
        },
      }),
      session.ui.subscribe(update),
      session.history.document.subscribe(update),
    ];
    update();
    return () => {
      for (const remove of removers.toReversed()) remove();
    };
  },
};
