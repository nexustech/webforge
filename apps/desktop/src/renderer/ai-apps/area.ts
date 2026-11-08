import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { createElement } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Area, WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { AiAppsDialog } from "./AiAppsDialog.js";

/**
 * AI apps (F-AI-1, 4.9): File → AI apps… and the palette open its dialog, drawn in the window,
 * where AI apps are let in or not, paired and removed. Each acts at once, so it isn't a section of
 * Settings, which saves on Save.
 */
export const aiAppsArea: Area<WindowContext> = {
  id: "aiApps",
  register: ({ api, commands, windowDialogs }) => {
    const opened = createStore<{ readonly open: boolean }>(() => ({ open: false }));
    const close = () => opened.setState({ open: false });
    // The address moved since AI apps was last open (S27): said as the window starts, until seen.
    void api.mcp
      .status()
      .then((status) => {
        if (!status.moved) return;
        toast(t("aiApps.movedToast"), {
          action: { label: t("aiApps.command"), onClick: () => opened.setState({ open: true }) },
        });
      })
      .catch(() => undefined);

    function AiApps() {
      const { open } = useStore(opened);
      return createElement(AiAppsDialog, {
        open,
        mcp: api.mcp,
        copyText: (text) => api.clipboard.copyText(text),
        copySecret: (secret) => api.clipboard.copySecret(secret),
        notify: (message) => toast.error(message),
        onClose: close,
      });
    }

    const removeDialog = windowDialogs.register({ id: "aiApps", component: AiApps });
    const removeCommand = commands.register({
      id: COMMAND_IDS.aiApps,
      label: t("aiApps.command"),
      menu: "file",
      run: () => opened.setState({ open: true }),
    });
    return () => {
      removeCommand();
      removeDialog();
    };
  },
};
