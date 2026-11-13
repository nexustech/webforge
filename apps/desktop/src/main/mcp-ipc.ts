import { t } from "@webforge/i18n";
import type { IpcMain } from "electron";
import type {
  McpAddResult,
  McpInstallResult,
  McpStatus,
  McpVsCodeResult,
} from "../shared/ipc/mcp.js";
import { vsCodeInstallLink } from "../shared/mcp-setup.js";
import type { ClaudeExtensions } from "./claude-extension.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import { MCP_HOST, MCP_PATH } from "./mcp-address.js";
import type { McpService } from "./mcp-service.js";

/** The address AI apps reach Webforge at on `port`. */
const addressAt = (port: number) => `http://${MCP_HOST}:${port}${MCP_PATH}`;

/** AI apps as the window shows them: the service's status, with each paired app. */
async function statusOf(service: McpService): Promise<McpStatus> {
  const [status, apps] = await Promise.all([service.status(), service.list()]);
  const connected = new Set(status.connected);
  return {
    enabled: status.enabled,
    address: status.port === null ? null : addressAt(status.port),
    moved: status.moved,
    apps: apps.map((app) => ({
      id: app.id,
      name: app.name,
      claimed: app.claimedAt !== null,
      connected: connected.has(app.id),
    })),
  };
}

/**
 * Registers the `mcp` IPC calls (4.9): AI apps on or off, paired, listed and removed, through
 * `service`; Claude Desktop's extension written through `extensions`; and VS Code's install link
 * opened through `openExternal` (5.13). A key leaves main once, in *Add AI app*'s answer, for the
 * person to copy; nothing of it is logged.
 */
export function registerMcpHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  service: McpService,
  extensions: Pick<ClaudeExtensions, "install" | "remove">,
  openExternal: (url: string) => Promise<void>,
): void {
  registerIpcHandler(ipc, "mcpStatus", isTrustedSender, () => statusOf(service));
  registerIpcHandler(ipc, "mcpSetEnabled", isTrustedSender, async (enabled) => {
    try {
      await service.setEnabled(enabled);
    } catch (error) {
      // No free port, or the listener couldn't start: the status says it isn't listening.
      logFailure("mcp set enabled", error);
    }
    return statusOf(service);
  });
  registerIpcHandler(ipc, "mcpSeenMoved", isTrustedSender, async () => {
    await service.seenMoved();
    return null;
  });
  registerIpcHandler(ipc, "mcpAdd", isTrustedSender, async (name, kind): Promise<McpAddResult> => {
    const status = await service.status();
    if (status.port === null) return { status: "off" };
    try {
      const pairing = await service.add(name, kind);
      if (pairing.status !== "paired") return { status: pairing.status };
      return {
        status: "paired",
        app: { id: pairing.app.id, name: pairing.app.name, claimed: false, connected: false },
        key: pairing.key,
        address: addressAt(status.port),
      };
    } catch (error) {
      // The credential store couldn't keep the key (CredentialError): nothing is paired.
      logFailure("mcp add", error);
      return { status: "failed" };
    }
  });
  registerIpcHandler(
    ipc,
    "mcpInstallClaude",
    isTrustedSender,
    async (id): Promise<McpInstallResult> => {
      const { port } = await service.status();
      if (port === null) return { status: "off" };
      try {
        // Not listed: removed, or its key waited too long and it went.
        const app = (await service.list()).find((each) => each.id === id);
        const proof = app === undefined ? null : await service.proofOf(id);
        if (app === undefined || proof === null) return { status: "unknown" };
        const { outcome } = await extensions.install({
          appId: id,
          address: addressAt(port),
          proof,
          pairedAt: app.pairedAt,
        });
        return { status: outcome };
      } catch (error) {
        logFailure("mcp claude extension", error);
        return { status: "failed" };
      }
    },
  );
  registerIpcHandler(
    ipc,
    "mcpInstallVsCode",
    isTrustedSender,
    async (id): Promise<McpVsCodeResult> => {
      const { port } = await service.status();
      if (port === null) return { status: "off" };
      // Not listed: removed, or its key waited too long and it went.
      if (!(await service.list()).some((app) => app.id === id)) return { status: "unknown" };
      try {
        await openExternal(vsCodeInstallLink(addressAt(port), t("aiApps.vscode.prompt")));
        return { status: "opened" };
      } catch (error) {
        // Nothing handles `vscode:` links: VS Code isn't installed?
        logFailure("mcp vscode link", error);
        return { status: "failed" };
      }
    },
  );
  registerIpcHandler(ipc, "mcpRemove", isTrustedSender, async (id) => {
    await service.remove(id);
    // Its extension goes too: its proof is no use without the app, but nothing is left behind.
    await extensions
      .remove(id)
      .catch((error: unknown) => logFailure("mcp claude extension", error));
    return statusOf(service);
  });
}
