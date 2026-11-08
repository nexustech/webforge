import type { NetlifyApi } from "../../shared/ipc/netlify.js";
import type { NetlifyPublishApi } from "./PublishDialog.js";

/**
 * The Publish dialog's Netlify calls (4.4b) through `netlify`, the preload API (4.2's IPC), for
 * the open site's session. Each sign-in in the browser gets an operation id of its own, which
 * *Cancel Sign-In* names; `canSignIn` comes from `status()`, which the area reads once. Made once
 * per window, so the dialog's effects see the same functions from one render to the next.
 */
export function netlifyThrough(
  netlify: NetlifyApi,
  sessionId: () => string,
  newId: () => string = () => crypto.randomUUID(),
): Omit<NetlifyPublishApi, "canSignIn"> {
  /** The browser sign-in under way, if one is. */
  let signingIn: string | undefined;
  return {
    signIn: async () => {
      const id = newId();
      signingIn = id;
      try {
        return await netlify.signIn(id);
      } finally {
        if (signingIn === id) signingIn = undefined;
      }
    },
    cancelSignIn: () => {
      if (signingIn !== undefined) void netlify.cancelSignIn(signingIn).catch(() => null);
    },
    // Nothing to wait for: main lets the sign-in go, or drops it after 30 minutes anyway.
    forgetSignIn: (handle) => {
      void netlify.forgetSignIn(handle).catch(() => null);
    },
    signInWithToken: (token) => netlify.signInWithToken(token),
    sites: (account) => netlify.sites(sessionId(), account),
    createSite: (account, name) => netlify.createSite(sessionId(), account, name),
    testSaved: (id) => netlify.testSaved(sessionId(), id),
    save: (draft, signIn) => netlify.saveDestination(sessionId(), draft, signIn),
  };
}
