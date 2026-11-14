import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  AssistantApi,
  AssistantErrorCode,
  AssistantEvent,
  AssistantStatus,
  ConversationTurn,
  ReplyLink,
  ReplyStep,
} from "../../shared/ipc/assistant.js";
import { reportFailure } from "../log.js";
import type { TurnView } from "./ConversationView.js";

/** What was selected when a message was sent (ADR 0026 §6). */
type MessageContext = Parameters<AssistantApi["send"]>[2];

/** A turn as the panel shows it: the conversation view's, with what the review card needs. */
type PanelTurn = TurnView & {
  readonly steps: readonly ReplyStep[];
  readonly links: readonly ReplyLink[];
};

/** What the assistant's panel shows for the site open in the window. */
type AssistantPanelState = {
  /** The app's: on or off, provider, model, the month's spend. Unknown until it has loaded. */
  readonly status: AssistantStatus | undefined;
  /** This site's consent (ADR 0026 §4); unknown until it has loaded. */
  readonly site: { readonly asked: boolean; readonly allowed: boolean } | undefined;
  readonly turns: readonly PanelTurn[];
  /** The reply under way, if any: one at a time per site. */
  readonly replying: string | undefined;
  /** Why the last message wasn't sent, until the next one is. */
  readonly refused: AssistantErrorCode | undefined;
  /** The version saved before this conversation's first change (S20), for the review card. */
  readonly safetyVersionId: string | undefined;
};

/** A reply the conversation keeps, as the panel shows it: its steps are its tool calls that changed something. */
function panelTurn(turn: ConversationTurn): PanelTurn {
  return {
    ...turn,
    tools: turn.steps.map((step) => ({ callId: step.entryId, state: "done" as const, step })),
  };
}

/** The panel's state, and what changes it. */
export type AssistantPanelModel = {
  readonly state: StoreApi<AssistantPanelState>;
  /**
   * Sends a message with what's selected; nothing while a reply is under way or a message is on
   * its way. Whether main took it: a refused message stays for the person to send again.
   */
  readonly send: (text: string, context: MessageContext) => Promise<boolean>;
  readonly stop: () => Promise<void>;
  readonly newConversation: () => Promise<void>;
  /** This site's yes or no (ADR 0026 §4), kept on this computer by main. */
  readonly answerSite: (allowed: boolean) => Promise<void>;
  /** Stops following main's events. */
  readonly dispose: () => void;
};

/**
 * The assistant's panel's state for one site (6.9c, ADR 0026 §7): the app's status, this site's
 * consent and its conversation, loaded from main and kept up to date from its events. A reply's
 * events count only for this site's session; the app's (`status`, `limit`) count whatever the site.
 */
