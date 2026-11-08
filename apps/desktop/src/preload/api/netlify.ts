import type { NetlifyApi } from "../../shared/ipc/netlify.js";
import type { Call } from "./call.js";

/** `window.webforge.netlify`. */
export const netlifyApi = (call: Call): NetlifyApi => ({
  status: () => call("netlifyStatus"),
  signIn: (operationId) => call("netlifySignIn", operationId),
  cancelSignIn: (operationId) => call("netlifyCancelSignIn", operationId),
  forgetSignIn: (handle) => call("netlifyForgetSignIn", handle),
  signInWithToken: (token) => call("netlifySignInWithToken", token),
  sites: (sessionId, account) => call("netlifySites", sessionId, account),
  createSite: (sessionId, account, name) =>
    name === undefined
      ? call("netlifyCreateSite", sessionId, account)
      : call("netlifyCreateSite", sessionId, account, name),
  testSaved: (sessionId, id) => call("netlifyTestSaved", sessionId, id),
  saveDestination: (sessionId, draft, signIn) =>
    call("netlifySaveDestination", sessionId, draft, signIn),
});
