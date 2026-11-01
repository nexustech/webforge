import { randomInt } from "node:crypto";
import type { AiApps, NewPairing, PairedApp } from "./ai-apps.js";
import type { AiBridge } from "./ai-ipc.js";
import { createAppLimits } from "./mcp-limits.js";
import { type McpListener, type McpListenerOptions, startMcpListener } from "./mcp-listener.js";
import { createMcpServer, type McpServerInfo } from "./mcp-server.js";

/** The ephemeral range a port is drawn from (ADR 0021). */
const EPHEMERAL = { from: 49152, to: 65535 } as const;

/** How many ports to try when the remembered one is taken. */
const PORT_TRIES = 5;

/** What Preferences › AI apps shows of the server. */
export type McpStatus = {
  readonly enabled: boolean;
  /** The port it listens on, while it does. */
  readonly port: number | null;
  /**
   * The remembered port was taken, and the server listens on a new one: every app has to be
   * added again with the new address (ADR 0021).
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
  /** Pairs an app (*Add AI app*). */
  add(name: string): Promise<NewPairing>;
  /** Removes an app, ending its connections at once. */
  remove(id: string): Promise<void>;
  list(): Promise<readonly PairedApp[]>;
  status(): Promise<McpStatus>;
  /** Stops listening: Webforge is quitting. */
  close(): Promise<void>;
};

/** What {@link createMcpService} works with; the listener and the port drawn are fakes in tests. */
export type McpServiceOptions = {
  readonly apps: AiApps;
  readonly ask: AiBridge["ask"];
  readonly info: McpServerInfo;
  readonly listen?: (options: McpListenerOptions) => Promise<McpListener>;
  readonly drawPort?: () => number;
};

/** Whether `error` says the port is taken. */
const taken = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "EADDRINUSE";

/**
 * The MCP server's lifecycle (ADR 0021): it listens whenever *AI apps* is on and Webforge runs,
 * whether or not a site is open (the tools answer that none is), so its port is never left free for
 * another program to take for long. The port is drawn once from the ephemeral range and
 * remembered, as the apps' configs hold it; only when it's taken is another drawn.
 */
export function createMcpService(options: McpServiceOptions): McpService {
  const { apps } = options;
  const listen = options.listen ?? startMcpListener;
  const drawPort = options.drawPort ?? (() => randomInt(EPHEMERAL.from, EPHEMERAL.to + 1));
  const limits = createAppLimits(options.ask);
  let listener: McpListener | null = null;
  let moved = false;

  const listenOn = (port: number) =>
    listen({
      port,
      authenticate: (key) => apps.authenticate(key),
      serverFor: (app) =>
        createMcpServer(options.info, app, (request) => limits.ask(app.id, request)),
    });

  const open = async () => {
    if (listener !== null) return;
    const remembered = await apps.port();
    const ports = [remembered ?? drawPort()];
    for (let n = 1; n < PORT_TRIES; n++) ports.push(drawPort());
    for (const port of ports) {
      try {
        listener = await listenOn(port);
        if (port !== remembered) await apps.setPort(port);
        moved = remembered !== null && port !== remembered;
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
    add: (name) => apps.add(name),
    async remove(id) {
      await apps.remove(id);
      limits.forget(id);
      await listener?.disconnect(id);
    },
    list: () => apps.list(),
    async status() {
      return {
        enabled: await apps.enabled(),
        port: listener?.port ?? null,
        moved,
        connected: listener?.connectedApps() ?? [],
      };
    },
    close: shut,
  };
}
