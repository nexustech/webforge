import { linkInTurn } from "../../shared/assistant-links.js";
import {
  ASSISTANT_CONSENT_VERSION,
  type AssistantApi,
  type AssistantErrorCode,
  type AssistantEvent,
  type AssistantModel,
  type AssistantStatus,
  type ConversationTurn,
  MONTHLY_LIMIT_DEFAULT_USD,
  type ReplyLink,
  type ReplyStep,
  type ReplyStop,
} from "../../shared/ipc/assistant.js";

/**
 * A stand-in for main's assistant (ADR 0026 §7), for the panel's stories and tests, and for
 * building the panel before 6.9b's loop: it answers each message from a script, as the same
 * events main sends, in the same order.
 */

/** One scripted reply. */
export type FakeReply = {
  /** The reply's text, sent as a few deltas. */
  readonly text?: string;
  /** Each change, as a tool call that made it. */
  readonly steps?: readonly (ReplyStep & { readonly tool?: string })[];
  readonly links?: readonly ReplyLink[];
  /** null: the provider gives no cost, as a local model doesn't. */
  readonly costUsd?: number | null;
  readonly stop?: ReplyStop;
  /** `send` answers this at once, and nothing is sent. */
  readonly refuse?: AssistantErrorCode;
  /** The reply fails part way, after its text and steps. */
  readonly fail?: AssistantErrorCode;
  /** A safety version saved before the first step (S20). */
  readonly safetyVersion?: { readonly versionId: string; readonly label: string };
};

export type FakeAssistantOptions = {
  readonly status?: Partial<AssistantStatus>;
  readonly models?: readonly AssistantModel[];
  /** What each message is answered with. */
  readonly reply?: FakeReply | ((message: string) => FakeReply);
  /** Between events, in milliseconds; 0 sends each on the next tick. */
  readonly delayMs?: number;
  /** Each site's consent: `asked`, `allowed`. */
  readonly siteConsent?: { readonly asked: boolean; readonly allowed: boolean };
};

/** A tested, mid-priced model, as OpenRouter's list would give it. */
export const FAKE_MODEL: AssistantModel = {
  id: "example/model-medium",
  name: "Example Medium",
  maker: "Example AI",
  tested: true,
  zdr: true,
  perReplyUsd: 0.3,
  pricey: false,
};

/** Signed in to OpenRouter, consent given, with {@link FAKE_MODEL} and nothing spent. */
export const FAKE_STATUS: AssistantStatus = {
  enabled: true,
  consentVersion: ASSISTANT_CONSENT_VERSION,
  consentReach: { reach: "openrouter" },
  provider: { kind: "openrouter", signedIn: true },
  reach: "openrouter",
  model: FAKE_MODEL,
  month: { spentUsd: 0, limitUsd: MONTHLY_LIMIT_DEFAULT_USD, warned: false, reached: false },
  reviewBeforeApplying: false,
  allowRetainingModels: false,
};

const DEFAULT_REPLY: FakeReply = {
  text: "I've rewritten the Hero's heading to say you open on Saturdays.",
  steps: [
    {
      entryId: "fake-entry-1",
      label: "AI (Assistant): Edited Hero text",
      target: { pageId: "home", nodeId: "hero" },
      tool: "updateFields",
    },
  ],
  links: [],
  costUsd: 0.12,
  stop: "end",
};

/** Splits `text` into a few deltas at word boundaries, as a stream would. */
const deltasOf = (text: string): string[] => text.match(/\S+\s*/g) ?? [];

