import { toast } from "@webforge/editor-ui";
import { siteLibrary } from "@webforge/site-components";
import { createElement } from "react";
import { createStore } from "zustand/vanilla";
import type { Area, WindowContext } from "../editor/areas.js";
import { PhonePreviewDialog, type PhoneState } from "./PhonePreviewDialog.js";
import { registerPreviewCommands } from "./preview-commands.js";

/**
 * File → Preview and Preview on Phone… (3.2, F-PV-1), after Export: the site in the default
 * browser, kept up to date as it is edited, and its address as a QR code for a phone, in a dialog
 * drawn in the window.
 */
export const previewArea: Area<WindowContext> = {
  id: "preview",
  register: ({ api, commands, session, windowDialogs }) => {
    const phone = createStore<PhoneState>(() => ({ status: "closed" }));
    const removeDialog = windowDialogs.register({
      id: "phonePreview",
      component: () => createElement(PhonePreviewDialog, { state: phone }),
    });
    const removeCommands = registerPreviewCommands(commands, {
      session,
      library: siteLibrary,
      api: api.preview,
      phone,
      notify: (message) => toast.error(message),
    });
    return () => {
      removeCommands();
      removeDialog();
    };
  },
};
