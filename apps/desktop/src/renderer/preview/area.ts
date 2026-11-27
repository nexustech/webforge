import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { siteLibrary } from "@webforge/site-components";
import { createElement } from "react";
import { createStore } from "zustand/vanilla";
import type { Area, WindowContext } from "../editor/areas.js";
import { TrustedCode } from "../editor/window-services.js";
import { widthOf } from "../shell/canvas-size.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { siteSession } from "../storage/index.js";
import { PhonePreviewDialog, type PhoneState } from "./PhonePreviewDialog.js";
import { registerPreviewCommands } from "./preview-commands.js";

/** Preview's toast that says what the page leaves out (#1512): one at a time. */
const LEFT_OUT_TOAST = "preview-left-out";

/**
 * File → Preview and Preview on Phone… (3.2, F-PV-1), after Export: the site in the default
 * browser, kept up to date as it is edited, and its address as a QR code for a phone, in a dialog
 * drawn in the window.
 */
export const previewArea: Area<WindowContext> = {
  id: "preview",
  uses: [TrustedCode],
  register: ({ api, canvasView, commands, session, windowDialogs, use }) => {
    const codeTrust = use(TrustedCode);
    const phone = createStore<PhoneState>(() => ({ status: "closed" }));
    const removeDialog = windowDialogs.register({
      id: "phonePreview",
      component: () =>
        createElement(PhonePreviewDialog, {
          state: phone,
          onStop: () => void commands.run(COMMAND_IDS.stopPhonePreview),
        }),
      close: () => phone.setState({ status: "closed" }, true),
    });
    const removeCommands = registerPreviewCommands(commands, {
      session,
      library: siteLibrary,
      api: api.preview,
      sessionId: siteSession,
      phone,
      notify: (message) => toast.error(message),
      // With what the page leaves out, it waits to be closed (#1512): the browser came to the front,
      // so it would be gone before the person looked back. One at a time: the next Preview's
      // replaces it, or takes it away when its page leaves nothing out, so no old count stays up.
      tell: (message, leftOut) => {
        if (leftOut === undefined) {
          toast.dismiss(LEFT_OUT_TOAST);
          toast(message);
          return;
        }
        toast(message, {
          id: LEFT_OUT_TOAST,
          description: leftOut.description,
          duration: Number.POSITIVE_INFINITY,
          closeButton: true,
          action: { label: t("canvas.show"), onClick: leftOut.show },
        });
      },
      saved: (message, description) => toast.success(message, { description }),
      // The device the canvas shows: Desktop's is the canvas's own width (PH2-18).
      width: () => widthOf(session.ui.getState().viewport, canvasView.getState().size?.width),
      confirmCode: (site) => codeTrust.confirm(site),
      onCodeTrusted: (listener) => codeTrust.onTrusted(listener),
    });
    return () => {
      removeCommands();
      removeDialog();
    };
  },
};
