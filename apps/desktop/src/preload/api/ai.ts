import { type AiApi, type AiResponse, aiEvents } from "../../shared/ipc/ai.js";
import type { Call, Subscribe } from "./call.js";

/** What a request the renderer failed to answer gets: the app can try again. */
const FAILED: AiResponse = { status: "busy", message: "Webforge couldn't answer: try again." };

/** `window.webforge.ai`. */
export const aiApi = (call: Call, subscribe: Subscribe): AiApi => ({
  onRequest(sessionId, answer) {
    /**
     * The requests being answered, by id, each with what its cancel calls. A function, not an
     * AbortSignal: the context bridge copies an object without its methods, but passes functions.
     */
    const answering = new Map<number, Set<() => void>>();
    const stop = subscribe(aiEvents.request.channel, (...args) => {
      const parsed = aiEvents.request.args.safeParse(args);
      if (!parsed.success) return;
      const [id, request] = parsed.data;
      const cancelled = new Set<() => void>();
      answering.set(id, cancelled);
      void answer(request, (listener) => {
        cancelled.add(listener);
      })
        .catch(() => FAILED)
        .then((response) => call("aiAnswer", id, response))
        .catch(() => undefined)
        .finally(() => answering.delete(id));
    });
    const stopCancels = subscribe(aiEvents.cancel.channel, (...args) => {
      const parsed = aiEvents.cancel.args.safeParse(args);
      if (!parsed.success) return;
      const cancelled = answering.get(parsed.data[0]);
      answering.delete(parsed.data[0]);
      for (const listener of cancelled ?? []) listener();
    });
    void call("aiListening", sessionId, true).catch(() => undefined);
    return () => {
      stop();
      stopCancels();
      void call("aiListening", sessionId, false).catch(() => undefined);
    };
  },
  onBrief(open) {
    return subscribe(aiEvents.brief.channel, (...args) => {
      const parsed = aiEvents.brief.args.safeParse(args);
      if (!parsed.success) return;
      const [id, brief] = parsed.data;
      open(brief, async (outcome) => {
        await call("aiBriefAnswer", id, outcome).catch(() => undefined);
      });
    });
  },
});
