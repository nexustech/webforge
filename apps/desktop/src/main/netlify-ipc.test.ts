import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PublishDestination } from "@webforge/model";
import { ProjectStore } from "@webforge/storage";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it } from "vitest";
import { createCredentialStore, type SecretCipher } from "./credential-store.js";
import { createNetlifySignIns } from "./netlify-auth.js";
import { registerNetlifyHandlers } from "./netlify-ipc.js";
import { createPublishSecrets } from "./publish-secrets.js";
import type { SiteStore } from "./site-store.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const SESSION = "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const OPERATION = "5d6e7f80-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
const TOKEN = "nfp_test_only_token";
const ROSAS = "3f8e2a1c-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
const OTHER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

// A stand-in for safeStorage: reversible, and visibly not plain text.
const cipher: SecretCipher = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(`enc:${[...text].reverse().join("")}`),
  decryptString: (data) => [...data.toString().slice(4)].reverse().join(""),
};

/** Netlify's API as the calls reach it: tickets approved at once, two sites, and a new one. */
const netlifyApi: typeof fetch = async (input, init) => {
  const { pathname } = new URL(String(input));
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  if (pathname.endsWith("/oauth/tickets")) return reply(201, { id: "t1", authorized: true });
  if (pathname.endsWith("/oauth/tickets/t1/exchange")) return reply(201, { access_token: TOKEN });
  if (new Headers(init?.headers).get("Authorization") !== `Bearer ${TOKEN}`) return reply(401, {});
  if (pathname.endsWith("/user")) return reply(200, { id: "u1" });
  if (pathname.endsWith("/sites") && init?.method === "POST") {
    const { name } = JSON.parse(String(init.body)) as { name?: string };
    return reply(201, { id: OTHER, name: name ?? "jolly-bun", ssl_url: "https://new.netlify.app" });
  }
  if (pathname.endsWith(`/sites/${ROSAS}`)) return reply(200, { id: ROSAS, name: "rosas-bakery" });
  if (pathname.endsWith("/sites")) {
    return reply(200, [
      { id: ROSAS, name: "rosas-bakery", ssl_url: "https://rosas-bakery.netlify.app" },
      // Not a site a destination could keep: left out.
      { id: "legacy", name: "old" },
    ]);
  }
  return reply(404, {});
};

const tempDir = tempDirFactory();
const open: ProjectStore[] = [];
afterEach(() => {
  for (const store of open.splice(0)) store.close();
});

