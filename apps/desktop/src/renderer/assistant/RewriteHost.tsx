import type { CanvasEngine, RewriteRequest } from "@webforge/engine";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  type AssistantApi,
  type AssistantStatus,
  DRAFT_TEXT_MAX,
} from "../../shared/ipc/assistant.js";
import { type EditorSession, textSessionKey } from "../editor/editor-session.js";
import { useDocument } from "../editor/use-document.js";
import { reportFailure } from "../log.js";
import { asAssistantStep } from "./assistant-step.js";
import { reachOf } from "./Consent.js";
import { RewriteDialog, type RewriteState } from "./RewriteDialog.js";

/** A rewrite the format toolbar asked for, waiting for the person. */
type Asked = {
  readonly request: RewriteRequest;
  readonly answer: (text: string | undefined) => void;
};

/** Props of {@link RewriteHost}. */
export type RewriteHostProps = {
  readonly session: EditorSession;
  readonly engine: CanvasEngine | null;
  readonly api: Pick<
    AssistantApi,
    "status" | "onEvent" | "siteConsent" | "setSiteConsent" | "draft"
  >;
  /** The open site's session in main. */
  readonly sessionId: string;
};

/**
 * Rewrites text selected on the canvas with the assistant (G25a, #873): gives the format toolbar
 * its Rewrite menu while the assistant is on, asks main for a draft, and shows it for review. What
 * the person uses replaces the selection as one undo step of its own, labelled as the assistant's.
 */
export function RewriteHost({ session, engine, api, sessionId }: RewriteHostProps) {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [asked, setAsked] = useState<Asked | null>(null);
  const [state, setState] = useState<RewriteState>({ step: "writing" });
  const siteName = useDocument(session, (site) => site.settings.general.name);
  // The rewrite open now: an answer for one that's gone is dropped.
  const current = useRef<Asked | null>(null);

  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(() => api.status())
      .then(
        (next) => {
          if (live) setStatus(next);
        },
        (error: unknown) => reportFailure("assistant status", error),
      );
    const stop = api.onEvent((event) => {
      if (event.type === "status") setStatus(event.status);
    });
    return () => {
      live = false;
      stop();
    };
  }, [api]);

  /** Asks main for a draft of `asking`'s text, and shows it if that rewrite is still open. */
  const write = async (asking: Asked) => {
    const { how, text } = asking.request;
    if (text.length > DRAFT_TEXT_MAX) {
      setState({ step: "too-long" });
      return;
    }
    setState({ step: "writing" });
    let next: RewriteState;
    try {
      const result = await api.draft(sessionId, { kind: "rewrite", how, text });
      const [draft] = result.status === "ok" ? result.texts : [];
      next =
        result.status !== "ok"
          ? { step: "failed", error: result.status }
          : draft === undefined
            ? { step: "failed", error: "provider-error" }
            : { step: "draft", text: draft };
    } catch (error) {
      reportFailure("assistant draft", error);
      next = { step: "failed", error: "failed" };
    }
    if (current.current === asking) setState(next);
  };

  /**
   * Starts `asking`: this site's question first if it hasn't been asked, unless the model is on
   * this computer, then the draft. Reads the status and the site's name as they are now.
   */
  const start = useEffectEvent(async (asking: Asked) => {
    const away = status === null ? null : reachOf(status);
    if (away === null || away.kind === "this-computer") return write(asking);
    const consent = await api.siteConsent(sessionId).catch((error: unknown) => {
      reportFailure("assistant site consent", error);
      return { asked: false, allowed: false };
    });
    if (current.current !== asking) return;
    if (!consent.asked) setState({ step: "site", site: siteName, reach: away });
    else if (!consent.allowed) setState({ step: "denied" });
    else await write(asking);
  });

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
            answer: (text) => {
              if (current.current === asking) {
                current.current = null;
                setAsked(null);
              }
              resolve(text);
            },
          };
          current.current = asking;
          setAsked(asking);
          setState({ step: "writing" });
          void start(asking);
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
      state={state}
      onSiteAnswer={(allowed) => {
        void api.setSiteConsent(sessionId, allowed).then(
          () => (allowed ? write(asked) : setState({ step: "denied" })),
          (error: unknown) => {
            reportFailure("assistant site consent", error);
            setState({ step: "failed", error: "failed" });
          },
        );
      }}
      onAgain={() => void write(asked)}
      onUse={(text) => {
        if (text === request.text) {
          asked.answer(undefined);
          return;
        }
        const { history, ui } = session;
        // What was typed before is a step of its own; the rewrite, the next one.
        if (request.at !== null) {
          history.endSession(
            textSessionKey(ui.getState().pageId, request.at.nodeId, request.at.field),
          );
        }
        asAssistantStep(history);
        asked.answer(text);
      }}
      onCancel={() => asked.answer(undefined)}
    />
  );
}
