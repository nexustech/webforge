import { randomUUID } from "node:crypto";
import { netlifyClient, PublishError, signInToNetlify } from "@webforge/publish";

// Netlify sign-in for publish destinations (ADR 0006 decision 4, 4.2): Netlify's OAuth ticket
// flow in the person's own browser, or a pasted personal access token as the fallback. The token
// stays in the main process, held here under a random handle while the person chooses or creates
// the Netlify site, then saved through `PublishSecrets` for that site (S2, S32, S38) by
// `netlify-ipc.ts`. It never reaches the renderer or the `.wforge` file, and is never logged.

/** How long a sign-in waits for its site to be chosen before it's dropped. */
const KEEP_MS = 30 * 60_000;

/** What Netlify sign-in needs from the main process. */
export type NetlifySignInsOptions = {
  /** Opens a URL in the person's browser: `shell.openExternal`. */
  readonly openExternal: (url: string) => Promise<void>;
  /** Webforge's Netlify OAuth client ID, or `undefined` until one is registered (a build setting). */
  readonly clientId: string | undefined;
  /** Netlify's API, another for the E2E tests' stand-in; Netlify's own by default. */
  readonly apiBase?: string | undefined;
  /** Injectable for tests. */
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
};

/** The sign-ins made and not yet saved for a site, by handle. */
export type NetlifySignIns = {
  /** Whether "Sign in with Netlify" can be offered; otherwise only a pasted token works. */
  canSignIn(): boolean;
  /** Signs in in the person's browser; the sign-in's handle. Throws `PublishError`. */
  signIn(signal?: AbortSignal): Promise<string>;
  /** Checks a pasted personal access token with Netlify; its handle. Throws `PublishError`. */
  signInWithToken(token: string, signal?: AbortSignal): Promise<string>;
  /** Netlify's API as the sign-in `handle` reaches it, while it's held. */
  client(handle: string): ReturnType<typeof netlifyClient> | undefined;
  /** The token of sign-in `handle`, while it's held: to be saved for a site. */
  token(handle: string): string | undefined;
  /** Holds sign-in `handle` no longer: once it's saved for a site. */
  forget(handle: string): void;
};

/** Netlify sign-ins, held in memory until saved for a site or forgotten. */
export function createNetlifySignIns(options: NetlifySignInsOptions): NetlifySignIns {
  const { clientId } = options;
  const now = options.now ?? Date.now;
  const network = {
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.apiBase === undefined ? {} : { apiBase: options.apiBase }),
  };
  const held = new Map<string, { readonly token: string; readonly at: number }>();
  const tokenOf = (handle: string) => {
    for (const [key, { at }] of held) if (now() - at > KEEP_MS) held.delete(key);
    return held.get(handle)?.token;
  };
  const hold = (token: string) => {
    const handle = randomUUID();
    held.set(handle, { token, at: now() });
    return handle;
  };

  return {
    canSignIn: () => clientId !== undefined && clientId !== "",

    async signIn(signal) {
      if (clientId === undefined || clientId === "") {
        throw new PublishError("failed", "Netlify sign-in is not set up in this build");
      }
      const token = await signInToNetlify({
        clientId,
        openUrl: options.openExternal,
        ...network,
        ...(signal === undefined ? {} : { signal }),
      });
      return hold(token);
    },

    async signInWithToken(token, signal) {
      const trimmed = token.trim();
      if (trimmed === "") throw new PublishError("unauthorized", "No token was given");
      await netlifyClient({ token: trimmed, ...network }).currentUser(signal);
      return hold(trimmed);
    },

    client(handle) {
      const token = tokenOf(handle);
      return token === undefined ? undefined : netlifyClient({ token, ...network });
    },

    token: tokenOf,

    forget(handle) {
      held.delete(handle);
    },
  };
}
