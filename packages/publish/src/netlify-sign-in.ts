import { z } from "zod";
import { type NetlifyRequestOptions, netlifyRequester } from "./netlify.js";
import { PublishError, throwIfCancelled } from "./publisher.js";

// Netlify sign-in with an OAuth "ticket" (ADR 0006), the flow netlify-cli uses: Webforge asks
// Netlify for a ticket, the user approves it in their own browser, and Webforge exchanges the
// approved ticket for an access token. Unlike a loopback redirect, no local server listens and
// no redirect address has to be registered; like it, there is no client secret to keep.

/** Where the user approves a ticket. */
export const NETLIFY_AUTHORIZE_URL = "https://app.netlify.com/authorize";

const ticketSchema = z.object({ id: z.string(), authorized: z.boolean() });
const accessTokenSchema = z.object({ access_token: z.string().min(1) });

/** Options of {@link signInToNetlify}. */
export type NetlifySignInOptions = Omit<NetlifyRequestOptions, "token"> & {
  /** The Webforge OAuth application's client ID (public; registered at app.netlify.com). */
  readonly clientId: string;
  /** Opens `url` in the user's browser (Electron: `shell.openExternal`). */
  readonly openUrl: (url: string) => Promise<void>;
  readonly authorizeUrl?: string;
  /** How often to check whether the user has approved, and for how long. */
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};

function pause(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

/**
 * Signs in to Netlify in the user's browser and returns the access token. Fails with
 * `unauthorized` if the client ID is unknown, `cancelled` if `signal` aborts, and `failed` if
 * the user does not approve within `timeoutMs` (default 5 minutes).
 */
export async function signInToNetlify(options: NetlifySignInOptions): Promise<string> {
  const request = netlifyRequester(options);
  const { signal } = options;
  const ticket = await request(
    "POST",
    `/oauth/tickets?client_id=${encodeURIComponent(options.clientId)}`,
    ticketSchema,
    { body: {}, signal },
  );
  const authorize = new URL(options.authorizeUrl ?? NETLIFY_AUTHORIZE_URL);
  authorize.searchParams.set("response_type", "ticket");
  authorize.searchParams.set("ticket", ticket.id);
  await options.openUrl(authorize.toString());

  const ticketPath = `/oauth/tickets/${encodeURIComponent(ticket.id)}`;
  const deadline = Date.now() + (options.timeoutMs ?? 5 * 60_000);
  for (let current = ticket; !current.authorized; ) {
    if (Date.now() > deadline) {
      throw new PublishError("failed", "Netlify sign-in was not approved in time");
    }
    await pause(options.pollIntervalMs ?? 1_000, signal);
    throwIfCancelled(signal);
    current = await request("GET", ticketPath, ticketSchema, { signal });
  }
  const { access_token } = await request("POST", `${ticketPath}/exchange`, accessTokenSchema, {
    body: {},
    signal,
  });
  return access_token;
}
