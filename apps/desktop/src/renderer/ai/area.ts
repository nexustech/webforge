import { createCommandApi } from "@webforge/commands";
import { toast } from "@webforge/editor-ui";
import { createElement } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Area, WindowContext } from "../editor/areas.js";
import { textSessionOpen } from "../editor/editor-session.js";
import {
  OnNetlify,
  PublishedYear,
  SiteCheckIgnored,
  TrustedCode,
} from "../editor/window-services.js";
import { addMedia, importItems } from "../media/index.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { siteSession } from "../storage/index.js";
import { createAppTools, openPreviewFor } from "./app-tools.js";
import { answerRequest, commandHost } from "./command-host.js";
import { MediaRequestDialog } from "./MediaRequestDialog.js";
import { createMediaRequests, type MediaAsk } from "./media-request.js";
import { createStages } from "./stages.js";
import { answerWindowTool, type WindowToolHandlers } from "./window-tools.js";

/** The question an AI app's `requestMedia` shows, and who waits for its answer. */
type Asking = { readonly asked: MediaAsk; readonly answer: (addFiles: boolean) => void } | null;

/**
 * AI apps' requests (F-AI-1, 4.8): while a site is open in the window, main forwards each tool
 * call here and the command layer answers it, every change one labelled undo step. Run Site Check
 * and Open Preview the window answers itself (4.9, `WINDOW_TOOLS`), and `requestMedia`, which asks
 * the person for pictures or files (4.12b), with `mediaStatus` for one still being answered.
 */
export const aiRequestsArea: Area<WindowContext> = {
  id: "aiRequests",
  uses: [PublishedYear, OnNetlify, TrustedCode, SiteCheckIgnored],
  register: ({ api, session, preferences, siteWide, commands, windowDialogs, use }) => {
    const publishedYear = use(PublishedYear);
    const onNetlify = use(OnNetlify);
    const codeTrust = use(TrustedCode);
    const siteCheckIgnored = use(SiteCheckIgnored);
    // A page an AI app renames keeps its old address once the site has been published (#925), as
    // the Pages panel's rename does: the same record of the last publish.
    const host = commandHost(
      session,
      preferences,
      siteWide,
      () => publishedYear.getState() !== undefined,
    );
    const commandApi = createCommandApi(host);
    // The assistant's held changes (6.9e): a draft of the site, never the site itself.
    const stages = createStages(host);
    const appTools = createAppTools({
      site: () => session.history.document.getState(),
      allowListConfirmed: () => codeTrust.allowListConfirmed.getState(),
      onNetlify: () => onNetlify.getState(),
      ignored: () => siteCheckIgnored.initial,
      // Asked for before the command runs, so the open it starts is the one told (#1255).
      openPreview: () =>
        openPreviewFor({
          next: () => api.preview.nextOpened(siteSession()),
          run: () => commands.run(COMMAND_IDS.preview),
          cancel: () => api.preview.cancelNext(siteSession()),
        }),
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
    const windowTools: WindowToolHandlers = {
      ...appTools,
      requestMedia: mediaRequests.requestMedia,
      mediaStatus: mediaRequests.mediaStatus,
    };

    // For the opening of the site this page was loaded for (#663).
    const stopAnswering = api.ai.onRequest(siteSession(), async (request, onCancel) => {
      // Main's cancel (the assistant's Stop) closes a question the command waits on.
      const cancel = new AbortController();
      onCancel(() => cancel.abort());
      // The window's own tools by their definitions (#981): Site Check reads the site itself;
      // the rest of a held reply reads and changes its draft.
      const own = answerWindowTool(windowTools, request);
      if (own !== undefined) return own;
      if (request.stage !== undefined) return stages.answer({ ...request, stage: request.stage });
      return answerRequest(commandApi, request, cancel.signal);
    });
    return () => {
      stopAnswering();
      removeDialog();
      // A question still open closes with the site: nothing is added.
      asking.getState().current?.answer(false);
      mediaRequests.close();
    };
  },
};
