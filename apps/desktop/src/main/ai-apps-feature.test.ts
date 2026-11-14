import type { IpcMain } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveVersionResult } from "../shared/ipc/versions.js";
import { type AiAppsFeatureDeps, aiAppsFeature } from "./ai-apps-feature.js";
import type { CredentialStore } from "./credential-store.js";
import type { McpServiceOptions } from "./mcp-service.js";

const mcp = vi.hoisted(() => ({
  options: undefined as McpServiceOptions | undefined,
  start: vi.fn(async () => undefined),
  close: vi.fn(async () => undefined),
  connectAssistant: vi.fn(async () => ({ client: {}, close: async () => undefined })),
}));
vi.mock("./mcp-service.js", () => ({
  createMcpService: (options: McpServiceOptions) => {
    mcp.options = options;
    return { start: mcp.start, close: mcp.close, connectAssistant: mcp.connectAssistant };
  },
}));
const sweep = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("./claude-extension.js", () => ({
  createClaudeExtensions: () => ({ sweep, install: vi.fn(), remove: vi.fn() }),
}));

const OPENING = "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d";

/** AI apps, with the site `open` (or none) and Version History answering `saved`. */
function setUp(open: boolean, saved: SaveVersionResult = { status: "skipped" }) {
  const channels: string[] = [];
  const ipc = {
    handle: (channel: string) => channels.push(channel),
  } as unknown as Pick<IpcMain, "handle">;
  const saveVersionBefore = vi.fn(async () => saved);
  const deps: AiAppsFeatureDeps = {
    userData: "/no/such/folder",
    packaged: true,
    bridgeFile: "/no/such/bridge.mjs",
    info: { name: "Webforge", version: "1.0.0" },
    window: () => undefined,
    site: {
      staleReason: () => undefined,
      current: () => (open ? { sessionId: OPENING } : null),
    },
    credentials: {} as CredentialStore,
    templates: () => [],
    versions: { saveVersionBefore },
    shell: () => ({ openPath: vi.fn(), showItemInFolder: vi.fn(), openExternal: vi.fn() }),
  };
  return { feature: aiAppsFeature(deps), ipc, channels, saveVersionBefore };
}

beforeEach(() => {
  mcp.options = undefined;
  vi.clearAllMocks();
});

describe("aiAppsFeature (4.9, #985)", () => {
  it("has no tools for the assistant before Electron is ready, and nothing to close", async () => {
    const { feature } = setUp(true);

    await expect(feature.connectAssistant(async () => undefined)).rejects.toThrow(
      "The MCP service isn't there",
    );
    feature.cancel("assistant");
    await feature.close();
    expect(mcp.close).not.toHaveBeenCalled();
  });

  it("registers AI apps' calls, starts the MCP server and clears last session's extensions", () => {
    const { feature, ipc, channels } = setUp(true);

    feature.register?.(ipc, () => true);

    expect(channels).toEqual(
      expect.arrayContaining([
        "ai:answer",
        "ai:listening",
        "ai:brief-answer",
        "mcp:status",
        "mcp:set-enabled",
      ]),
    );
    expect(mcp.start).toHaveBeenCalledOnce();
    expect(sweep).toHaveBeenCalledOnce();
    expect(mcp.options?.opening()).toBe(OPENING);
  });

  it("gives the assistant the MCP server's tools, and closes the server when asked", async () => {
    const { feature, ipc } = setUp(true);
    feature.register?.(ipc, () => true);
    const beforeCommand = async () => undefined;

    await feature.connectAssistant(beforeCommand, "draft");
    await feature.close();

    expect(mcp.connectAssistant).toHaveBeenCalledWith(beforeCommand, "draft");
    expect(mcp.close).toHaveBeenCalledOnce();
  });

  it("saves a version of the open site before an app's changes: one held counts as saved", async () => {
    const held = setUp(true, { status: "skipped" });
    held.feature.register?.(held.ipc, () => true);
    expect(await mcp.options?.saveVersionBefore("Before Claude's changes")).toBe("saved");
    expect(held.saveVersionBefore).toHaveBeenCalledWith(OPENING, "Before Claude's changes");

    const failed = setUp(true, { status: "failed", reason: "read-only" });
    failed.feature.register?.(failed.ipc, () => true);
    expect(await mcp.options?.saveVersionBefore("Before Claude's changes")).toBe("failed");
  });

  it("saves no version with no site open", async () => {
    const { feature, ipc, saveVersionBefore } = setUp(false);
    feature.register?.(ipc, () => true);

    expect(await mcp.options?.saveVersionBefore("Before Claude's changes")).toBe("failed");
    expect(saveVersionBefore).not.toHaveBeenCalled();
  });
});
