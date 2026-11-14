import { createCommandApi } from "@webforge/commands";
import { toast } from "@webforge/editor-ui";
import { createElement } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Area, WindowContext } from "../editor/areas.js";
import { textSessionOpen } from "../editor/editor-session.js";
import { addMedia, importItems } from "../media/index.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { siteSession } from "../storage/index.js";
import { createAppTools } from "./app-tools.js";
import { answerRequest, commandHost } from "./command-host.js";
import { MediaRequestDialog } from "./MediaRequestDialog.js";
import { createMediaRequests, type MediaAsk } from "./media-request.js";

/** The question an AI app's `requestMedia` shows, and who waits for its answer. */
type Asking = { readonly asked: MediaAsk; readonly answer: (addFiles: boolean) => void } | null;

/**
 * AI apps' requests (F-AI-1, 4.8): while a site is open in the window, main forwards each tool
 * call here and the command layer answers it, every change one labelled undo step. Run Site Check
 * and Open Preview the window answers itself (4.9, `APP_TOOLS`), and `requestMedia`, which asks the
 * person for pictures or files (4.12b).
 */
export const aiRequestsArea: Area<WindowContext> = {
  id: "aiRequests",
  register: ({
    api,
    session,
    preferences,
    siteWide,
    commands,
    codeTrust,
    siteCheckIgnored,
    windowDialogs,
    onNetlify,
    publishedYear,
  }) => {
    // A page an AI app renames keeps its old address once the site has been published (#925), as
    // the Pages panel's rename does: the same record of the last publish.
    const commandApi = createCommandApi(
      commandHost(session, preferences, siteWide, () => publishedYear.getState() !== undefined),
    );
    const appTools = createAppTools({
      site: () => session.history.document.getState(),
      allowListConfirmed: () => codeTrust.allowListConfirmed.getState(),
      onNetlify: () => onNetlify.getState(),
      ignored: () => siteCheckIgnored.initial,
      openPreview: () => {
        commands.run(COMMAND_IDS.preview);
      },
    });

    // The last question stays shown while the dialog fades out.
    const asking = createStore<{ readonly current: Asking; readonly last: MediaAsk | null }>(
      () => ({
        current: null,
        last: null,
      }),
    );
    const mediaRequests = createMediaRequests({
      ask: (asked, signal) =>
        new Promise<boolean>((resolve) => {
          const answer = (addFiles: boolean) => {
            if (asking.getState().current?.answer !== answer) return;
            asking.setState({ current: null });
            resolve(addFiles);
          };
          asking.setState({ current: { asked, answer }, last: asked });
          // Unanswered for a minute: the question closes, and nothing is added.
          signal.addEventListener("abort", () => answer(false), { once: true });
        }),
      choose: () =>
        importItems(
          () => api.media.choose(siteSession()),
          (message) => toast(message),
        ),
      add: (items) => addMedia(session, items),
      busy: () => textSessionOpen(session.history) || session.held() || siteWide.busy(),
    });
    function MediaRequest() {
      const { current, last } = useStore(asking);
      return createElement(MediaRequestDialog, {
        open: current !== null,
        asked: last,
        onAnswer: (addFiles) => current?.answer(addFiles),
      });
    }
    const removeDialog = windowDialogs.register({ id: "aiMediaRequest", component: MediaRequest });

    // For the opening of the site this page was loaded for (#663).
    const stopAnswering = api.ai.onRequest(siteSession(), async (request, onCancel) => {
      // Main's cancel (the assistant's Stop) closes a question the command waits on.
      const cancel = new AbortController();
      onCancel(() => cancel.abort());
      return (
        appTools(request) ??
        mediaRequests(request) ??
        answerRequest(commandApi, request, cancel.signal)
      );
    });
    return () => {
      stopAnswering();
      removeDialog();
      // A question still open closes with the site: nothing is added.
      asking.getState().current?.answer(false);
    };
  },
};
