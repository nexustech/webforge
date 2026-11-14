import { useEffect, useEffectEvent, useRef, useState } from "react";
import type {
  AssistantApi,
  AssistantErrorCode,
  AssistantStatus,
  DraftRequest,
  DraftResult,
} from "../../shared/ipc/assistant.js";
import { reportFailure } from "../log.js";
import { type AwayReach, reachOf } from "./Consent.js";

/** Where a draft of the writing help (#873) has got to, as its dialog shows it. */
export type DraftState =
  /** This site hasn't been asked yet (ADR 0026 §4): its question first. */
  | { readonly step: "site"; readonly site: string; readonly reach: AwayReach }
  /** The person said no to this site. */
  | { readonly step: "denied" }
  | { readonly step: "writing" }
  /** The draft: one text, or a business draft's one per text asked. */
  | { readonly step: "draft"; readonly texts: readonly string[] }
  /** More text than a draft takes. */
  | { readonly step: "too-long" }
  | { readonly step: "failed"; readonly error: AssistantErrorCode };

/** The calls a draft needs from the assistant's domain. */
export type DraftApi = Pick<
  AssistantApi,
  "status" | "onEvent" | "siteConsent" | "setSiteConsent" | "draft"
>;

/** The assistant's status as main says it, kept up to date; null until it has come. */
export function useAssistantStatus(api: Pick<AssistantApi, "status" | "onEvent">) {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  useEffect(() => {
    let live = true;
    // Started in the chain, so a stand-in whose call isn't a promise can't throw here.
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
  return status;
}

/** `request`'s draft from main, or `failed` if the call itself failed. */
async function draftOrFailure(
  api: Pick<AssistantApi, "draft">,
  sessionId: string,
  request: DraftRequest,
): Promise<DraftResult> {
  try {
    return await api.draft(sessionId, request);
  } catch (error) {
    reportFailure("assistant draft", error);
    return { status: "failed" };
  }
}

/** What a draft's answer shows: its texts, or why there are none. */
function stateOf(result: DraftResult): DraftState {
  return result.status === "ok"
    ? { step: "draft", texts: result.texts }
    : { step: "failed", error: result.status };
}

/**
 * One draft at a time of the writing help (#873), for its dialogs: `ask` starts one, asking this
 * site's question first unless the model is on this computer (ADR 0026 §4); `again` asks once
 * more; `answerSite` keeps the person's answer to the site's question. An answer for a draft that
 * has since been asked again, or closed, is dropped.
 */
export function useDraft(
  api: DraftApi,
  sessionId: string,
  siteName: string,
  status: AssistantStatus | null,
) {
  const [state, setState] = useState<DraftState>({ step: "writing" });
  // The draft asked for now, by its turn: an answer for an earlier one is dropped.
  const asking = useRef<{ readonly turn: number; readonly request: DraftRequest } | null>(null);
  const turns = useRef(0);

  const write = async (request: DraftRequest) => {
    const turn = turns.current;
    setState({ step: "writing" });
    const next = stateOf(await draftOrFailure(api, sessionId, request));
    if (asking.current?.turn === turn) setState(next);
  };

  const ask = useEffectEvent(async (request: DraftRequest, tooLong = false) => {
    turns.current += 1;
    const turn = turns.current;
    asking.current = { turn, request };
    if (tooLong) {
      setState({ step: "too-long" });
      return;
    }
    const away = status === null ? null : reachOf(status);
    if (away === null || away.kind === "this-computer") return write(request);
    setState({ step: "writing" });
    const consent = await api.siteConsent(sessionId).catch((error: unknown) => {
      reportFailure("assistant site consent", error);
      return { asked: false, allowed: false };
    });
    if (asking.current?.turn !== turn) return;
    if (!consent.asked) setState({ step: "site", site: siteName, reach: away });
    else if (!consent.allowed) setState({ step: "denied" });
    else await write(request);
  });

  const again = () => {
    const current = asking.current;
    if (current !== null) void write(current.request);
  };

  const answerSite = (allowed: boolean) => {
    const current = asking.current;
    void api.setSiteConsent(sessionId, allowed).then(
      () => {
        if (current === null || asking.current !== current) return;
        if (allowed) void write(current.request);
        else setState({ step: "denied" });
      },
      (error: unknown) => {
        reportFailure("assistant site consent", error);
        setState({ step: "failed", error: "failed" });
      },
    );
  };

  /** Drops the draft asked for: its answer, when it comes, is let go. */
  const close = () => {
    asking.current = null;
  };

  return { state, ask, again, answerSite, close };
}