/** A fake `AssistantApi` (see the top of this file); `emit` sends any event, for a test. */
export function createFakeAssistant(options: FakeAssistantOptions = {}) {
  let status: AssistantStatus = { ...FAKE_STATUS, ...options.status };
  const listeners = new Set<(event: AssistantEvent) => void>();
  const conversations = new Map<string, ConversationTurn[]>();
  const consent = new Map<string, { asked: boolean; allowed: boolean }>();
  const replying = new Map<string, { session: string; stopped: boolean }>();
  const delayMs = options.delayMs ?? 30;

  const emit = (event: AssistantEvent) => {
    for (const listener of listeners) listener(event);
  };
  /** Changes the status, and says so as main does. */
  const setStatus = (next: AssistantStatus) => {
    status = next;
    emit({ type: "status", status });
    return status;
  };
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  const replyTo = (message: string): FakeReply => {
    const reply = options.reply ?? DEFAULT_REPLY;
    return typeof reply === "function" ? reply(message) : reply;
  };
  const turnOf = (session: string, replyId: string) =>
    conversations.get(session)?.find((turn) => turn.replyId === replyId);

  /** Plays `reply` as main would, and keeps the conversation's turn up to date. */
  const play = async (session: string, replyId: string, reply: FakeReply) => {
    const turn = turnOf(session, replyId);
    const live = replying.get(replyId);
    if (turn === undefined || live === undefined) return;
    const steps: ReplyStep[] = [];
    const finish = (stop: ReplyStop) => {
      replying.delete(replyId);
      const costUsd = reply.costUsd === undefined ? 0.12 : reply.costUsd;
      const spentUsd = status.month.spentUsd + (costUsd ?? 0);
      const reached = spentUsd >= status.month.limitUsd;
      const crossed = reached && !status.month.reached;
      status = { ...status, month: { ...status.month, spentUsd, reached } };
      const month = { spentUsd, limitUsd: status.month.limitUsd };
      Object.assign(turn, { state: "done", stop, costUsd, steps, links: [...(reply.links ?? [])] });
      emit({
        session,
        type: "reply-done",
        replyId,
        stop,
        costUsd,
        month,
        steps,
        links: turn.links,
      });
      if (!status.month.warned && spentUsd >= month.limitUsd * 0.8) {
        status = { ...status, month: { ...status.month, warned: true } };
        emit({ type: "limit", level: "warning", month });
      }
      if (crossed) emit({ type: "limit", level: "reached", month });
    };

    emit({ session, type: "reply-started", replyId, model: status.model?.id ?? "" });
    for (const delta of deltasOf(reply.text ?? "")) {
      await pause();
      if (live.stopped) return finish("stopped");
      turn.reply += delta;
      emit({ session, type: "text", replyId, delta });
    }
    for (const [index, { tool = "updateFields", ...step }] of (reply.steps ?? []).entries()) {
      await pause();
      if (live.stopped) return finish("stopped");
      const callId = `call-${index + 1}`;
      if (index === 0 && reply.safetyVersion !== undefined) {
        turn.safetyVersion = { ...reply.safetyVersion };
        emit({ session, type: "safety-version", replyId, ...reply.safetyVersion });
      }
      emit({ session, type: "tool", replyId, callId, tool, state: "running" });
      await pause();
      steps.push(step);
      emit({ session, type: "tool", replyId, callId, tool, state: "done", step });
    }
    await pause();
    if (reply.fail !== undefined) {
      replying.delete(replyId);
      Object.assign(turn, { state: "failed", error: reply.fail, steps });
      return emit({ session, type: "reply-failed", replyId, error: reply.fail, steps });
    }
    finish(live.stopped ? "stopped" : (reply.stop ?? "end"));
  };

  const api: AssistantApi = {
    status: async () => status,
    setEnabled: async (enabled, version) => {
      return setStatus(
        enabled
          ? { ...status, enabled, consentVersion: version, consentReach: { reach: status.reach } }
          : { ...status, enabled, provider: { kind: "openrouter", signedIn: false } },
      );
    },
    update: async (settings) => {
      const limitUsd = settings.monthlyLimitUsd ?? status.month.limitUsd;
      return setStatus({
        ...status,
        month: { ...status.month, limitUsd, reached: status.month.spentUsd >= limitUsd },
        allowRetainingModels: settings.allowRetainingModels ?? status.allowRetainingModels,
      });
    },
    signIn: async () => {
      setStatus({ ...status, provider: { kind: "openrouter", signedIn: true } });
      return { status: "signed-in" };
    },
    finishSignIn: async () => ({ status: "signed-in" }),
    cancelSignIn: async () => undefined,
    setKey: async () => ({ status: "signed-in" }),
    models: async () => ({ status: "ok", models: [...(options.models ?? [FAKE_MODEL])] }),
    siteConsent: async (session) =>
      consent.get(session) ?? options.siteConsent ?? { asked: true, allowed: true },
    setSiteConsent: async (session, allowed) => {
      consent.set(session, { asked: true, allowed });
    },
    send: async (session, text) => {
      const reply = replyTo(text);
      if (reply.refuse !== undefined) return { status: reply.refuse };
      if ([...replying.values()].some((each) => each.session === session)) {
        return { status: "busy" };
      }
      const replyId = crypto.randomUUID();
      const turns = conversations.get(session) ?? [];
      turns.push({
        replyId,
        message: text,
        reply: "",
        state: "replying",
        costUsd: null,
        steps: [],
        links: [],
      });
      conversations.set(session, turns);
      replying.set(replyId, { session, stopped: false });
      void play(session, replyId, reply);
      return { status: "sending", replyId };
    },
    stop: async (replyId) => {
      const live = replying.get(replyId);
      if (live !== undefined) live.stopped = true;
    },
    newConversation: async (session) => {
      conversations.delete(session);
    },
    conversation: async (session) => structuredClone(conversations.get(session) ?? []),
    openLink: async (session, replyId, href) => {
      const turn = turnOf(session, replyId);
      return { status: turn !== undefined && linkInTurn(turn, href) ? "opened" : "refused" };
    },
    onEvent: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return { ...api, emit };
}
