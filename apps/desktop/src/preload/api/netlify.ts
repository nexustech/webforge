import type { NetlifyApi } from "../../shared/ipc/netlify.js";
import type { Call } from "./call.js";

/** `window.webforge.netlify`. */
export const netlifyApi = (call: Call): NetlifyApi => ({
  status: () => call("netlifyStatus"),
  signIn: (operationId) => call("netlifySignIn", operationId),
  cancelSignIn: (operationId) => call("netlifyCancelSignIn", operationId),
  signInWithToken: (token) => call("netlifySignInWithToken", token),
  sites: (handle) => call("netlifySites", handle),
  createSite: (handle, name) =>
    name === undefined
      ? call("netlifyCreateSite", handle)
      : call("netlifyCreateSite", handle, name),
  saveDestination: (sessionId, draft, signIn) =>
    call("netlifySaveDestination", sessionId, draft, signIn),
});