export function createAssistantPanel(api: AssistantApi, session: string): AssistantPanelModel {
  const state = createStore<AssistantPanelState>(() => ({
    status: undefined,
    site: undefined,
    turns: [],
    replying: undefined,
    refused: undefined,
    safetyVersionId: undefined,
  }));
  /** Logs a call main couldn't answer, without content; the panel stays as it was. */
  const failed = (context: string) => (error: unknown) => {
    reportFailure(context, error);
    return false as const;
  };
  /** What the person sent, until its reply's first event names it. */
  let sending: string | undefined;
  /**
   * Replies loaded while under way: words streamed between main's copy and the panel's may be
   * missing, so each is read again once it ends (#993 review).
   */
  const loadedMidStream = new Set<string>();
  /** Takes a reply's whole text from main's copy of the conversation. */
  const reread = (replyId: string) => {
    if (!loadedMidStream.delete(replyId)) return;
    void api
      .conversation(session)
      .then((turns) => {
        const kept = turns.find((each) => each.replyId === replyId);
        if (kept !== undefined) turn(replyId, (each) => ({ ...each, reply: kept.reply }));
      })
      .catch((error: unknown) => reportFailure("assistant.reread", error));
  };
  const turn = (replyId: string, change: (turn: PanelTurn) => PanelTurn) =>
    state.setState(({ turns }) => ({
      turns: turns.map((each) => (each.replyId === replyId ? change(each) : each)),
    }));
  const ensure = (replyId: string, message: string) =>
    state.setState(({ turns }) =>
      turns.some((each) => each.replyId === replyId)
        ? {}
        : {
            replying: replyId,
            turns: [
              ...turns,
              {
                replyId,
                message,
                reply: "",
                state: "replying",
                costUsd: null,
                tools: [],
                steps: [],
                links: [],
              },
            ],
          },
    );
  const onEvent = (event: AssistantEvent) => {
    if (event.type === "status") {
      state.setState({ status: event.status });
      return;
    }
    if (event.type === "limit") {
      state.setState(({ status }) =>
        status === undefined
          ? {}
          : {
              status: {
                ...status,
                month: {
                  ...status.month,
                  ...event.month,
                  warned: true,
                  reached: status.month.reached || event.level === "reached",
                },
              },
            },
      );
      return;
    }
    if (event.session !== session) return;
    switch (event.type) {
      case "reply-started":
        ensure(event.replyId, sending ?? "");
        return;
      case "text":
        turn(event.replyId, (each) => ({ ...each, reply: each.reply + event.delta }));
        return;
      case "tool":
        turn(event.replyId, (each) => {
          const tool = { callId: event.callId, state: event.state, step: event.step };
          const known = each.tools.some((call) => call.callId === event.callId);
          return {
            ...each,
            tools: known
              ? each.tools.map((call) => (call.callId === event.callId ? tool : call))
              : [...each.tools, tool],
          };
        });
        return;
      case "safety-version":
        state.setState({ safetyVersionId: event.versionId });
        return;
      case "reply-done":
        turn(event.replyId, (each) => ({
          ...each,
          state: "done",
          stop: event.stop,
          costUsd: event.costUsd,
          steps: event.steps,
          links: event.links,
        }));
        reread(event.replyId);
        state.setState(({ status, replying }) => ({
          replying: replying === event.replyId ? undefined : replying,
          ...(status === undefined
            ? {}
            : { status: { ...status, month: { ...status.month, ...event.month } } }),
        }));
        return;
      case "reply-failed":
        turn(event.replyId, (each) => ({
          ...each,
          state: "failed",
          error: event.error,
          steps: event.steps,
        }));
        reread(event.replyId);
        state.setState(({ replying }) => ({
          replying: replying === event.replyId ? undefined : replying,
        }));
        return;
    }
  };
  const unsubscribe = api.onEvent(onEvent);
  void Promise.all([api.status(), api.siteConsent(session), api.conversation(session)])
    .then(([status, site, turns]) => {
      for (const each of turns) if (each.state === "replying") loadedMidStream.add(each.replyId);
      state.setState((now) => ({
        status: now.status ?? status,
        site: now.site ?? site,
        // Events that came meanwhile are newer than what was loaded.
        turns: now.turns.length > 0 ? now.turns : turns.map(panelTurn),
        replying: turns.find((each) => each.state === "replying")?.replyId ?? now.replying,
      }));
    })
    // Loading failed: the panel stays on Loading…, and the failure is logged without content.
    .catch((error: unknown) => reportFailure("assistant.load", error));
  return {
    state,
    send: async (text, context) => {
      if (state.getState().replying !== undefined || sending !== undefined || text.trim() === "") {
        return false;
      }
      sending = text;
      state.setState({ refused: undefined });
      try {
        const result = await api.send(session, text, context);
        if (result.status === "sending") {
          ensure(result.replyId, text);
          return true;
        }
        state.setState({ refused: result.status });
        return false;
      } catch (error) {
        // Main couldn't take it: said as any failure, logged without content.
        reportFailure("assistant.send", error);
        state.setState({ refused: "failed" });
        return false;
      } finally {
        sending = undefined;
      }
    },
    stop: async () => {
      const replyId = state.getState().replying;
      if (replyId !== undefined) await api.stop(replyId).catch(failed("assistant.stop"));
    },
    newConversation: async () => {
      if ((await api.newConversation(session).then(() => true, failed("assistant.new"))) !== true) {
        return;
      }
      state.setState({
        turns: [],
        replying: undefined,
        refused: undefined,
        safetyVersionId: undefined,
      });
    },
    answerSite: async (allowed) => {
      // Recorded only once main has it: a yes the panel shows is one main keeps.
      if (
        (await api.setSiteConsent(session, allowed).then(() => true, failed("assistant.site"))) !==
        true
      ) {
        return;
      }
      state.setState({ site: { asked: true, allowed }, refused: undefined });
    },
    dispose: unsubscribe,
  };
}
