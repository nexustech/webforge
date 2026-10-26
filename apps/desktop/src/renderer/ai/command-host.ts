import type { CommandApi, CommandHost } from "@webforge/commands";
import type { AiRequest, AiResponse } from "../../shared/ipc/ai.js";
import { type EditorSession, textSessionOpen } from "../editor/editor-session.js";
import type { SiteWideAction, SiteWideConfirm } from "../shell/confirm-site-wide.js";
import type { PreferencesStore } from "../shell/preferences-store.js";

/**
 * What AI apps' commands run against in this window (4.8): the open site's session, whose steps
 * the editor shows as its own (a removal offers Undo in a toast, D4); Design or Content mode; and
 * the window's site-wide question (D7), which an AI app's change to more than one page asks.
 */
export function commandHost(
  session: Pick<EditorSession, "history" | "edit">,
  preferences: Pick<PreferencesStore, "getState">,
  siteWide: Pick<SiteWideConfirm, "confirmSiteWide" | "current" | "answer">,
): CommandHost {
  return {
    history: session.history,
    run: (label, recipe, kind) => session.edit(kind, label, recipe),
    // The person's own question isn't replaced by an AI app's: asking again would cancel it.
    editing: () => textSessionOpen(session.history) || siteWide.current() !== null,
    mode: () => preferences.getState().mode,
    confirm(confirmation, signal) {
      const action: SiteWideAction = { ...confirmation };
      const answer = siteWide.confirmSiteWide(action);
      // Unanswered for a minute: the question closes, and the change is declined.
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

/** `request` run by `api`: a query's answer, or a command's, on behalf of the app that asked. */
export function answerRequest(api: CommandApi, request: AiRequest): Promise<AiResponse> {
  return request.kind === "query"
    ? Promise.resolve(api.query(request.name, request.input))
    : api.run(request.name, request.input, { app: request.app });
}
