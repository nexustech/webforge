import { toast } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { PublishDestination } from "@webforge/model";
import { createElement } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Area, WindowContext } from "../editor/areas.js";
import type { VersionToRepublish } from "../editor/publish-requests.js";
import { reportFailure } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { SITE_CHECK_PANEL_ID } from "../site-check/index.js";
import { siteSession } from "../storage/index.js";
import { netlifyThrough } from "./netlify-api.js";
import { PublishDialog } from "./PublishDialog.js";
import { createPublishOutcomes, PublishOutcomeDialogs } from "./PublishOutcomeDialogs.js";
import { type PublishFlow, publishTo, republishTo } from "./publish-flow.js";
import { fillWebAddress } from "./web-address.js";

/** Whether the destinations are shown, and the saved version they'd republish, if one (4.6b). */
type Opened = { readonly open: boolean; readonly version?: VersionToRepublish };

/**
 * Publish (F-PB-1, 4.4a, 4.5): the title bar's Publish button, File → Publish… and Mod+U open the
 * site's publish destinations, drawn in the window; each one's Publish publishes the site there,
 * one publish at a time, ending in *Your site is live*. A destination saved with a web address
 * fills Site Settings' when the site has none, as one undo step. Version History's Republish…
 * (4.6b) opens the same destinations, each one's Republish publishing that version there.
 */
export const publishArea: Area<WindowContext> = {
  id: "publish",
  register: ({
    api,
    commands,
    session,
    windowDialogs,
    panels,
    codeTrust,
    publishedYear,
    onNetlify,
    publishing: requests,
  }) => {
    const opened = createStore<Opened>(() => ({ open: false }));
    // Netlify destinations (4.4b): its calls for the open site, and whether this build can sign in
    // through Netlify's page, which its OAuth client ID decides (4.2).
    const netlify = netlifyThrough(api.netlify, siteSession);
    const canSignIn = createStore<boolean>(() => false);
    api.netlify
      .status()
      .then((status) => canSignIn.setState(status.canSignIn, true))
      // Without it, only a pasted token: nothing else is held up.
      .catch((error: unknown) => reportFailure("publish.netlify", error));
    // The version stays while the dialog fades out, so its title doesn't change; each way of
    // opening it says afresh whether it republishes one.
    const close = () => opened.setState({ open: false });
    const outcomes = createPublishOutcomes();
    const flow: PublishFlow = {
      site: () => session.history.document.getState(),
      flushCanvas: () => session.flush(),
      confirmCode: (site) => codeTrust.confirm(site),
      showSiteCheck: () => panels.show(SITE_CHECK_PANEL_ID),
      api: api.publish,
      versions: api.versions,
      sessionId: siteSession,
      askReplace: outcomes.askReplace,
      // Live now: the site shows this year where its text has `{year}` (F-CM-8), and Version
      // History lists where its versions went.
      showLive: (live) => {
        publishedYear.setState(new Date().getFullYear(), true);
        requests.published();
        outcomes.showLive(live);
      },
      // Still for the version being republished, if it's one: its password is typed again there.
      showDestinations: () =>
        opened.setState(
          { open: true, ...(running === undefined ? {} : { version: running }) },
          true,
        ),
    };
    // One publish at a time: another waits for none, it's simply not started.
    let publishing = false;
    // The version the publish under way republishes, if it does.
    let running: VersionToRepublish | undefined;
    const startPublish = (destination: PublishDestination) => {
      if (publishing) return;
      publishing = true;
      const { version } = opened.getState();
      running = version;
      close();
      const run =
        version === undefined
          ? publishTo(flow, destination)
          : republishTo(flow, destination, version);
      void run.finally(() => {
        publishing = false;
        running = undefined;
      });
    };

    function Publish() {
      const { open, version } = useStore(opened);
      const signInOffered = useStore(canSignIn);
      return createElement(PublishDialog, {
        open,
        ...(version === undefined ? {} : { republishing: version.name }),
        publish: api.publish,
        netlify: { ...netlify, canSignIn: signInOffered },
        sessionId: siteSession,
        notify: (message) => toast.error(message),
        onSaved: (destination) => {
          fillWebAddress(session, destination);
        },
        // Site Settings offers Netlify Forms once the site has a Netlify destination (4.2).
        onListed: (destinations) => {
          onNetlify.setState(
            destinations.some(({ kind }) => kind === "netlify"),
            true,
          );
        },
        onPublish: startPublish,
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
      run: () => opened.setState({ open: true }, true),
    });
    const removeRepublish = requests.onRepublish((version) =>
      opened.setState({ open: true, version }, true),
    );
    return () => {
      removeRepublish();
      removeCommand();
      removeOutcomes();
      removeDialog();
    };
  },
};