/** The Netlify handlers over a new site file, Netlify's sign-in set up in the build or not. */
function handlers({ setUp = true, readOnly = false } = {}) {
  const dir = tempDir();
  const path = join(dir, "site.wforge");
  ProjectStore.create(path, { name: "Rosa's Bakery" }).close();
  const store = ProjectStore.open(path, { readOnly });
  open.push(store);
  const credentials = join(dir, "credentials.json");
  const secrets = createPublishSecrets(createCredentialStore(credentials, cipher));
  const opened: string[] = [];
  const signIns = createNetlifySignIns({
    clientId: setUp ? "client" : undefined,
    fetch: netlifyApi,
    openExternal: async (url) => {
      opened.push(url);
    },
  });
  const site: Pick<SiteStore, "withStore"> = { withStore: async (_kind, work) => work(store) };
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerNetlifyHandlers(ipc, () => true, { signIns, site: () => site, secrets });
  const invoke = (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  return { store, credentials, secrets, invoke, opened };
}

/** The handle of a sign-in result. */
function handleOf(result: unknown): string {
  const signedIn = result as { status: string; handle?: string };
  if (signedIn.handle === undefined) throw new Error(`Not signed in: ${signedIn.status}`);
  return signedIn.handle;
}

const rosas = { id: ROSAS, name: "rosas-bakery", url: "https://rosas-bakery.netlify.app" };

describe("registerNetlifyHandlers (4.2, ADR 0006 decision 4)", () => {
  it("signs in in the browser, lists the sites, and saves the destination for its site (S32)", async () => {
    const { invoke, opened, store, secrets, credentials } = handlers();

    expect(await invoke("netlify:status")).toEqual({ canSignIn: true });
    const handle = handleOf(await invoke("netlify:sign-in", OPERATION));
    expect(opened).toHaveLength(1);

    expect(await invoke("netlify:sites", SESSION, { handle })).toEqual({
      status: "listed",
      sites: [rosas],
    });
    const saved = (await invoke(
      "netlify:save-destination",
      SESSION,
      { name: "Live", site: rosas },
      { handle },
    )) as { status: string; destination: PublishDestination };

    expect(saved).toMatchObject({
      status: "saved",
      destination: { name: "Live", kind: "netlify", siteId: ROSAS, url: rosas.url },
    });
    expect(store.readPublishDestinations()).toEqual([saved.destination]);
    expect(await secrets.signInFor(store.info.projectId, saved.destination)).toEqual({
      signIn: { token: TOKEN },
      trust: {},
    });
    // The token is in the keychain's record only, encrypted: never in the site file or a reply.
    expect(readFileSync(credentials, "utf8")).not.toContain(TOKEN);
    expect(JSON.stringify(saved)).not.toContain(TOKEN);
    // Saved, the sign-in is held no longer.
    expect(await invoke("netlify:sites", SESSION, { handle })).toEqual({
      status: "failed",
      reason: "signed-out",
    });
    // Its saved sign-in reaches the account, and its site, as Test connection asks.
    expect(await invoke("netlify:sites", SESSION, { saved: saved.destination.id })).toMatchObject({
      status: "listed",
    });
    expect(await invoke("netlify:test-saved", SESSION, saved.destination.id)).toEqual({ ok: true });
  });

  it("keeps a saved sign-in for the site the person picks, never one an edited file names (S32)", async () => {
    const { invoke, store } = handlers();
    const handle = handleOf(await invoke("netlify:sign-in-with-token", TOKEN));
    const first = (await invoke(
      "netlify:save-destination",
      SESSION,
      { name: "Live", site: rosas },
      { handle },
    )) as { destination: PublishDestination };
    const { id } = first.destination;

    // Renamed, same site: kept.
    expect(
      await invoke(
        "netlify:save-destination",
        SESSION,
        { id, name: "Bakery", site: rosas },
        { keep: true },
      ),
    ).toMatchObject({ status: "saved", destination: { name: "Bakery" } });
    // Another site the person picks: the sign-in goes with it.
    const other = { id: OTHER, name: "other" };
    expect(
      await invoke(
        "netlify:save-destination",
        SESSION,
        { id, name: "Bakery", site: other },
        { keep: true },
      ),
    ).toMatchObject({ status: "saved", destination: { siteId: OTHER } });
    expect(await invoke("netlify:sites", SESSION, { saved: id })).toMatchObject({
      status: "listed",
    });
    // A site Netlify no longer has: Test connection says so.
    expect(await invoke("netlify:test-saved", SESSION, id)).toEqual({
      ok: false,
      code: "not-found",
    });

    // The site file edited to name another site: no sign-in for it, to keep or to use.
    store.writePublishDestinations([
      { id, name: "Bakery", kind: "netlify", siteId: ROSAS, url: rosas.url },
    ]);
    expect(await invoke("netlify:sites", SESSION, { saved: id })).toEqual({
      status: "failed",
      reason: "signed-out",
    });
    expect(await invoke("netlify:test-saved", SESSION, id)).toEqual({
      ok: false,
      code: "unauthorized",
    });
    expect(
      await invoke(
        "netlify:save-destination",
        SESSION,
        { id, name: "B", site: rosas },
        { keep: true },
      ),
    ).toEqual({ status: "sign-in-needed" });
    // A new destination has nothing to keep.
    expect(
      await invoke(
        "netlify:save-destination",
        SESSION,
        { name: "New", site: rosas },
        { keep: true },
      ),
    ).toEqual({ status: "sign-in-needed" });
  });

  it("creates a site, by the name asked for", async () => {
    const { invoke } = handlers();
    const handle = handleOf(await invoke("netlify:sign-in-with-token", TOKEN));

    expect(await invoke("netlify:create-site", SESSION, { handle }, "rosas-new")).toEqual({
      status: "created",
      site: { id: OTHER, name: "rosas-new", url: "https://new.netlify.app" },
    });
    expect(
      await invoke("netlify:create-site", SESSION, {
        handle: "1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b",
      }),
    ).toEqual({
      status: "failed",
      reason: "signed-out",
    });
  });

  it("says why a sign-in failed, and keeps one whose save failed, to try again", async () => {
    const unset = handlers({ setUp: false });
    expect(await unset.invoke("netlify:status")).toEqual({ canSignIn: false });
    expect(await unset.invoke("netlify:sign-in", OPERATION)).toEqual({
      status: "failed",
      reason: "not-set-up",
    });
    expect(await unset.invoke("netlify:sign-in-with-token", "wrong")).toEqual({
      status: "failed",
      reason: "unauthorized",
    });

    const readOnly = handlers({ readOnly: true });
    const handle = handleOf(await readOnly.invoke("netlify:sign-in-with-token", TOKEN));
    expect(
      await readOnly.invoke(
        "netlify:save-destination",
        SESSION,
        { name: "Live", site: rosas },
        { handle },
      ),
    ).toMatchObject({ status: "failed" });
    expect(await readOnly.invoke("netlify:sites", SESSION, { handle })).toMatchObject({
      status: "listed",
    });
  });

  it("forgets a sign-in the person stopped, at once", async () => {
    const { invoke } = handlers();
    const handle = handleOf(await invoke("netlify:sign-in-with-token", TOKEN));

    expect(await invoke("netlify:forget-sign-in", handle)).toBeNull();
    expect(await invoke("netlify:sites", SESSION, { handle })).toEqual({
      status: "failed",
      reason: "signed-out",
    });
  });

  it("refuses arguments that aren't what the call takes", async () => {
    const { invoke } = handlers();
    await expect(invoke("netlify:sites", SESSION, { handle: "not-a-handle" })).rejects.toThrow();
    await expect(
      invoke(
        "netlify:save-destination",
        SESSION,
        { name: "Live", site: { id: "x", name: "x" } },
        {},
      ),
    ).rejects.toThrow();
  });
});
