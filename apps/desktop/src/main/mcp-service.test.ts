import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it, vi } from "vitest";
import { aiAppsFileSchema, createAiApps, NO_AI_APPS } from "./ai-apps.js";
import { createCredentialStore, type SecretCipher } from "./credential-store.js";
import { createJsonStore } from "./json-store.js";
import type { McpListener, McpListenerOptions } from "./mcp-listener.js";
import { createMcpService } from "./mcp-service.js";

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
  const service = createMcpService({
    apps,
    ask: async () => ({ status: "done", data: {} }),
    info: { name: "Webforge", version: "1" },
    listen,
    drawPort: () => ports.shift() ?? 59_999,
  });
  return { apps, service, listen, listened, disconnected, closed: () => closed };
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
    const { app, key } = await service.add("Claude");

    await service.remove(app.id);

    expect(disconnected).toEqual([app.id]);
    expect(await service.list()).toEqual([]);
    expect(await apps.authenticate(key)).toBeUndefined();
  });
});
