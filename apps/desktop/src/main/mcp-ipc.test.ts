import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { PairedApp, Pairing } from "./ai-apps.js";
import type { ExtensionPairing } from "./claude-extension.js";
import { registerMcpHandlers } from "./mcp-ipc.js";
import type { McpService, McpServiceStatus } from "./mcp-service.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const CLAUDE: PairedApp = {
  id: "0b0c8f4e-2a6d-4c1e-9e10-3f6b1b2c4d5e",
  name: "Claude",
  pairedAt: 1,
  claimedAt: 2,
};
const KEY = "k".repeat(43);

/** A service whose status, apps and answers a test sets. */
function fakeService(status: Partial<McpServiceStatus> = {}) {
  let current: McpServiceStatus = {
    enabled: true,
    port: 51_234,
    moved: false,
    connected: [],
    ...status,
  };
  let apps: PairedApp[] = [CLAUDE];
  const service = {
    start: vi.fn(async () => undefined),
    setEnabled: vi.fn(async (enabled: boolean) => {
      current = { ...current, enabled, port: enabled ? 51_234 : null };
    }),
    seenMoved: vi.fn(async () => undefined),
    add: vi.fn(
      async (name: string): Promise<Pairing> => ({
        status: "paired",
        app: { id: "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5", name, pairedAt: 3, claimedAt: null },
        key: KEY,
        proof: "p".repeat(43),
      }),
    ),
    remove: vi.fn(async (id: string) => {
      apps = apps.filter((app) => app.id !== id);
    }),
    list: vi.fn(async () => apps),
    proofOf: vi.fn(async (id: string) =>
      apps.some((app) => app.id === id) ? "p".repeat(43) : null,
    ),
    status: vi.fn(async () => current),
    close: vi.fn(async () => undefined),
  } satisfies McpService;
  return service;
}

/** Claude Desktop's extensions, written nowhere: what they were asked to do is kept. */
function fakeExtensions(outcome: "opened" | "shown" | Error = "opened") {
  return {
    install: vi.fn(async (pairing: ExtensionPairing) => {
      if (outcome instanceof Error) throw outcome;
      return { file: `${pairing.appId}.mcpb`, outcome };
    }),
    remove: vi.fn(async () => undefined),
  };
}

/** Each channel's handler, called as from a renderer that `trusted` says it trusts or not. */
function handlers(
  service: McpService,
  trusted = true,
  extensions = fakeExtensions(),
  openExternal: (url: string) => Promise<void> = async () => undefined,
) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerMcpHandlers(ipc, () => trusted, service, extensions, openExternal);
  return (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
}

