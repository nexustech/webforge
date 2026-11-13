import { request } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { challengeFor, createOpenRouterSignIn } from "./openrouter-sign-in.js";

/** A fake OpenRouter: hands out `key` for `code` with the right verifier, keeping what it got. */
function openRouter({ code = "the-code", key = "sk-or-v1-new" } = {}) {
  const exchanges: Record<string, unknown>[] = [];
  let challenge = "";
  const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, string>;
    exchanges.push(body);
    const ok = body.code === code && challengeFor(body.code_verifier ?? "") === challenge;
    return ok
      ? new Response(JSON.stringify({ key, user_id: "u" }), { status: 200 })
      : new Response(JSON.stringify({ error: "invalid code" }), { status: 403 });
  }) as unknown as typeof fetch;
  const opened: URL[] = [];
  const openExternal = vi.fn(async (url: string) => {
    const parsed = new URL(url);
    challenge = parsed.searchParams.get("code_challenge") ?? "";
    opened.push(parsed);
  });
  return { fetchFn, openExternal, exchanges, opened };
}

const signInWith = (fake: ReturnType<typeof openRouter>, timeoutMs?: number) =>
  createOpenRouterSignIn({
    fetchFn: fake.fetchFn,
    openExternal: fake.openExternal,
    keyLabel: () => "Webforge, 13 Nov 2026",
    donePage: () => ({ title: "Signed in", body: "You can close this tab <now>." }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });

/** A GET to the listener, as the browser makes it: its status and page. */
function get(url: string, host?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = request(
      {
        host: "127.0.0.1",
        port: target.port,
        path: `${target.pathname}${target.search}`,
        headers: { host: host ?? target.host },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += String(chunk);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Waits until the browser has been opened, and gives the auth URL it was opened at. */
async function authUrl(fake: ReturnType<typeof openRouter>): Promise<URL> {
  await vi.waitFor(() => expect(fake.opened.length).toBeGreaterThan(0));
  const [url] = fake.opened;
  if (url === undefined) throw new Error("not opened");
  return url;
}

describe("OpenRouter's sign-in (6.9a, ADR 0026 §3)", () => {
  it("opens OpenRouter with an S256 challenge, takes the callback, and exchanges the code", async () => {
    const fake = openRouter();
    const signIn = signInWith(fake);
    const signedIn = signIn.start("browser");

    const url = await authUrl(fake);
    expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("key_label")).toBe("Webforge, 13 Nov 2026");
    const callback = new URL(url.searchParams.get("callback_url") ?? "");
    expect(callback.hostname).toBe("localhost");
    expect(callback.pathname).toBe("/callback");
    const state = url.searchParams.get("state") ?? "";
    expect(state.length).toBeGreaterThanOrEqual(20);

    const page = await get(`${callback}?code=the-code&state=${state}`);
    expect(page.status).toBe(200);
    // The page escapes its words, and loads nothing.
    expect(page.body).toContain("You can close this tab &lt;now&gt;.");
    expect(await signedIn).toEqual({ status: "signed-in", key: "sk-or-v1-new" });
    // The verifier went only to OpenRouter's exchange, never into the browser's URL.
    const [exchanged] = fake.exchanges;
    expect(exchanged).toMatchObject({ code: "the-code", code_challenge_method: "S256" });
    expect(url.toString()).not.toContain(String(exchanged?.code_verifier));
    // The listener is gone.
    await expect(get(`${callback}?code=the-code&state=${state}`)).rejects.toThrow();
  });

  it("refuses a callback with the wrong state, Host or path, and waits on for the right one", async () => {
    const fake = openRouter();
    const signIn = signInWith(fake);
    const signedIn = signIn.start("browser");
    const url = await authUrl(fake);
    const callback = new URL(url.searchParams.get("callback_url") ?? "");
    const state = url.searchParams.get("state") ?? "";

    expect((await get(`${callback}?code=the-code&state=guessed`)).status).toBe(400);
    expect(
      (await get(`${callback}?code=the-code&state=${state}`, `evil.example:${callback.port}`))
        .status,
    ).toBe(400);
    expect((await get(`${callback.origin}/other?code=the-code&state=${state}`)).status).toBe(400);
    expect((await get(`${callback}?state=${state}`)).status).toBe(400);
    expect(fake.exchanges).toEqual([]);

    expect((await get(`${callback}?code=the-code&state=${state}`)).status).toBe(200);
    expect(await signedIn).toMatchObject({ status: "signed-in" });
  });

  it("signs in with a pasted code where the browser can't call back, and takes a retry", async () => {
    const fake = openRouter();
    const signIn = signInWith(fake);
    const signedIn = signIn.start("code");
    const url = await authUrl(fake);
    expect(url.searchParams.has("callback_url")).toBe(false);
    expect(url.searchParams.get("code_challenge")).not.toBeNull();

    // A wrong code leaves it waiting.
    expect(await signIn.finishWithCode("typo")).toEqual({ status: "refused" });
    expect(await signIn.finishWithCode(" the-code ")).toEqual({
      status: "signed-in",
      key: "sk-or-v1-new",
    });
    expect(await signedIn).toMatchObject({ status: "signed-in" });
    expect(await signIn.finishWithCode("the-code")).toEqual({ status: "cancelled" });
  });

  it("ends as cancelled, timed out, offline, or failed when no browser opens", async () => {
    const cancelling = signInWith(openRouter());
    const cancelled = cancelling.start("browser");
    cancelling.cancel();
    expect(await cancelled).toEqual({ status: "cancelled" });

    // A second sign-in cancels the first.
    const twice = signInWith(openRouter());
    const first = twice.start("code");
    void twice.start("code");
    expect(await first).toEqual({ status: "cancelled" });
    twice.cancel();

    expect(await signInWith(openRouter(), 20).start("browser")).toEqual({ status: "timed-out" });

    const offline = openRouter();
    offline.fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const offlineSignIn = signInWith(offline);
    void offlineSignIn.start("code");
    await authUrl(offline);
    expect(await offlineSignIn.finishWithCode("the-code")).toEqual({ status: "offline" });
    offlineSignIn.cancel();

    const noBrowser = openRouter();
    noBrowser.openExternal.mockRejectedValue(new Error("no handler"));
    expect(await signInWith(noBrowser).start("code")).toEqual({ status: "failed" });
  });
});
