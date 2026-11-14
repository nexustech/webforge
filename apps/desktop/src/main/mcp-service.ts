import { randomInt } from "node:crypto";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { t } from "@webforge/i18n";
import type { AiRequest, AiResponse } from "../shared/ipc/ai.js";
import type { AiApps, AppKind, PairedApp, Pairing } from "./ai-apps.js";
import type { AiBridge } from "./ai-ipc.js";
import { logFailure } from "./log.js";
import { createAppLimits } from "./mcp-limits.js";
import type { McpListener, McpListenerOptions } from "./mcp-listener.js";
import type { McpApp, McpServerInfo } from "./mcp-server.js";
import { isMainTool, type MainToolName, type SiteBriefs } from "./site-brief.js";

/** The ephemeral range a port is drawn from (ADR 0021). */
const EPHEMERAL = { from: 49152, to: 65535 } as const;

/** How many ports to try when the remembered one is taken. */
const PORT_TRIES = 5;

/** What AI apps shows of the server. */
export type McpServiceStatus = {
  readonly enabled: boolean;
  /** The port it listens on, while it does. */
  readonly port: number | null;
  /**
   * The remembered port was taken, and the server listens on a new one: every app has to be
   * added again with the new address (ADR 0021), and those that connect directly were removed
   * (S27). Kept until the person has seen it.
   */
  readonly moved: boolean;
  /** The ids of the apps with a connection now. */
  readonly connected: readonly string[];
};

/** The MCP server as Webforge runs it (4.9, ADR 0021). */
export type McpService = {
  /** Starts listening if *AI apps* is on: as Webforge starts. */
  start(): Promise<void>;
  /** Turns *AI apps* on or off: listening, or not, at once. */
  setEnabled(enabled: boolean): Promise<void>;
  /** Pairs an app (*Add AI app*): Claude Desktop through its extension, or another directly. */
  add(name: string, kind: AppKind): Promise<Pairing>;
  /** The person has seen that the port moved: AI apps stops saying so. */
  seenMoved(): Promise<void>;
  /** Removes an app, ending its connections at once. */
  remove(id: string): Promise<void>;
  list(): Promise<readonly PairedApp[]>;
  /** The server proof of paired app `id`, which its Claude Desktop extension holds; or `null`. */
  proofOf(id: string): Promise<string | null>;
  status(): Promise<McpServiceStatus>;
  /**
   * Connects the in-app assistant to the tool layer (6.9b, ADR 0026 §1): an MCP client on the SDK's
   * in-memory transport, through the same limits and window as AI apps, with *AI apps* on or off.
   * `beforeCommand` runs before each of its commands, other than a plan, which asks the person and
   * saves its own version: the assistant's safety version, once a conversation.
   */
  connectAssistant(beforeCommand: () => Promise<void>): Promise<AssistantConnection>;
  /** Stops listening: Webforge is quitting. */
  close(): Promise<void>;
};

/** The assistant's connection to the tool layer: its MCP client, until closed. */
type AssistantConnection = { readonly client: Client; close(): Promise<void> };

/** What {@link createMcpService} works with; the listener and the port drawn are fakes in tests. */
export type McpServiceOptions = {
  readonly apps: AiApps;
  readonly ask: AiBridge["ask"];
  readonly info: McpServerInfo;
  /**
   * Saves an automatic version of the open site named `name`, after the window's last edits
   * (reason `before-site-wide`): the one taken before an app's first change in each opening of the
   * site (S20, S26). Version History's own (4.6a).
   */
  readonly saveVersionBefore: (name: string) => Promise<"saved" | "failed">;
  /** The opening of the site open now (its session id), or undefined while none is. */
  readonly opening: () => string | undefined;
  /** AI apps' briefs (4.12a), which main answers itself: no site need be open. */
  readonly briefs: Pick<SiteBriefs, "ask" | "choices" | "status">;
  readonly listen?: (options: McpListenerOptions) => Promise<McpListener>;
  readonly drawPort?: () => number;
};

