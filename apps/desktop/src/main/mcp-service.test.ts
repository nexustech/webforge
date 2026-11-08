import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it, vi } from "vitest";
import type { AiResponse } from "../shared/ipc/ai.js";
import { aiAppsFileSchema, createAiApps, NO_AI_APPS } from "./ai-apps.js";
import { createCredentialStore, type SecretCipher } from "./credential-store.js";
import { createJsonStore } from "./json-store.js";
import type { McpListener, McpListenerOptions } from "./mcp-listener.js";
import { createMcpService } from "./mcp-service.js";
import { siteChoices } from "./site-brief.js";

const cipher: SecretCipher = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(`enc:${text}`),
  decryptString: (data) => data.toString().slice(4),
};

const tempDir = tempDirFactory("webforge-mcp-service-");

/** A service with a fake listener, which takes `busy` ports as taken; the ports drawn in turn. */
function setUp(
  busy: readonly number[] = [],
  drawn: readonly number[] = [50_001, 50_002],
  refusal = "EADDRINUSE",
) {
  const dir = tempDir();
  const apps = createAiApps(
    createJsonStore(join(dir, "ai-apps.json"), aiAppsFileSchema, {
      empty: NO_AI_APPS,
      onDamaged: "move-aside",
    }),
    createCredentialStore(join(dir, "credentials.json"), cipher),
  );
  const listened: McpListenerOptions[] = [];
  const disconnected: string[] = [];
  let closed = 0;
  const listen = vi.fn(async (options: McpListenerOptions): Promise<McpListener> => {
    if (busy.includes(options.port)) throw Object.assign(new Error("taken"), { code: refusal });
    listened.push(options);
    return {
      port: options.port,
      connectedApps: () => [],
      disconnect: async (id) => {
        disconnected.push(id);
      },
      close: async () => {
        closed += 1;
      },
    };
  });
  const ports = [...drawn];
  const saveVersionBefore = vi.fn(async (_name: string): Promise<"saved" | "failed"> => "saved");
  // The opening of the site open now, by its session id.
  let opening: string | undefined = "session-1";
  const ask = vi.fn(async (): Promise<AiResponse> => ({ status: "done", data: {} }));
  const briefs = {
    ask: vi.fn(async () => ({ status: "declined", message: "closed" }) as const),
    choices: () => ({ status: "done", data: siteChoices([]) }) as const,
    status: vi.fn(() => ({ status: "not-found", message: "none" }) as const),
  };
  const service = createMcpService({
    apps,
    ask,
    info: { name: "Webforge", version: "1" },
    saveVersionBefore,
    opening: () => opening,
    briefs,
    listen,
    drawPort: () => ports.shift() ?? 59_999,
  });
  return {
    apps,
    service,
    listen,
    listened,
    disconnected,
    saveVersionBefore,
    ask,
    briefs,
    closed: () => closed,
    open: (session: string | undefined) => {
      opening = session;
    },
  };
}

