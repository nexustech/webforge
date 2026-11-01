import type { TrustApi } from "../../shared/ipc/trust.js";
import type { Call } from "./call.js";

/** `window.webforge.trust`. */
export const trustApi = (call: Call): TrustApi => ({
  untrusted: (sessionId, texts) => call("untrustedCode", sessionId, [...texts]),
  trust: (sessionId, texts) => call("trustCode", sessionId, [...texts]),
});
