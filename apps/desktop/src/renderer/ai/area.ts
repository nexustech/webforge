import { createCommandApi } from "@webforge/commands";
import type { Area, WindowContext } from "../editor/areas.js";
import { answerRequest, commandHost } from "./command-host.js";

/**
 * AI apps' requests (F-AI-1, 4.8): while a site is open in the window, main forwards each tool
 * call here and the command layer answers it, every change one labelled undo step.
 */
export const aiRequestsArea: Area<WindowContext> = {
  id: "aiRequests",
  register: ({ api, session, preferences, siteWide }) => {
    const commandApi = createCommandApi(commandHost(session, preferences, siteWide));
    return api.ai.onRequest((request) => answerRequest(commandApi, request));
  },
};
