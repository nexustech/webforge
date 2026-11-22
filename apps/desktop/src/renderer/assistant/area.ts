import type { Area, WindowContext } from "../editor/areas.js";
import { siteSession } from "../storage/index.js";
import { registerAssistantExamples } from "./register-assistant-examples.js";
import { registerAssistantPanel } from "./register-assistant-panel.js";
import { registerAssistantSettings } from "./register-assistant-settings.js";

/**
 * The assistant (6.9c, UX-28, ADR 0026): its panel, a conversation on the open site with the model the
 * person chose through main's `assistant` domain, in the left column; *Settings › Assistant*; and
 * *Things You Can Ask* (5.21, OL-8), from the panel and from Help.
 */
export const assistantPanelArea: Area<WindowContext> = {
  id: "assistantPanel",
  register: ({ api, commands, panels, session, settings, windowDialogs }) => {
    // Settings › Assistant and its dialog, which the panel's Set Up opens too.
    const assistantSettings = registerAssistantSettings(settings, windowDialogs, api.assistant);
    const panel = registerAssistantPanel({
      panels,
      session,
      api: api.assistant,
      sessionId: siteSession(),
      openSettings: assistantSettings.open,
      openExamples: () => examples.open(),
    });
    const examples = registerAssistantExamples(commands, windowDialogs, panel.tryExample);
    return () => {
      examples.remove();
      panel.remove();
      assistantSettings.remove();
    };
  },
};
