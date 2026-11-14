import { type AssistantApi, assistantEvents } from "../../shared/ipc/assistant.js";
import type { Call, Subscribe } from "./call.js";

/** `window.webforge.assistant` (ADR 0026 §7). */
export const assistantApi = (call: Call, subscribe: Subscribe): AssistantApi => ({
  status: () => call("assistantStatus"),
  setEnabled: (enabled, version) => call("assistantSetEnabled", enabled, version),
  update: (settings) => call("assistantUpdate", settings),
  signIn: (mode) => call("assistantSignIn", mode),
  finishSignIn: (code) => call("assistantFinishSignIn", code),
  cancelSignIn: async () => {
    await call("assistantCancelSignIn");
  },
  setKey: (key) => call("assistantSetKey", key),
  models: () => call("assistantModels"),
  siteConsent: (session) => call("assistantSiteConsent", session),
  setSiteConsent: async (session, allowed) => {
    await call("assistantSetSiteConsent", session, allowed);
  },
  send: (session, text, context) => call("assistantSend", session, text, context),
  draft: (session, request) => call("assistantDraft", session, request),
  stop: async (replyId) => {
    await call("assistantStop", replyId);
  },
  newConversation: async (session) => {
    await call("assistantNewConversation", session);
  },
  conversation: (session) => call("assistantConversation", session),
  applyHeld: (session, replyId) => call("assistantApplyHeld", session, replyId),
  discardHeld: async (session, replyId) => {
    await call("assistantDiscardHeld", session, replyId);
  },
  openLink: (session, replyId, href) => call("assistantOpenLink", session, replyId, href),
  onEvent: (listener) =>
    subscribe(assistantEvents.event.channel, (...args) => {
      const parsed = assistantEvents.event.args.safeParse(args);
      if (parsed.success) listener(parsed.data[0]);
    }),
});
