import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { Area, WindowContext } from "../editor/areas.js";
import { siteSession } from "../storage/index.js";
import { registerAssistantPanel } from "./register-assistant-panel.js";

/**
 * The assistant's panel (6.9c, UX-28, ADR 0026): a conversation on the open site with the model the
 * person chose, through main's `assistant` domain, beside the Edit panel.
 */
export const assistantPanelArea: Area<WindowContext> = {
  id: "assistantPanel",
  register: ({ api, panels, session, settings }) =>
    registerAssistantPanel({
      panels,
      session,
      api: api.assistant,
      sessionId: siteSession(),
      settings,
      // Until main can open a reply's link itself (6.9a part 5's openLink), its address is copied.
      openLink: (href) =>
        void api.clipboard.copyText(href).then(() => toast(t("assistant.link.copied"))),
    }),
};
