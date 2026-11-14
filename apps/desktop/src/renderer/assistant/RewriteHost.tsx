import type { CanvasEngine, RewriteAnswer, RewriteRequest } from "@webforge/engine";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { DRAFT_TEXT_MAX } from "../../shared/ipc/assistant.js";
import { type EditorSession, textSessionKey } from "../editor/editor-session.js";
import { useDocument } from "../editor/use-document.js";
import { asAssistantStep } from "./assistant-step.js";
import { RewriteDialog, type RewriteState } from "./RewriteDialog.js";
import { type DraftApi, type DraftState, useAssistantStatus, useDraft } from "./use-draft.js";

/** A rewrite the format toolbar asked for, waiting for the person. */
type Asked = {
  readonly request: RewriteRequest;
  readonly answer: (accepted: RewriteAnswer | undefined) => void;
};

/** What the rewrite dialog shows for `state`: a draft's one text, or why there's none. */
function rewriteStateOf(state: DraftState): RewriteState {
  if (state.step !== "draft") return state;
  const [text] = state.texts;
  return text === undefined ? { step: "failed", error: "provider-error" } : { step: "draft", text };
}

/** Props of {@link RewriteHost}. */
export type RewriteHostProps = {
  readonly session: EditorSession;
  readonly engine: CanvasEngine | null;
  readonly api: DraftApi;
  /** The open site's session in main. */
  readonly sessionId: string;
};

/**
 * Rewrites text selected on the canvas with the assistant (G25a, #873): gives the format toolbar
 * its Rewrite menu while the assistant is on, asks main for a draft, and shows it for review. What
 * the person uses replaces the selection as one undo step of its own, labelled as the assistant's.
 */
export function RewriteHost({ session, engine, api, sessionId }: RewriteHostProps) {
  const status = useAssistantStatus(api);
  const siteName = useDocument(session, (site) => site.settings.general.name);
  const draft = useDraft(api, sessionId, siteName, status);
  const [asked, setAsked] = useState<Asked | null>(null);
  // The rewrite open now: answering one that's gone does nothing.
  const current = useRef<Asked | null>(null);
  // Read as each rewrite starts and ends: the menu is set again only as the engine or `on` change.
  const ask = useEffectEvent((request: RewriteRequest) => {
    const { how, text } = request;
    void draft.ask({ kind: "rewrite", how, text }, text.length > DRAFT_TEXT_MAX);
  });
  const close = useEffectEvent(() => draft.close());

  // The Rewrite menu is there while the assistant is on: its consent given for where it sends.
  const on = status?.enabled === true;
  useEffect(() => {
    if (engine === null || !on) return;
    engine.setTextRewriter(
      (request) =>
        new Promise((resolve) => {
          // A new rewrite answers one still open: it leaves its text as it is.
          current.current?.answer(undefined);
          const asking: Asked = {
            request,
            answer: (accepted) => {
              if (current.current === asking) {
                current.current = null;
                setAsked(null);
                close();
              }
              resolve(accepted);
            },
          };
          current.current = asking;
          setAsked(asking);
          ask(request);
        }),
    );
    return () => {
      engine.setTextRewriter(null);
      current.current?.answer(undefined);
    };
  }, [engine, on]);
  if (asked === null) return null;
  const { request } = asked;
  return (
    <RewriteDialog
      open
      how={request.how}
      original={request.text}
      formatted={request.formatted}
      state={rewriteStateOf(draft.state)}
      onSiteAnswer={draft.answerSite}
      onAgain={draft.again}
      onUse={(text) => {
        if (text === request.text) {
          asked.answer(undefined);
          return;
        }
        const { history, ui } = session;
        asked.answer({
          text,
          // Only once the text is sure to go in: a rewrite that doesn't leaves the next change
          // alone (#1049's review).
          applying: () => {
            // What was typed before is a step of its own; the rewrite, the next one.
            if (request.at !== null) {
              history.endSession(
                textSessionKey(ui.getState().pageId, request.at.nodeId, request.at.field),
              );
            }
            asAssistantStep(history);
          },
        });
      }}
      onCancel={() => asked.answer(undefined)}
    />
  );
}
