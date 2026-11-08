import type { PublishDestination } from "@webforge/model";
import { netlifyClient, PublishError, signInToNetlify } from "@webforge/publish";
import type { PublishSecrets } from "./publish-secrets.js";

// Netlify sign-in for publish destinations (spec/04 item 0.2, ADR 0006): OAuth in the user's own
// browser, or a pasted personal access token as the fallback. Either way the token is saved only
// through `PublishSecrets`, for the destination's site (S2, S32, S38), and never reaches the
// renderer or the `.wforge` file. The publish UI (4.4b) calls this through IPC.

/** A Netlify destination of the site file's list. */
type NetlifyDestination = Extract<PublishDestination, { kind: "netlify" }>;

/** What Netlify sign-in needs from the main process. */
export type NetlifyAuthOptions = {
  readonly secrets: PublishSecrets;
  /** Opens a URL in the user's browser: `shell.openExternal`. */
  readonly openExternal: (url: string) => Promise<void>;
  /** Webforge's Netlify OAuth client ID, or `undefined` until one is registered. */
  readonly clientId: string | undefined;
  /** Injectable for tests. */
  readonly fetch?: typeof fetch;
};

/** Netlify sign-in for the open site's destinations, by its project id. */
export function netlifyAuth(options: NetlifyAuthOptions) {
  const { secrets, clientId } = options;
  const network = options.fetch === undefined ? {} : { fetch: options.fetch };
  const save = (projectId: string, destination: NetlifyDestination, token: string) =>
    secrets.save(projectId, destination, { token }, {});

  return {
    /** Whether "Sign in with Netlify" can be offered; otherwise only a pasted token works. */
    canSignIn: () => clientId !== undefined && clientId !== "",

    /** Signs in in the user's browser and saves the token for `destination`. */
    async signIn(
      projectId: string,
      destination: NetlifyDestination,
      signal?: AbortSignal,
    ): Promise<void> {
      if (clientId === undefined || clientId === "") {
        throw new PublishError("failed", "Netlify sign-in is not set up in this build");
      }
      const token = await signInToNetlify({
        clientId,
        openUrl: options.openExternal,
        ...network,
        ...(signal === undefined ? {} : { signal }),
      });
      await save(projectId, destination, token);
    },

    /** Checks a pasted personal access token with Netlify, then saves it for `destination`. */
    async usePersonalToken(
      projectId: string,
      destination: NetlifyDestination,
      token: string,
      signal?: AbortSignal,
    ): Promise<void> {
      const trimmed = token.trim();
      if (trimmed === "") throw new PublishError("unauthorized", "No token was given");
      await netlifyClient({ token: trimmed, ...network }).currentUser(signal);
      await save(projectId, destination, trimmed);
    },
  };
}
