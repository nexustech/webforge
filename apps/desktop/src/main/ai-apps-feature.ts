import { join } from "node:path";
import type { Shell } from "electron";
import { aiAppsFileSchema, createAiApps, NO_AI_APPS } from "./ai-apps.js";
import {
  type AiBridge,
  type AiSite,
  type AiWindow,
  exposeForE2eTests,
  registerAiHandlers,
} from "./ai-ipc.js";
import type { AppFeature } from "./app-feature.js";
import { createClaudeExtensions } from "./claude-extension.js";
import type { CredentialStore } from "./credential-store.js";
import { createJsonStore } from "./json-store.js";
import { logFailure } from "./log.js";
import { registerMcpHandlers } from "./mcp-ipc.js";
import type { McpServerInfo } from "./mcp-server.js";
import { createMcpService, type McpService } from "./mcp-service.js";
import { createSiteBriefs, type SiteBriefsOptions } from "./site-brief.js";
import type { Versions } from "./versions-ipc.js";

/** What AI apps reach Webforge with (4.8, 4.9, 4.12a, #985). */
export type AiAppsFeatureDeps = {
  /** The person's own data folder: the paired apps' list and Claude Desktop's extensions. */
  readonly userData: string;
  /** Whether this is the installed app: E2E tests reach the bridge only in one that isn't. */
  readonly packaged: boolean;
  /** The bundled bridge Claude Desktop's extensions run (`webforge-bridge.mjs`). */
  readonly bridgeFile: string;
  readonly info: McpServerInfo;
  /** The editor's window, which answers AI apps' requests and shows their briefs. */
  readonly window: () => AiWindow | undefined;
  /** The open site: whether a window's opening is still its own, and which opening it is. */
  readonly site: AiSite & { current(): { readonly sessionId: string } | null };
  readonly credentials: CredentialStore;
  readonly templates: SiteBriefsOptions["templates"];
  readonly versions: Pick<Versions, "saveVersionBefore">;
  /** Looked up as each is called: the E2E tests stand in for Claude Desktop and the browser. */
  readonly shell: () => Pick<Shell, "openPath" | "showItemInFolder" | "openExternal">;
};

/** AI apps, with the calls the assistant makes on the same tools. */
export type AiAppsFeature = AppFeature & {
  /** The assistant's connection to the tools AI apps use (6.9b, ADR 0026 §1). */
  connectAssistant: McpService["connectAssistant"];
  /** Gives up on the requests of the app with id `appId` waiting for the window. */
  cancel(appId: string): void;
  /** Stops the MCP server, before the site closes: no AI app's request reaches a closing site. */
  close(): Promise<void>;
};

/**
 * AI apps (4.8, 4.9, ADR 0021, #985): their requests go to the open site's window (F-AI-1), their
 * briefs show in it as the quick start (4.12a), and they reach Webforge through the MCP server
 * while *AI apps* is on. Claude Desktop's extensions are written in the person's own profile.
 */
export function aiAppsFeature(deps: AiAppsFeatureDeps): AiAppsFeature {
  let bridge: AiBridge | undefined;
  let mcp: McpService | undefined;
  return {
    register(ipc, isTrustedSender) {
      const ai = registerAiHandlers(ipc, isTrustedSender, deps.window, deps.site);
      bridge = ai;
      exposeForE2eTests(ai, deps.packaged);
      const briefs = createSiteBriefs({ window: deps.window, templates: deps.templates });
      briefs.register(ipc, isTrustedSender);
      // Nothing listens until the person turns *AI apps* on.
      const service = createMcpService({
        apps: createAiApps(
          createJsonStore(join(deps.userData, "ai-apps.json"), aiAppsFileSchema, {
            empty: NO_AI_APPS,
            onDamaged: "move-aside",
          }),
          deps.credentials,
        ),
        ask: (request) => ai.ask(request),
        briefs,
        info: deps.info,
        // Version History's, for the site open now: none to save without one.
        saveVersionBefore: async (name) => {
          const open = deps.site.current();
          if (open === null) return "failed";
          // One from the last few minutes holds the site from before the changes already.
          const saved = await deps.versions.saveVersionBefore(open.sessionId, name);
          return saved.status === "failed" ? "failed" : "saved";
        },
        opening: () => deps.site.current()?.sessionId,
      });
      mcp = service;
      void service.start().catch((error: unknown) => logFailure("mcp start", error));
      const extensions = createClaudeExtensions({
        dir: join(deps.userData, "ai-apps"),
        bridgeFile: deps.bridgeFile,
        version: deps.info.version,
        open: (path) => deps.shell().openPath(path),
        show: (path) => deps.shell().showItemInFolder(path),
      });
      // Any left when Webforge last quit, with their proofs: they've been opened, or never will be.
      void extensions.sweep().catch((error: unknown) => logFailure("mcp claude extension", error));
      registerMcpHandlers(ipc, isTrustedSender, service, extensions, (url) =>
        deps.shell().openExternal(url),
      );
    },
    async connectAssistant(beforeCommand, stage) {
      if (mcp === undefined) throw new Error("The MCP service isn't there");
      return mcp.connectAssistant(beforeCommand, stage);
    },
    cancel(appId) {
      bridge?.cancel(appId);
    },
    async close() {
      await mcp?.close().catch((error: unknown) => logFailure("mcp close", error));
    },
  };
}
