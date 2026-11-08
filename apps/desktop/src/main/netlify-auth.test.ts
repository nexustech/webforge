import type { PublishDestination } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { type CredentialStore, publishCredentialKey } from "./credential-store.js";
import { netlifyAuth } from "./netlify-auth.js";
import { createPublishSecrets } from "./publish-secrets.js";

const TOKEN = "nfp_live_token";
const PROJECT = "7d2b0c1e-1111-4222-8333-444455556666";

const live = {
  id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
  name: "Live",
  kind: "netlify",
  siteId: "3f8e2a1c-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
} satisfies PublishDestination;

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

function setup(clientId: string | undefined) {
  const store = memoryStore();
  const secrets = createPublishSecrets(store);
  const opened: string[] = [];
  const auth = netlifyAuth({
    secrets,
    clientId,
    fetch: netlifyApi,
    openExternal: async (url) => {
      opened.push(url);
    },
  });
  return { store, secrets, opened, auth };
}

describe("netlifyAuth", () => {
  it("signs in in the browser and saves the token for the destination's site (S32, S38)", async () => {
    const { store, secrets, opened, auth } = setup("client");

    expect(auth.canSignIn()).toBe(true);
    await auth.signIn(PROJECT, live);

    expect(opened).toEqual(["https://app.netlify.com/authorize?response_type=ticket&ticket=t1"]);
    expect(await secrets.signInFor(PROJECT, live)).toEqual({ signIn: { token: TOKEN }, trust: {} });
    // Saved as PublishSecrets' record, never as the raw token.
    const saved = store.secrets.get(publishCredentialKey(PROJECT, live.id));
    expect(saved).not.toBe(TOKEN);
    expect(JSON.parse(saved ?? "{}")).toMatchObject({ version: 1, signIn: { token: TOKEN } });
    // Another site, named by an edited site file, gets nothing.
    const other = { ...live, siteId: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d" };
    expect(await secrets.signInFor(PROJECT, other)).toBeUndefined();
  });

  it("offers only a pasted token while no client ID is set up", async () => {
    const { auth, store } = setup(undefined);

    expect(auth.canSignIn()).toBe(false);
    await expect(auth.signIn(PROJECT, live)).rejects.toMatchObject({ code: "failed" });
    expect(store.secrets.size).toBe(0);
  });

  it("checks a pasted token with Netlify before saving it", async () => {
    const { auth, store, secrets } = setup(undefined);

    await expect(auth.usePersonalToken(PROJECT, live, "wrong")).rejects.toMatchObject({
      code: "unauthorized",
    });
    await expect(auth.usePersonalToken(PROJECT, live, "   ")).rejects.toMatchObject({
      code: "unauthorized",
    });
    expect(store.secrets.size).toBe(0);

    await auth.usePersonalToken(PROJECT, live, `  ${TOKEN}\n`);
    expect((await secrets.signInFor(PROJECT, live))?.signIn).toEqual({ token: TOKEN });
  });
});
