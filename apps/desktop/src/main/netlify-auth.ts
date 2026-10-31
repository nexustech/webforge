import { netlifyClient, PublishError, signInToNetlify } from "@webforge/publish";
import type { CredentialStore } from "./credential-store.js";

// Netlify sign-in for publish profiles (spec/04 item 0.2, ADR 0006): OAuth in the user's own
// browser, or a pasted personal access token as the fallback. Either way the token goes straight
// into the encrypted credential store and never reaches the renderer or the `.wforge` file. The
// publish UI (Phase 4) calls this through IPC.

/** What Netlify sign-in needs from the main process. */
export type NetlifyAuthOptions = {
  readonly store: CredentialStore;
  /** Opens a URL in the user's browser: `shell.openExternal`. */
  readonly openExternal: (url: string) => Promise<void>;
  /** Webforge's Netlify OAuth client ID, or `undefined` until one is registered. */
  readonly clientId: string | undefined;
  /** Injectable for tests. */
  readonly fetch?: typeof fetch;
};

/** Netlify sign-in, keyed like the credential store (see `publishCredentialKey`). */
export function netlifyAuth(options: NetlifyAuthOptions) {
  const { store, clientId } = options;
  const network = options.fetch === undefined ? {} : { fetch: options.fetch };

  return {
    /** Whether "Sign in with Netlify" can be offered; otherwise only a pasted token works. */
    canSignIn: () => clientId !== undefined && clientId !== "",

    /** Signs in in the user's browser and saves the token for `key`. */
    async signIn(key: string, signal?: AbortSignal): Promise<void> {
      if (clientId === undefined || clientId === "") {
        throw new PublishError("failed", "Netlify sign-in is not set up in this build");
      }
      const token = await signInToNetlify({
        clientId,
        openUrl: options.openExternal,
        ...network,
        ...(signal === undefined ? {} : { signal }),
      });
      await store.set(key, token);
    },

    /** Checks a pasted personal access token with Netlify, then saves it for `key`. */
    async usePersonalToken(key: string, token: string, signal?: AbortSignal): Promise<void> {
      const trimmed = token.trim();
      if (trimmed === "") throw new PublishError("unauthorized", "No token was given");
      await netlifyClient({ token: trimmed, ...network }).currentUser(signal);
      await store.set(key, trimmed);
    },

    /** The saved token for `key`, for creating a `netlifyPublisher`. */
    token: (key: string) => store.get(key),

    signOut: (key: string) => store.delete(key),
  };
}
