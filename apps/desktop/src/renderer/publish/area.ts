import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { createElement } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Area, WindowContext } from "../editor/areas.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { SITE_CHECK_PANEL_ID } from "../site-check/index.js";
import { siteSession } from "../storage/index.js";
import { PublishDialog } from "./PublishDialog.js";
import { createPublishOutcomes, PublishOutcomeDialogs } from "./PublishOutcomeDialogs.js";
import { type PublishFlow, publishTo } from "./publish-flow.js";
import { fillWebAddress } from "./web-address.js";

/**
 * Publish (F-PB-1, 4.4a, 4.5): the title bar's Publish button, File → Publish… and Mod+U open the
 * site's publish destinations, drawn in the window; each one's Publish publishes the site there,
 * one publish at a time, ending in *Your site is live*. A destination saved with a web address
 * fills Site Settings' when the site has none, as one undo step.
 */
export const publishArea: Area<WindowContext> = {
  id: "publish",
  register: ({ api, commands, session, windowDialogs, panels, codeTrust }) => {
    const opened = createStore<{ readonly open: boolean }>(() => ({ open: false }));
    const close = () => opened.setState({ open: false });
    const outcomes = createPublishOutcomes();
    const flow: PublishFlow = {
      site: () => session.history.document.getState(),
      flushCanvas: () => session.flush(),
      confirmCode: (site) => codeTrust.confirm(site),
      showSiteCheck: () => panels.show(SITE_CHECK_PANEL_ID),
      api: api.publish,
      sessionId: siteSession,
      askReplace: outcomes.askReplace,
      showLive: outcomes.showLive,
      showDestinations: () => opened.setState({ open: true }),
    };
    // One publish at a time: another waits for none, it's simply not started.
    let publishing = false;

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
        onPublish: (destination) => {
          if (publishing) return;
          publishing = true;
          close();
          void publishTo(flow, destination).finally(() => {
            publishing = false;
          });
        },
        onClose: close,
      });
    }

    function Outcomes() {
      return createElement(PublishOutcomeDialogs, {
        state: outcomes.state,
        openLive: (operationId) => {
          api.publish
            .openLive(operationId)
            .then((opened) => {
              if (!opened) toast.error(t("publish.live.openFailed"));
            })
            .catch((error: unknown) => reportFailure("publish.open", error));
        },
        copyLink: (url) => {
          api.clipboard
            .copyText(url)
            .then(() => toast.success(t("publish.live.copied")))
            .catch((error: unknown) => reportFailure("publish.copy", error));
        },
      });
    }

    const removeDialog = windowDialogs.register({ id: "publish", component: Publish });
    const removeOutcomes = windowDialogs.register({ id: "publishOutcome", component: Outcomes });
    const removeCommand = commands.register({
      id: COMMAND_IDS.publish,
      label: t("command.publish"),
      menu: "file",
      run: () => opened.setState({ open: true }),
    });
    return () => {
      removeCommand();
      removeOutcomes();
      removeDialog();
    };
  },
};
