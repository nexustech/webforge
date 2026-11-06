import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { createElement } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Area, WindowContext } from "../editor/areas.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { siteSession } from "../storage/index.js";
import { PublishDialog } from "./PublishDialog.js";
import { fillWebAddress } from "./web-address.js";

/**
 * Publish (F-PB-1, 4.4a): the title bar's Publish button, File → Publish… and Mod+U open the site's
 * publish destinations, drawn in the window. A destination saved with a web address fills Site
 * Settings' when the site has none, as one undo step.
 */
export const publishArea: Area<WindowContext> = {
  id: "publish",
  register: ({ api, commands, session, windowDialogs }) => {
    const opened = createStore<{ readonly open: boolean }>(() => ({ open: false }));
    const close = () => opened.setState({ open: false });

    function Publish() {
      const { open } = useStore(opened);
      return createElement(PublishDialog, {
        open,
        publish: api.publish,
        sessionId: siteSession,
        notify: (message) => toast.error(message),
        onSaved: (destination) => {
          fillWebAddress(session, destination);
        },
        onClose: close,
      });
    }

    const removeDialog = windowDialogs.register({ id: "publish", component: Publish });
    const removeCommand = commands.register({
      id: COMMAND_IDS.publish,
      label: t("command.publish"),
      menu: "file",
      run: () => opened.setState({ open: true }),
    });
    return () => {
      removeCommand();
      removeDialog();
    };
  },
};