describe("the mcp IPC calls (4.9)", () => {
  it("shows AI apps: on, at which address, each app and whether it's connected", async () => {
    const call = handlers(fakeService({ connected: [CLAUDE.id] }));

    expect(await call("mcp:status")).toEqual({
      enabled: true,
      address: "http://127.0.0.1:51234/mcp",
      moved: false,
      apps: [{ id: CLAUDE.id, name: "Claude", claimed: true, connected: true }],
    });
  });

  it("pairs an app while on, with its key once and the address to give it", async () => {
    const service = fakeService();
    const call = handlers(service);

    expect(await call("mcp:add", "Cursor", "other")).toEqual({
      status: "paired",
      app: expect.objectContaining({ name: "Cursor", claimed: false, connected: false }),
      key: KEY,
      address: "http://127.0.0.1:51234/mcp",
    });
    service.add.mockResolvedValueOnce({ status: "name-taken" });
    expect(await call("mcp:add", "Claude", "claude")).toEqual({ status: "name-taken" });
  });

  it("pairs nothing while off, nor when the key can't be kept", async () => {
    expect(
      await handlers(fakeService({ enabled: false, port: null }))("mcp:add", "Cursor", "other"),
    ).toEqual({ status: "off" });
    const service = fakeService();
    service.add.mockRejectedValueOnce(new Error("encryption-unavailable"));
    expect(await handlers(service)("mcp:add", "Cursor", "other")).toEqual({ status: "failed" });
  });

  it("turns AI apps on and off, and says so even when it couldn't start listening", async () => {
    const service = fakeService({ enabled: false, port: null });
    const call = handlers(service);

    expect(await call("mcp:set-enabled", true)).toMatchObject({ enabled: true });
    expect(await call("mcp:set-enabled", false)).toMatchObject({ enabled: false, address: null });
    service.setEnabled.mockRejectedValueOnce(new Error("No free port"));
    expect(await call("mcp:set-enabled", true)).toMatchObject({ address: null });
  });

  it("removes an app, and its Claude Desktop extension", async () => {
    const service = fakeService();
    const extensions = fakeExtensions();

    expect(await handlers(service, true, extensions)("mcp:remove", CLAUDE.id)).toMatchObject({
      apps: [],
    });
    expect(service.remove).toHaveBeenCalledWith(CLAUDE.id);
    expect(extensions.remove).toHaveBeenCalledWith(CLAUDE.id);
  });

  it("writes a paired app's Claude Desktop extension with the address and its proof, and opens it", async () => {
    const extensions = fakeExtensions();
    const call = handlers(fakeService(), true, extensions);

    expect(await call("mcp:install-claude", CLAUDE.id)).toEqual({ status: "opened" });
    expect(extensions.install).toHaveBeenCalledWith({
      appId: CLAUDE.id,
      address: "http://127.0.0.1:51234/mcp",
      proof: "p".repeat(43),
      pairedAt: CLAUDE.pairedAt,
    });
  });

  it("says when nothing opened the extension, and why none was written", async () => {
    expect(
      await handlers(fakeService(), true, fakeExtensions("shown"))("mcp:install-claude", CLAUDE.id),
    ).toEqual({ status: "shown" });
    expect(await handlers(fakeService({ port: null }))("mcp:install-claude", CLAUDE.id)).toEqual({
      status: "off",
    });
    expect(
      await handlers(fakeService())("mcp:install-claude", "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5"),
    ).toEqual({ status: "unknown" });
    expect(
      await handlers(
        fakeService(),
        true,
        fakeExtensions(new Error("EACCES")),
      )("mcp:install-claude", CLAUDE.id),
    ).toEqual({ status: "failed" });
  });

  it("opens VS Code's install link for a paired app, at the address, with no key (5.13)", async () => {
    const opened: string[] = [];
    const call = handlers(fakeService(), true, fakeExtensions(), async (url) => {
      opened.push(url);
    });

    expect(await call("mcp:install-vscode", CLAUDE.id)).toEqual({ status: "opened" });
    expect(opened).toHaveLength(1);
    const [link] = opened;
    expect(link).toMatch(/^vscode:mcp\/install\?/);
    const server = JSON.parse(decodeURIComponent(link?.split("?")[1] ?? ""));
    expect(server).toMatchObject({ url: "http://127.0.0.1:51234/mcp" });
    expect(link).not.toContain(KEY);
    expect(link).not.toContain("p".repeat(43));
  });

  it("opens no link while off or for an app that's gone, and says when nothing opened it", async () => {
    const openExternal = vi.fn(async () => undefined);
    expect(
      await handlers(
        fakeService({ port: null }),
        true,
        fakeExtensions(),
        openExternal,
      )("mcp:install-vscode", CLAUDE.id),
    ).toEqual({ status: "off" });
    expect(
      await handlers(
        fakeService(),
        true,
        fakeExtensions(),
        openExternal,
      )("mcp:install-vscode", "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5"),
    ).toEqual({ status: "unknown" });
    expect(openExternal).not.toHaveBeenCalled();
    expect(
      await handlers(fakeService(), true, fakeExtensions(), async () => {
        throw new Error("No application is associated with the specified file");
      })("mcp:install-vscode", CLAUDE.id),
    ).toEqual({ status: "failed" });
  });

  it("checks what it's given, and refuses a renderer it doesn't trust", async () => {
    const call = handlers(fakeService());
    await expect(call("mcp:remove", "not an id")).rejects.toThrow();
    await expect(call("mcp:install-vscode", "https://example.com")).rejects.toThrow();
    await expect(call("mcp:set-enabled", "yes")).rejects.toThrow();
    await expect(handlers(fakeService(), false)("mcp:status")).rejects.toThrow();
  });
});
