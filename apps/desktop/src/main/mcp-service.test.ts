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
function setUp(busy: readonly number[] = [], drawn: readonly number[] = [50_001, 50_002]) {
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
    if (busy.includes(options.port))
      throw Object.assign(new Error("taken"), { code: "EADDRINUSE" });
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
  const ask = vi.fn(async (): Promise<AiResponse> => ({ status: "done", data: {} }));
  const service = createMcpService({
    apps,
    ask,
    info: { name: "Webforge", version: "1" },
    saveVersionBefore,
    briefs: {
      ask: vi.fn(async () => ({ status: "declined", message: "closed" }) as const),
      choices: () => ({ status: "done", data: siteChoices([]) }) as const,
    },
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
    closed: () => closed,
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

  it("starts listening as Webforge starts, if AI apps was left on", async () => {
    const { apps, service } = setUp();
    await apps.setEnabled(true);

    await service.start();

    expect((await service.status()).port).toBe(50_001);
  });

  it("cuts a removed app off at once", async () => {
    const { apps, service, disconnected } = setUp();
    await service.setEnabled(true);
    const pairing = await service.add("Claude");
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
    const pairing = await service.add("Claude Desktop");
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

  it("is saved before each connection's first command, once, and never for a query", async () => {
    const { service, listened, saveVersionBefore, ask } = setUp();
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

    // Another connection, another version before its first change.
    const second = await connection(options, claude);
    await second.callTool({ name: "addPage", arguments: { title: "Shop" } });
    expect(saveVersionBefore).toHaveBeenCalledTimes(2);
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
