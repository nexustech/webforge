import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  AssistantApi,
  AssistantErrorCode,
  AssistantEvent,
  AssistantStatus,
  ConversationTurn,
  HeldChange,
  ReplyLink,
  ReplyStep,
} from "../../shared/ipc/assistant.js";
import { reportFailure } from "../log.js";
import type { TurnView } from "./ConversationView.js";
import type { HeldOutcome } from "./HeldCard.js";

/** What was selected when a message was sent (ADR 0026 §6). */
type MessageContext = Parameters<AssistantApi["send"]>[2];

/** A turn as the panel shows it: the conversation view's, with what the review card needs. */
type PanelTurn = TurnView & {
  readonly steps: readonly ReplyStep[];
  readonly links: readonly ReplyLink[];
  /** The changes it holds for the person to apply (6.9e, _Review before applying_). */
  readonly held: readonly HeldChange[];
  /** Why it holds none any more, if they were dropped rather than applied. */
  readonly heldOutcome?: HeldOutcome | undefined;
  /** Held changes it couldn't make when they were applied, as the site had changed. */
  readonly refused?: readonly HeldChange[] | undefined;
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
  /** The reply whose held changes are being applied (6.9e). */
  readonly applying: string | undefined;
  /**
   * A message sent while a reply was under way (5.19, OL-4): held, and sent by itself when the
   * reply finishes, with what was selected when it was written.
   */
  readonly waiting:
    | {
        readonly text: string;
        readonly context: MessageContext;
        /**
         * The reply finished holding changes for the person to review (6.9e): the message waits
         * until they're applied or discarded, as sending it would drop them unseen.
         */
        readonly afterChanges?: true;
      }
    | undefined;
  /**
   * A held message given back to the box, unsent: the reply failed or was stopped, or the person
   * chose to edit it. The panel puts it in the box, then takes it ({@link AssistantPanelModel.taken}).
   */
  readonly returned: string | undefined;
  /**
   * An example request to try (5.21, OL-8), from *Things You Can Ask*: the panel puts it in the
   * box, unsent, and focuses the box, then takes it ({@link AssistantPanelModel.tryTaken}).
   */
  readonly tried: string | undefined;
};