describe("the MCP service (4.9, ADR 0021)", () => {
  it("listens on nothing while AI apps is off, as it is at first", async () => {
    const { service, listen } = setUp();

    await service.start();

    expect(listen).not.toHaveBeenCalled();
    expect(await service.status()).toEqual({
      enabled: false,
      port: null,
      moved: false,
      connected: [],
    });
  });

  it("listens once on, on a port drawn once and remembered, and stops when off", async () => {
    const first = setUp();
    await first.service.setEnabled(true);
    expect(await first.service.status()).toMatchObject({ enabled: true, port: 50_001 });
    expect(await first.apps.port()).toBe(50_001);

    await first.service.setEnabled(false);
    expect(first.closed()).toBe(1);
    expect(await first.service.status()).toMatchObject({ enabled: false, port: null });

    // Webforge started again: the same port.
    await first.service.setEnabled(true);
    expect(first.listened.map(({ port }) => port)).toEqual([50_001, 50_001]);
  });

  it("draws another port only when the remembered one is taken, and says the apps must be added again", async () => {
    const { apps, service } = setUp([50_001], [50_002]);
    await apps.setPort(50_001);

    await service.setEnabled(true);

    expect(await service.status()).toMatchObject({ port: 50_002, moved: true });
    expect(await apps.port()).toBe(50_002);
  });

  it("draws another port when Windows has reserved the remembered one (EACCES, 5.6)", async () => {
    const { apps, service } = setUp([50_001], [50_002], "EACCES");
    await apps.setPort(50_001);

    await service.setEnabled(true);

    expect(await service.status()).toMatchObject({ port: 50_002, moved: true });
  });

  it("revokes the keys of apps that connect directly when the port moves, and says so until seen (S27)", async () => {
    const { apps, service } = setUp([50_001], [50_002]);
    await apps.setPort(50_001);
    const cursor = await service.add("Cursor", "other");
    const claude = await service.add("Claude Desktop", "claude");
    if (cursor.status !== "paired" || claude.status !== "paired") throw new Error("not paired");

    await service.setEnabled(true);

    // Cursor sent its key to whatever took the old port: it's gone, key and all. Claude Desktop's
    // bridge checks it's Webforge before sending its key, so it stays.
    expect((await service.list()).map(({ name }) => name)).toEqual(["Claude Desktop"]);
    expect(await apps.authenticate(cursor.key)).toBeUndefined();
    expect(await apps.authenticate(claude.key)).toMatchObject({ name: "Claude Desktop" });

    // Kept in the file, past a restart, until the person has seen it.
    await service.setEnabled(false);
    await service.setEnabled(true);
    expect((await service.status()).moved).toBe(true);
    await service.seenMoved();
    expect((await service.status()).moved).toBe(false);
  });

  it("starts listening as Webforge starts, if AI apps was left on", async () => {
    const { apps, service } = setUp();
    await apps.setEnabled(true);

    await service.start();

    expect((await service.status()).port).toBe(50_001);
  });

  it("cuts a removed app off at once", async () => {
    const { apps, service, disconnected } = setUp();
    await service.setEnabled(true);
    const pairing = await service.add("Claude", "other");
    if (pairing.status !== "paired") throw new Error("not paired");
    const { app, key } = pairing;

    await service.remove(app.id);

    expect(disconnected).toEqual([app.id]);
    expect(await service.list()).toEqual([]);
    expect(await apps.authenticate(key)).toBeUndefined();
  });

  it("gives a paired app's proof to its bridge's challenge, and none for an app it doesn't list", async () => {
    const { apps, service, listened } = setUp();
    await service.setEnabled(true);
    const pairing = await service.add("Claude Desktop", "claude");
    if (pairing.status !== "paired") throw new Error("not paired");
    const [options] = listened;
    if (options === undefined) throw new Error("not listening");
    const stored = vi.spyOn(apps, "proofOf");

    expect(await options.proofOf(pairing.app.id)).toBe(pairing.proof);
    expect(await service.proofOf(pairing.app.id)).toBe(pairing.proof);
    // A made-up id never reaches the credential store.
    stored.mockClear();
    expect(await options.proofOf("6f1c1b8e-6a43-4f53-9a0b-4a4f8f3c2d11")).toBeNull();
    expect(stored).not.toHaveBeenCalled();

    await service.remove(pairing.app.id);
    expect(await options.proofOf(pairing.app.id)).toBeNull();
  });
});

/** A client on a new connection of `app` to what the service listens with. */
async function connection(options: McpListenerOptions, app: { id: string; name: string }) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await options.serverFor(app).connect(serverSide);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(clientSide);
  return client;
}

