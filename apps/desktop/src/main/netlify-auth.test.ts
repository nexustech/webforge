import { describe, expect, it } from "vitest";
import type { CredentialStore } from "./credential-store.js";
import { netlifyAuth } from "./netlify-auth.js";

const TOKEN = "nfp_live_token";

function memoryStore(): CredentialStore & { secrets: Map<string, string> } {
  const secrets = new Map<string, string>();
  return {
    secrets,
    get: async (key) => secrets.get(key) ?? null,
    set: async (key, secret) => {
      secrets.set(key, secret);
    },
    delete: async (key) => {
      secrets.delete(key);
    },
  };
}

/** Netlify's ticket and user endpoints, approving every ticket at once. */
const netlifyApi: typeof fetch = async (input, init) => {
  const { pathname } = new URL(String(input));
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  if (pathname.endsWith("/oauth/tickets")) return reply(201, { id: "t1", authorized: false });
  if (pathname.endsWith("/oauth/tickets/t1")) return reply(200, { id: "t1", authorized: true });
  if (pathname.endsWith("/oauth/tickets/t1/exchange")) return reply(201, { access_token: TOKEN });
  if (pathname.endsWith("/user")) {
    const auth = new Headers(init?.headers).get("Authorization");
    return auth === `Bearer ${TOKEN}` ? reply(200, { id: "u1" }) : reply(401, {});
  }
  return reply(404, {});
};

describe("netlifyAuth", () => {
  it("signs in in the browser and saves the token", async () => {
    const store = memoryStore();
    const opened: string[] = [];
    const auth = netlifyAuth({
      store,
      clientId: "client",
      fetch: netlifyApi,
      openExternal: async (url) => {
        opened.push(url);
      },
    });

    expect(auth.canSignIn()).toBe(true);
    await auth.signIn("p/live");

    expect(opened).toEqual(["https://app.netlify.com/authorize?response_type=ticket&ticket=t1"]);
    expect(await auth.token("p/live")).toBe(TOKEN);
    await auth.signOut("p/live");
    expect(store.secrets.size).toBe(0);
  });

  it("offers only a pasted token while no client ID is set up", async () => {
    const auth = netlifyAuth({
      store: memoryStore(),
      clientId: undefined,
      openExternal: async () => {},
    });

    expect(auth.canSignIn()).toBe(false);
    await expect(auth.signIn("p/live")).rejects.toMatchObject({ code: "failed" });
  });

  it("checks a pasted token with Netlify before saving it", async () => {
    const store = memoryStore();
    const auth = netlifyAuth({
      store,
      clientId: undefined,
      fetch: netlifyApi,
      openExternal: async () => {},
    });

    await expect(auth.usePersonalToken("p/live", "wrong")).rejects.toMatchObject({
      code: "unauthorized",
    });
    await expect(auth.usePersonalToken("p/live", "   ")).rejects.toMatchObject({
      code: "unauthorized",
    });
    expect(store.secrets.size).toBe(0);

    await auth.usePersonalToken("p/live", `  ${TOKEN}\n`);
    expect(store.secrets.get("p/live")).toBe(TOKEN);
  });
});