/** What main answers each of its own tools with (4.12a): a tool without one fails typecheck (#978). */
type MainToolHandlers = {
  readonly [name in MainToolName]: (
    briefs: McpServiceOptions["briefs"],
    request: AiRequest,
    app: string,
    signal: AbortSignal | undefined,
  ) => AiResponse | Promise<AiResponse>;
};

const MAIN_TOOL_HANDLERS: MainToolHandlers = {
  siteChoices: (briefs) => briefs.choices(),
  createSiteFromBrief: (briefs, request, app, signal) => briefs.ask(request.input, app, signal),
  briefStatus: (briefs, request, app) => briefs.status(request.input, app),
};

/**
 * Main's answer to `request` from paired app `app`, by the tool's name: a name that isn't one of
 * `MAIN_TOOLS` is refused, never taken for a brief (#978).
 */
export async function answerMainTool(
  briefs: McpServiceOptions["briefs"],
  request: AiRequest,
  app: string,
  signal?: AbortSignal,
): Promise<AiResponse> {
  if (!isMainTool(request.name)) return { status: "invalid", message: "There is no such tool." };
  return MAIN_TOOL_HANDLERS[request.name](briefs, request, app, signal);
}

/**
 * Whether `error` says the port can't be had: in use, or (on Windows, where Hyper-V, WSL or Docker
 * reserve blocks of ports) not allowed (5.6). Either way another port is drawn.
 */
const taken = (error: unknown) => {
  const code =
    typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return code === "EADDRINUSE" || code === "EACCES";
};

/**
 * The MCP server's lifecycle (ADR 0021): it listens whenever *AI apps* is on and Webforge runs,
 * whether or not a site is open (the tools answer that none is), so its port is never left free for
 * another program to take for long. The port is drawn once from the ephemeral range and
 * remembered, as the apps' configs hold it; only when it's taken is another drawn.
 */
