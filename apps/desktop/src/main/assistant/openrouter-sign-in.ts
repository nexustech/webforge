import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { z } from "zod";

/**
 * OpenRouter's sign-in (6.9a, ADR 0026 §3): OAuth with PKCE, in the person's browser, on their own
 * account. Main makes the verifier, which never leaves it; the callback comes to a loopback
 * listener that lives for one sign-in, at most 10 minutes; the code is exchanged for a key. Or,
 * where the browser can't reach the listener, OpenRouter shows the code for the person to paste.
 */

const AUTH_URL = "https://openrouter.ai/auth";
const KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";

/** A code's lifetime at OpenRouter, and so a sign-in's. */
const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;

/** How a sign-in ended: the key, which the caller stores and never shows; or why not. */
type SignInOutcome =
  | { readonly status: "signed-in"; readonly key: string }
  | { readonly status: "cancelled" | "timed-out" | "refused" | "offline" | "failed" };

export type OpenRouterSignInOptions = {
  readonly fetchFn: typeof fetch;
  /** Opens the person's browser (`shell.openExternal`). */
  readonly openExternal: (url: string) => Promise<void>;
  /** The key's label in the person's OpenRouter account: "{appName}, ‹date›", never the computer. */
  readonly keyLabel: () => string;
  /** The callback page's words: the person can close the tab. */
  readonly donePage: () => { readonly title: string; readonly body: string };
  readonly timeoutMs?: number;
};

export type OpenRouterSignIn = {
  /**
   * Starts a sign-in, cancelling any under way. `browser` waits for the callback; `code` waits
   * for {@link OpenRouterSignIn.finishWithCode}. Resolves when it ends, either way.
   */
  start(mode: "browser" | "code"): Promise<SignInOutcome>;
  /** The code the person pasted, for a `code` sign-in; resolves as that sign-in does. */
  finishWithCode(code: string): Promise<SignInOutcome>;
  /** Ends a sign-in under way as `cancelled`. */
  cancel(): void;
};

/** RFC 7636's S256: base64url of the verifier's SHA-256. */
export const challengeFor = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");

const keysAnswerSchema = z.looseObject({ key: z.string().min(1).max(500) });

/** Exchanges `code` with the verifier it was asked for with: the key, or why not. */
async function exchange(
  fetchFn: typeof fetch,
  code: string,
  verifier: string,
): Promise<SignInOutcome> {
  let response: Response;
  try {
    response = await fetchFn(KEYS_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
    });
  } catch {
    return { status: "offline" };
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    // An expired, used or mismatched code, or a person whose account can't make keys.
    return { status: response.status >= 500 ? "failed" : "refused" };
  }
  const answer = keysAnswerSchema.safeParse(await response.json().catch(() => null));
  return answer.success ? { status: "signed-in", key: answer.data.key } : { status: "failed" };
}

/** Escapes text for the callback page, which holds no script and loads nothing. */
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? "",
  );

/** Listens on loopback, on a fresh port, at `127.0.0.1` and, where there is one, `::1`. */
async function listenOnLoopback(
  handle: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ port: number; close: () => void }> {
  const servers: Server[] = [];
  const listen = (host: string, port: number) =>
    new Promise<Server>((resolve, reject) => {
      const server = createServer({ requestTimeout: 10_000 }, handle);
      server.once("error", reject);
      server.listen(port, host, () => {
        server.off("error", reject);
        resolve(server);
      });
    });
  const first = await listen("127.0.0.1", 0);
  servers.push(first);
  const { port } = first.address() as AddressInfo;
  // `localhost` may resolve to `::1` first; a computer without IPv6 has only the first listener.
  await listen("::1", port).then(
    (server) => servers.push(server),
    () => undefined,
  );
  return {
    port,
    close: () => {
      for (const server of servers) server.close();
    },
  };
}

/** OpenRouter's sign-in, one at a time (see the top of this file). */
export function createOpenRouterSignIn(options: OpenRouterSignInOptions): OpenRouterSignIn {
  const timeoutMs = options.timeoutMs ?? SIGN_IN_TIMEOUT_MS;
  let current: { end: (outcome: SignInOutcome) => void; verifier: string; mode: string } | null =
    null;

  const start = (mode: "browser" | "code"): Promise<SignInOutcome> => {
    current?.end({ status: "cancelled" });
    const verifier = randomBytes(32).toString("base64url");
    const state = randomBytes(16).toString("base64url");
    let close = (): void => undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let port = 0;
    return new Promise<SignInOutcome>((resolve) => {
      const me = {
        verifier,
        mode,
        end: (outcome: SignInOutcome) => {
          if (current !== me) return;
          current = null;
          clearTimeout(timer);
          close();
          resolve(outcome);
        },
      };
      current = me;
      timer = setTimeout(() => me.end({ status: "timed-out" }), timeoutMs);
      const params = new URLSearchParams({
        code_challenge: challengeFor(verifier),
        code_challenge_method: "S256",
        key_label: options.keyLabel(),
      });
      const open = (url: string) =>
        options.openExternal(url).catch(() => me.end({ status: "failed" }));
      if (mode === "code") {
        // OpenRouter shows the code, for the person to paste (finishWithCode).
        void open(`${AUTH_URL}?${params}`);
        return;
      }
      void listenOnLoopback((req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const hostOk = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`].includes(
          req.headers.host ?? "",
        );
        const code = url.searchParams.get("code");
        // Only OpenRouter's redirect for this sign-in: anything else is refused, and it waits on.
        if (
          !hostOk ||
          req.method !== "GET" ||
          url.pathname !== "/callback" ||
          url.searchParams.get("state") !== state ||
          code === null ||
          code === ""
        ) {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end();
          return;
        }
        const { title, body } = options.donePage();
        res
          .writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "content-security-policy": "default-src 'none'",
            "cache-control": "no-store",
          })
          .end(
            `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title><p>${escapeHtml(body)}</p>`,
          );
        close();
        void exchange(options.fetchFn, code, verifier).then(me.end);
      }).then(
        (listener) => {
          port = listener.port;
          close = listener.close;
          if (current !== me) return close();
          params.set("callback_url", `http://localhost:${port}/callback`);
          params.set("state", state);
          void open(`${AUTH_URL}?${params}`);
        },
        () => me.end({ status: "failed" }),
      );
    });
  };

  return {
    start,
    finishWithCode: async (code) => {
      const signIn = current;
      if (signIn === null || signIn.mode !== "code") return { status: "cancelled" };
      const outcome = await exchange(options.fetchFn, code.trim(), signIn.verifier);
      // Cancelled, or replaced, while the code was exchanged: its key isn't handed on.
      if (current !== signIn) return { status: "cancelled" };
      // A wrong code leaves the sign-in waiting, for the person to paste it again.
      if (outcome.status === "signed-in" || outcome.status === "failed") signIn.end(outcome);
      return outcome;
    },
    cancel: () => current?.end({ status: "cancelled" }),
  };
}
