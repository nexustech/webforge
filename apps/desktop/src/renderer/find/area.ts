import type { Area, WindowContext } from "../editor/areas.js";
import { registerFindReplacePanel } from "./register-find-replace-panel.js";

/**
 * Find and Replace (6.2): its panel in the bottom drawer and Edit › Find and Replace…, finding the
 * owner's text across the site and replacing it as one undo step.
 */
export const findReplacePanelArea: Area<WindowContext> = {
  id: "findReplacePanel",
  register: ({ panels, session, settings, commands, siteWide }) =>
    registerFindReplacePanel({ session, panels, settings, commands, siteWide }),
};