/** A reply the conversation keeps, as the panel shows it: its steps are its tool calls that changed something. */
function panelTurn(turn: ConversationTurn): PanelTurn {
  return {
    ...turn,
    held: turn.held ?? [],
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
  /**
   * Holds a message sent while a reply is under way (5.19, OL-4), to send when it finishes; one
   * sent while another is held is added to it, so nothing typed is lost.
   */
  readonly hold: (text: string, context: MessageContext) => void;
  /** Gives the held message back to the box to edit (`returned`), unsent. */
  readonly editWaiting: () => void;
  /** Drops the held message, unsent. */
  readonly removeWaiting: () => void;
  /** The panel has put `returned` in the box. */
  readonly taken: () => void;
  /** Puts an example request in the box to try (`tried`), unsent (5.21). */
  readonly tryExample: (text: string) => void;
  /** The panel has put `tried` in the box. */
  readonly tryTaken: () => void;
  readonly newConversation: () => Promise<void>;
  /** This site's yes or no (ADR 0026 §4), kept on this computer by main. */
  readonly answerSite: (allowed: boolean) => Promise<void>;
  /**
   * Asks main to open a link from a reply in the browser: `href` as the reply wrote it. Main opens
   * only a web address its copy of that reply holds; a call it couldn't answer is *failed*.
   */
  readonly openLink: (replyId: string, href: string) => Promise<"opened" | "refused" | "failed">;
  /** Applies reply `replyId`'s held changes (6.9e): each then an undo step, as if made at once. */
  readonly applyHeld: (replyId: string) => Promise<void>;
  /** Discards reply `replyId`'s held changes (6.9e): the site stays as it is. */
  readonly discardHeld: (replyId: string) => Promise<void>;
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
    applying: undefined,
    waiting: undefined,
    returned: undefined,
    tried: undefined,
  }));
  /** The replies whose held changes the person discarded: others' were dropped for a newer one. */
  const discarding = new Set<string>();
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
                held: [],
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
          held: event.held ?? [],
        }));
        reread(event.replyId);
        state.setState(({ status, replying }) => ({
          replying: replying === event.replyId ? undefined : replying,
          ...(status === undefined
            ? {}
            : { status: { ...status, month: { ...status.month, ...event.month } } }),
        }));
        if ((event.held ?? []).length > 0) {
          // Holding changes to review (6.9e): a new message would replace them, unseen, so the
          // waiting one goes once they're applied or discarded.
          state.setState(({ waiting }) =>
            waiting === undefined ? {} : { waiting: { ...waiting, afterChanges: true } },
          );
        } else {
          // Stopped, or out of the month's budget: not finished, so its held message isn't sent.
          releaseWaiting(event.stop !== "stopped" && event.stop !== "limit-reached");
        }
        return;
      case "held":
        turn(event.replyId, (each) =>
          // Nothing held to drop: a panel opened again after main dropped them itself (#1063).
          event.state === "discarded" && each.held.length === 0
            ? each
            : {
                ...each,
                held: [],
                steps: [...each.steps, ...event.steps],
                ...(event.state === "applied"
                  ? { refused: event.refused }
                  : { heldOutcome: discarding.delete(event.replyId) ? "discarded" : "replaced" }),
              },
        );
        state.setState(({ applying }) => ({
          applying: applying === event.replyId ? undefined : applying,
        }));
        // The changes it waited on have been applied or discarded: now it goes.
        if (state.getState().waiting?.afterChanges === true) releaseWaiting(true);
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
        releaseWaiting(false);
        return;
    }
  };
  /**
   * Sends a message with what's selected; nothing while a reply is under way or a message is on
   * its way. Whether main took it: a refused message stays for the person to send again.
   */
  const send = async (text: string, context: MessageContext): Promise<boolean> => {
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
  };
  /**
   * A reply ended (5.19, OL-4): the held message is sent if it finished, or given back to the box,
   * unsent, if it failed or was stopped, or if main didn't take it.
   */
  const releaseWaiting = (finished: boolean) => {
    const { waiting } = state.getState();
    if (waiting === undefined) return;
    state.setState({ waiting: undefined });
    const giveBack = () =>
      state.setState(({ returned }) => ({
        returned: returned === undefined ? waiting.text : `${waiting.text}\n\n${returned}`,
      }));
    if (!finished) {
      giveBack();
      return;
    }
    void send(waiting.text, waiting.context).then((taken) => {
      if (!taken) giveBack();
    });
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
        // The safety version a reply saved before this conversation's first change (S20).
        safetyVersionId:
          now.safetyVersionId ?? turns.find((each) => each.safetyVersion)?.safetyVersion?.versionId,
      }));
    })
    // Loading failed: the panel stays on Loading…, and the failure is logged without content.
    .catch((error: unknown) => reportFailure("assistant.load", error));
  return {
    state,
    send,
    hold: (text, context) => {
      if (text.trim() === "") return;
      state.setState(({ waiting }) => ({
        waiting: {
          text: waiting === undefined ? text : `${waiting.text}\n\n${text}`,
          context,
          ...(waiting?.afterChanges === true ? { afterChanges: true as const } : {}),
        },
      }));
    },
    editWaiting: () => releaseWaiting(false),
    removeWaiting: () => state.setState({ waiting: undefined }),
    taken: () => state.setState({ returned: undefined }),
    tryExample: (text) => state.setState({ tried: text }),
    tryTaken: () => state.setState({ tried: undefined }),
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
    openLink: async (replyId, href) => {
      try {
        return (await api.openLink(session, replyId, href)).status;
      } catch (error) {
        reportFailure("assistant.link", error);
        return "failed";
      }
    },
    applyHeld: async (replyId) => {
      if (state.getState().applying !== undefined) return;
      state.setState({ applying: replyId });
      try {
        const result = await api.applyHeld(session, replyId);
        // Applied, the `held` event settles the card. Gone from main (the site was opened again
        // since), it's settled here, so Apply isn't left doing nothing (#1063's review).
        if (result.status === "nothing-held") {
          turn(replyId, (each) => ({ ...each, held: [], heldOutcome: "unavailable" }));
        }
        if (result.status !== "applied") state.setState({ applying: undefined });
      } catch (error) {
        reportFailure("assistant.apply", error);
        state.setState({ applying: undefined });
      }
    },
    discardHeld: async (replyId) => {
      discarding.add(replyId);
      await api.discardHeld(session, replyId).catch((error: unknown) => {
        discarding.delete(replyId);
        reportFailure("assistant.discard", error);
      });
    },
    dispose: unsubscribe,
  };
}