describe("the version before an AI app's changes (S20)", () => {
  const claude = { id: "app-1", name: "Claude" };

  it("is saved before an app's first command in each opening of the site, once however often it reconnects, and never for a query (S26)", async () => {
    const { service, listened, saveVersionBefore, ask, open } = setUp();
    await service.setEnabled(true);
    const [options] = listened;
    if (options === undefined) throw new Error("not listening");

    const first = await connection(options, claude);
    await first.callTool({ name: "outline", arguments: {} });
    expect(saveVersionBefore).not.toHaveBeenCalled();
    await first.callTool({ name: "addPage", arguments: { title: "Menu" } });
    await first.callTool({ name: "addPage", arguments: { title: "Team" } });
    expect(saveVersionBefore).toHaveBeenCalledExactlyOnceWith("Before Claude's changes");
    expect(ask).toHaveBeenCalledTimes(3);

    // Reconnecting adds none: the app can't push its own version out with versions (S26).
    for (let again = 0; again < 3; again++) {
      const next = await connection(options, claude);
      await next.callTool({ name: "addPage", arguments: { title: `Shop ${again}` } });
    }
    expect(saveVersionBefore).toHaveBeenCalledTimes(1);

    // Another app has its own; another opening of the site, another for each.
    const other = await connection(options, { id: "app-3", name: "Cursor" });
    await other.callTool({ name: "addPage", arguments: { title: "Blog" } });
    expect(saveVersionBefore).toHaveBeenLastCalledWith("Before Cursor's changes");
    open("session-2");
    const later = await connection(options, claude);
    await later.callTool({ name: "addPage", arguments: { title: "News" } });
    expect(saveVersionBefore).toHaveBeenCalledTimes(3);
  });

  it("saves none for a plan, valid or not: the person's Allow saves one, so an invalid plan saves nothing (S26)", async () => {
    const { service, listened, saveVersionBefore, ask } = setUp();
    await service.setEnabled(true);
    const [options] = listened;
    if (options === undefined) throw new Error("not listening");
    const plan = {
      title: "Build the site",
      commands: [{ name: "addPage", input: { title: "Menu" } }],
    };

    const client = await connection(options, claude);
    await client.callTool({ name: "plan", arguments: plan });
    await client.callTool({ name: "plan", arguments: {} });
    expect(saveVersionBefore).not.toHaveBeenCalled();
    expect(ask).toHaveBeenCalled();
    // A single command still takes the app's first version.
    await client.callTool({ name: "addPage", arguments: { title: "Team" } });
    expect(saveVersionBefore).toHaveBeenCalledOnce();
  });

  it("saves none with no site open, and tries again after one that wasn't saved", async () => {
    const { service, listened, saveVersionBefore, open } = setUp();
    open(undefined);
    await service.setEnabled(true);
    const [options] = listened;
    if (options === undefined) throw new Error("not listening");
    const client = await connection(options, claude);
    await client.callTool({ name: "addPage", arguments: { title: "Team" } });
    expect(saveVersionBefore).not.toHaveBeenCalled();

    open("session-1");
    saveVersionBefore.mockResolvedValueOnce("failed");
    await client.callTool({ name: "addPage", arguments: { title: "Menu" } });
    await client.callTool({ name: "addPage", arguments: { title: "News" } });
    await client.callTool({ name: "addPage", arguments: { title: "Shop" } });
    expect(saveVersionBefore).toHaveBeenCalledTimes(2);
  });

  it("isn't saved for a brief, which is the app's by its id, not its name (4.12a)", async () => {
    const { service, listened, saveVersionBefore, briefs } = setUp();
    await service.setEnabled(true);
    const [options] = listened;
    if (options === undefined) throw new Error("not listening");

    // Removed and added again under the same name: another pairing, which can't read the first's.
    const client = await connection(options, { id: "app-2", name: "Claude" });
    await client.callTool({ name: "createSiteFromBrief", arguments: {} });
    await client.callTool({ name: "briefStatus", arguments: { briefId: "brief-1" } });

    expect(saveVersionBefore).not.toHaveBeenCalled();
    expect(briefs.ask).toHaveBeenCalledWith(expect.anything(), "app-2", expect.anything());
    expect(briefs.status).toHaveBeenCalledWith(expect.anything(), "app-2");
  });

  it("lets the command run when the version can't be saved", async () => {
    const { service, listened, saveVersionBefore, ask } = setUp();
    saveVersionBefore.mockResolvedValue("failed");
    await service.setEnabled(true);
    const [options] = listened;
    if (options === undefined) throw new Error("not listening");

    const client = await connection(options, claude);
    const result = await client.callTool({ name: "addPage", arguments: { title: "Menu" } });

    expect(result.isError).toBeUndefined();
    expect(ask).toHaveBeenCalledOnce();
  });
});
