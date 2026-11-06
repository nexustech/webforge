import { createCommandApi } from "@webforge/commands";
import type { Area, WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { siteSession } from "../storage/index.js";
import { createAppTools } from "./app-tools.js";
import { answerRequest, commandHost } from "./command-host.js";

/**
 * AI apps' requests (F-AI-1, 4.8): while a site is open in the window, main forwards each tool
 * call here and the command layer answers it, every change one labelled undo step. Run Site Check
 * and Open Preview the window answers itself (4.9, `APP_TOOLS`).
 */
export const aiRequestsArea: Area<WindowContext> = {
  id: "aiRequests",
  register: ({ api, session, preferences, siteWide, commands, codeTrust, siteCheckIgnored }) => {
    const commandApi = createCommandApi(commandHost(session, preferences, siteWide));
    const appTools = createAppTools({
      site: () => session.history.document.getState(),
      allowListConfirmed: () => codeTrust.allowListConfirmed.getState(),
      ignored: () => siteCheckIgnored.initial,
      openPreview: () => {
        commands.run(COMMAND_IDS.preview);
      },
    });
    // For the opening of the site this page was loaded for (#663).
    return api.ai.onRequest(siteSession(), async (request) => {
      return appTools(request) ?? answerRequest(commandApi, request);
    });
  },
};