export function createMcpService(options: McpServiceOptions): McpService {
  const { apps } = options;
  const drawPort = options.drawPort ?? (() => randomInt(EPHEMERAL.from, EPHEMERAL.to + 1));
  const limits = createAppLimits(options.ask);

  /** Main's own tools (4.12a), for `app`: a brief, its status, and what it chooses from. */
  const mainTool =
    (app: McpApp, signal: AbortSignal | undefined) =>
    async (request: AiRequest): Promise<AiResponse> =>
      answerMainTool(options.briefs, request, app.id, signal);
  let listener: McpListener | null = null;
  /**
   * The version "Before ‹app›'s changes" saved, or being saved, for each app in each opening of
   * the site, by `<app id> <session id>`: one an app's reconnections can't add to (S26).
   */
  const firstVersions = new Map<string, Promise<boolean>>();

  /**
   * `app`'s requests in one connection: before its first command in this opening of the site, a
   * version "Before ‹app›'s changes", so a burst of changes can't push the site as it was past the
   * undo limit (S20). Once per app per opening, not per connection: an app reconnecting can't
   * push that version out of the ones kept with versions of its own (S26). A plan (4.12a) takes
   * no version of its own here: it always asks, and the person's Allow saves one (the window's
   * BeforeSiteWideAction), so a plan refused as invalid saves nothing (S26, AIB-6 amended). A
   * command still runs when the version can't be saved, which is logged by its code alone.
   */
  const askFor = (app: McpApp) => {
    // Once a command is let through its limits: one refused for its rate takes no version.
    const saveVersion = () =>
      options
        .saveVersionBefore(t("ai.version.before", { app: app.name }))
        .catch(() => "failed" as const)
        .then((result) => {
          if (result === "failed") logFailure("mcp safety version", new Error("failed"));
          return result === "saved";
        });
    const versionFirst = async () => {
      const opening = options.opening();
      // With no site open there is nothing to keep, and the command changes nothing.
      if (opening === undefined) return;
      const key = `${app.id} ${opening}`;
      let saved = firstVersions.get(key);
      if (saved === undefined) {
        saved = saveVersion();
        firstVersions.set(key, saved);
        // One that wasn't saved added nothing: the app's next command tries again.
        void saved.then((ok) => {
          if (!ok) firstVersions.delete(key);
        });
      }
      await saved;
    };
    return askWith(app, versionFirst);
  };

  /** `app`'s requests, with `before` run ahead of each command but a plan's. */
  const askWith =
    (app: McpApp, before: () => Promise<void>) =>
    (request: AiRequest, signal?: AbortSignal): Promise<AiResponse> =>
      isMainTool(request.name)
        ? // A brief changes no open site: no version before it.
          limits.ask(app.id, request, undefined, mainTool(app, signal))
        : limits.ask(
            app.id,
            request,
            request.kind !== "command" || request.name === "plan" ? undefined : before,
          );

  /**
   * A paired app's server proof, looked up only for an app in the list: a caller naming made-up
   * ids reaches neither the credential store nor its cache, which would grow with each (ADR 0021).
   * Not an app whose key waited too long, either, though its secret is still known.
   */
  const proofOf = async (id: string) =>
    (await apps.list()).some((app) => app.id === id) ? apps.proofOf(id) : null;

  const listenOn = async (port: number) => {
    // The server and its listener, with the MCP SDK and the commands' catalogue, load once AI apps
    // are on, not with main at start-up (#892).
    const [{ startMcpListener }, { createMcpServer }] = await Promise.all([
      import("./mcp-listener.js"),
      import("./mcp-server.js"),
    ]);
    return (options.listen ?? startMcpListener)({
      port,
      authenticate: (key) => apps.authenticate(key),
      proofOf,
      serverFor: (app) => createMcpServer(options.info, app, askFor(app)),
    });
  };

  const open = async () => {
    if (listener !== null) return;
    const remembered = await apps.port();
    const ports = [remembered ?? drawPort()];
    for (let n = 1; n < PORT_TRIES; n++) ports.push(drawPort());
    for (const port of ports) {
      try {
        listener = await listenOn(port);
        if (port !== remembered) await apps.setPort(port);
        if (remembered !== null && port !== remembered) {
          // Whatever took the old port may have been sent the keys of apps that connect directly:
          // they're revoked, and the person is told (S27).
          for (const id of await apps.movedFrom()) limits.forget(id);
        }
        return;
      } catch (error) {
        if (!taken(error)) throw error;
      }
    }
    throw new Error("No free port for the MCP server");
  };

  const shut = async () => {
    const closing = listener;
    listener = null;
    await closing?.close();
  };

  return {
    async start() {
      if (await apps.enabled()) await open();
    },
    async setEnabled(enabled) {
      await apps.setEnabled(enabled);
      if (enabled) await open();
      else await shut();
    },
    add: (name, kind) => apps.add(name, kind),
    seenMoved: () => apps.seenMoved(),
    async remove(id) {
      await apps.remove(id);
      limits.forget(id);
      await listener?.disconnect(id);
    },
    list: () => apps.list(),
    proofOf,
    async status() {
      return {
        enabled: await apps.enabled(),
        port: listener?.port ?? null,
        moved: await apps.moved(),
        connected: listener?.connectedApps() ?? [],
      };
    },
    async connectAssistant(beforeCommand) {
      // Loaded once the assistant first answers, not with main at start-up (#892).
      const [{ assistantApp, createAssistantMcpServer }, { Client }, { InMemoryTransport }] =
        await Promise.all([
          import("./mcp-server.js"),
          import("@modelcontextprotocol/sdk/client/index.js"),
          import("@modelcontextprotocol/sdk/inMemory.js"),
        ]);
      const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
      const server = createAssistantMcpServer(options.info, askWith(assistantApp(), beforeCommand));
      await server.connect(serverSide);
      const client = new Client(options.info);
      await client.connect(clientSide);
      return {
        client,
        async close() {
          await client.close();
          await server.close();
        },
      };
    },
    close: shut,
  };
}
