import { type AiApi, type AiResponse, aiEvents } from "../../shared/ipc/ai.js";
import type { Call, Subscribe } from "./call.js";

/** What a request the renderer failed to answer gets: the app can try again. */
const FAILED: AiResponse = { status: "busy", message: "Webforge couldn't answer: try again." };

/** `window.webforge.ai`. */
export const aiApi = (call: Call, subscribe: Subscribe): AiApi => ({
  onRequest(answer) {
    const stop = subscribe(aiEvents.request.channel, (...args) => {
      const parsed = aiEvents.request.args.safeParse(args);
      if (!parsed.success) return;
      const [id, request] = parsed.data;
      void answer(request)
        .catch(() => FAILED)
        .then((response) => call("aiAnswer", id, response))
        .catch(() => undefined);
    });
    void call("aiListening", true).catch(() => undefined);
    return () => {
      stop();
      void call("aiListening", false).catch(() => undefined);
    };
  },
});
