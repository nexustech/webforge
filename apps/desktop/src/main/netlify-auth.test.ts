import { describe, expect, it } from "vitest";
import { createNetlifySignIns } from "./netlify-auth.js";

const TOKEN = "nfp_live_token";

/** Netlify's ticket and user endpoints, approving every ticket at once. */
const netlifyApi: typeof fetch = async (input, init) => {
  const { pathname } = new URL(String(input));
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  if (pathname.endsWith("/oauth/tickets")) return reply(201, { id: "t1", authorized: false });
  if (pathname.endsWith("/oauth/tickets/t1")) return reply(200, { id: "t1", authorized: true });
  if (pathname.endsWith("/oauth/tickets/t1/exchange")) return reply(201, { access_token: TOKEN });
  const auth = new Headers(init?.headers).get("Authorization");
  if (auth !== `Bearer ${TOKEN}`) return reply(401, {});
  if (pathname.endsWith("/user")) return reply(200, { id: "u1" });
  if (pathname.endsWith("/sites")) return reply(200, []);
  return reply(404, {});
};

function setup(clientId: string | undefined, clock = { now: 0 }) {
  const opened: string[] = [];
  const signIns = createNetlifySignIns({
    clientId,
    fetch: netlifyApi,
    now: () => clock.now,
    openExternal: async (url) => {
      opened.push(url);
    },
  });
  return { signIns, opened, clock };
}

describe("createNetlifySignIns (ADR 0006 decision 4, 4.2)", () => {
  it("signs in in the browser and holds the token in main, under a handle", async () => {
    const { signIns, opened } = setup("client");

    expect(signIns.canSignIn()).toBe(true);
    const handle = await signIns.signIn();

    expect(opened).toEqual(["https://app.netlify.com/authorize?response_type=ticket&ticket=t1"]);
    // A handle, never the token: the renderer only ever has this.
    expect(handle).toMatch(/^[0-9a-f-]{36}$/);
    expect(handle).not.toContain(TOKEN);
    expect(await signIns.client(handle)?.listSites()).toEqual([]);
    // Read to be saved for a site; then held no longer.
    expect(signIns.token(handle)).toBe(TOKEN);
    signIns.forget(handle);
    expect(signIns.token(handle)).toBeUndefined();
    expect(signIns.client(handle)).toBeUndefined();
  });

  it("offers only a pasted token while no client ID is set up", async () => {
    const { signIns } = setup(undefined);

    expect(signIns.canSignIn()).toBe(false);
    expect(setup("").signIns.canSignIn()).toBe(false);
    await expect(signIns.signIn()).rejects.toMatchObject({ code: "failed" });
  });

  it("checks a pasted token with Netlify before holding it", async () => {
    const { signIns } = setup(undefined);

    await expect(signIns.signInWithToken("wrong")).rejects.toMatchObject({ code: "unauthorized" });
    await expect(signIns.signInWithToken("   ")).rejects.toMatchObject({ code: "unauthorized" });

    const handle = await signIns.signInWithToken(`  ${TOKEN}\n`);
    expect(signIns.token(handle)).toBe(TOKEN);
  });

  it("drops a sign-in whose site isn't chosen within 30 minutes", async () => {
    const { signIns, clock } = setup(undefined);
    const handle = await signIns.signInWithToken(TOKEN);

    clock.now = 30 * 60_000;
    expect(signIns.client(handle)).toBeDefined();
    clock.now += 1;
    expect(signIns.token(handle)).toBeUndefined();
  });

  it("drops the sign-ins past their 30 minutes as another is held, and one forgotten at once", async () => {
    const { signIns, clock } = setup(undefined);
    const old = await signIns.signInWithToken(TOKEN);
    const kept = await signIns.signInWithToken(TOKEN);

    signIns.forget(kept);
    expect(signIns.client(kept)).toBeUndefined();

    clock.now = 31 * 60_000;
    const fresh = await signIns.signInWithToken(TOKEN);
    expect(signIns.client(old)).toBeUndefined();
    expect(signIns.client(fresh)).toBeDefined();
  });
});
