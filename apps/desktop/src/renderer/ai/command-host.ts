import type { CommandApi, CommandHost } from "@webforge/commands";
import type { AiRequest, AiResponse } from "../../shared/ipc/ai.js";
import { type EditorSession, textSessionOpen } from "../editor/editor-session.js";
import type { SiteWideAction, SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { PreferencesStore } from "../shell/preferences-store.js";

/**
 * What AI apps' commands run against in this window (4.8): the open site's session, whose steps
 * the editor shows as its own (a removal offers Undo in a toast, D4); Design or Content mode; the
 * window's site-wide question (D7), which an AI app's change to more than one page asks; and
 * whether the site has been published, so a page an AI app renames keeps its old address (#925).
 */
export function commandHost(
  session: Pick<EditorSession, "history" | "edit" | "held" | "ui">,
  preferences: Pick<PreferencesStore, "getState">,
  siteWide: Pick<
    SiteWideConfirm,
    "confirmSiteWide" | "current" | "busy" | "answer" | "beforeUnaskedChange"
  >,
  published: () => boolean = () => false,
): CommandHost {
  return {
    history: session.history,
    run(label, recipe, kind, removesPages) {
      const shown = session.ui.getState();
      if (removesPages?.includes(shown.pageId) !== true) {
        session.edit(kind, label, recipe);
        return;
      }
      // The page shown goes: the Home page is shown instead, and undo shows it again (4.11).
      const home = session.history.document.getState().homePageId;
      session.edit(kind, label, recipe, {
        selectionAfter: { ...shown, pageId: home, nodeId: null },
        apply: true,
      });
    },
    // The person's own question isn't replaced by an AI app's: asking again would cancel it. A
    // dialog changing the site live holds others' changes, so its steps are all its own (3.13a).
    editing: () => textSessionOpen(session.history) || session.held() || siteWide.busy(),
    mode: () => preferences.getState().mode,
    published,
    confirm(confirmation, signal, options) {
      const action: SiteWideAction = {
        ...confirmation,
        ...(options?.offerUnasked === undefined ? {} : { allowAlways: options.offerUnasked }),
      };
      // An app working without asking (5.35, UA-2): no question, but what goes before a change to
      // every page still runs, Version History's version.
      if (options?.unasked === true) return siteWide.beforeUnaskedChange(action).then(() => true);
      const answer = siteWide.confirmSiteWide(action);
      // The asker gave up (an app's cancel, the assistant's Stop): the question closes (5.34).
      signal.addEventListener(
        "abort",
        () => {
          if (siteWide.current() === action) siteWide.answer(false);
        },
        { once: true },
      );
      return answer;
    },
  };
}

/**
 * `request` run by `api`: a query's answer, or a command's, on behalf of the app that asked. Its
 * asker giving up (`signal`) closes a question the command is waiting on, unanswered; `onAsking`
 * hears it ask one, which waits for its answer however long it takes (5.34). A command main says
 * works without asking is made unasked where it may be, and a paired app's question offers to let
 * it, through `letWorkUnasked` (5.35, UA-2).
 */
export function answerRequest(
  api: CommandApi,
  request: AiRequest,
  signal?: AbortSignal,
  onAsking?: () => void,
  letWorkUnasked?: (appId: string) => void,
): Promise<AiResponse> {
  if (request.kind === "query") return Promise.resolve(api.query(request.name, request.input));
  const { appId } = request;
  return api.run(request.name, request.input, {
    app: request.app,
    signal,
    onAsking,
    unasked: request.unasked === true,
    offerUnasked:
      appId === undefined || letWorkUnasked === undefined ? undefined : () => letWorkUnasked(appId),
  });
}
