import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { Area, WindowContext } from "../editor/areas.js";
import { siteSession } from "../storage/index.js";
import { registerAssistantPanel } from "./register-assistant-panel.js";
import { registerAssistantSettings } from "./register-assistant-settings.js";

/**
 * The assistant (6.9c, UX-28, ADR 0026): its panel, a conversation on the open site with the model the
 * person chose through main's `assistant` domain, in the left column; and *Settings › Assistant*.
 */
export const assistantPanelArea: Area<WindowContext> = {
  id: "assistantPanel",
  register: ({ api, panels, session, settings, windowDialogs }) => {
    // Settings › Assistant and its dialog, which the panel's Set Up opens too.
    const assistantSettings = registerAssistantSettings(settings, windowDialogs, api.assistant);
    const removePanel = registerAssistantPanel({
      panels,
      session,
      api: api.assistant,
      sessionId: siteSession(),
      openSettings: assistantSettings.open,
      // Until main can open a reply's link itself (6.9a part 5's openLink), its address is copied.
      openLink: (href) =>
        void api.clipboard.copyText(href).then(() => toast(t("assistant.link.copied"))),
    });
    return () => {
      removePanel();
      assistantSettings.remove();
    };
  },
};
