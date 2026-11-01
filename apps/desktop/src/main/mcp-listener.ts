import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { AI_INPUT_MAX_CHARS } from "../shared/ipc/ai.js";
import type { McpApp } from "./mcp-server.js";

/** The one address AI apps reach: the literal loopback address, never a name (ADR 0021). */
export const MCP_HOST = "127.0.0.1";

/** The one path the server answers. */
export const MCP_PATH = "/mcp";

/** The most a request's body may hold: an AI request's input, with room for its envelope. */
const MAX_BODY_BYTES = AI_INPUT_MAX_CHARS * 4 + 64 * 1024;

/** A key as `Authorization: Bearer` carries it: 256 bits or more, base64url (ADR 0021). */
const BEARER = /^Bearer ([A-Za-z0-9_-]{43,128})$/;

/** What the listener works with. */
export type McpListenerOptions = {
  /** The port to listen on: the remembered one, or 0 for any (tests). */
  readonly port: number;
  /** The paired app a key belongs to, if any; how failures back off is its own (ADR 0021). */
  readonly authenticate: (key: string) => Promise<McpApp | undefined>;
  /** The MCP server for one connection of `app` (`createMcpServer`). */
  readonly serverFor: (app: McpApp) => Server;
};

/** A listener started by {@link startMcpListener}. */
export type McpListener = {
  /** The port it listens on. */
  readonly port: number;
  /** The ids of the apps with a connection now, for the status indicator. */
  connectedApps(): readonly string[];
  /** Ends `appId`'s connections: it was removed (ADR 0021). */
  disconnect(appId: string): Promise<void>;
  /** Stops listening, ending every connection. */
  close(): Promise<void>;
};

/** One MCP session: its transport and server, and the app it's for. */
type Session = {
  readonly transport: StreamableHTTPServerTransport;
  readonly server: Server;
  readonly app: McpApp;
};

/** Answers `status` with nothing more: no detail of why reaches a caller. */
function refuse(res: ServerResponse, status: number): void {
  res.writeHead(status, { "content-type": "text/plain" }).end();
}

/**
 * `req`'s body as JSON, or why not: too large (413), not JSON (400). Past the cap it keeps only
 * reading, keeping nothing, so the caller gets its answer rather than a reset connection.
 */
function bodyOf(req: IncomingMessage): Promise<{ readonly json: unknown } | number> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        resolve(413);
      } else {
        chunks.push(chunk);
      }
    });
    req.on("error", () => resolve(400));
    req.on("end", () => {
      if (size > MAX_BODY_BYTES) return;
      try {
        resolve({ json: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
      } catch {
        resolve(400);
      }
    });
  });
}

/**
 * Starts the MCP server's loopback listener (4.9, ADR 0021) on the literal `127.0.0.1`. Before
 * the SDK sees a request, it refuses:
 * - one with an `Origin` header (a browser page is never a client), or a `Host` other than
 *   `127.0.0.1:<port>` (DNS rebinding), with 403;
 * - another path than {@link MCP_PATH}, with 404;
 * - one without a paired app's key in `Authorization: Bearer`, with 401;
 * - a body over its cap (413) or not JSON (400);
 * - a session that isn't the caller's app's, with 404, as an unknown one is.
 *
 * Nothing of a request is logged.
 */
export async function startMcpListener(options: McpListenerOptions): Promise<McpListener> {
  const sessions = new Map<string, Session>();
  let host = "";

  const endSession = async (id: string) => {
    const session = sessions.get(id);
    if (session === undefined) return;
    sessions.delete(id);
    await session.server.close().catch(() => undefined);
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.headers.origin !== undefined || req.headers.host !== host) return refuse(res, 403);
    if (new URL(req.url ?? "/", "http://placeholder").pathname !== MCP_PATH) {
      return refuse(res, 404);
    }
    const key = BEARER.exec(req.headers.authorization ?? "")?.[1];
    const app = key === undefined ? undefined : await options.authenticate(key);
    if (app === undefined) return refuse(res, 401);

    const header = req.headers["mcp-session-id"];
    const sessionId = typeof header === "string" ? header : undefined;
    let body: unknown;
    if (req.method === "POST") {
      const read = await bodyOf(req);
      if (typeof read === "number") return refuse(res, read);
      body = read.json;
    }
    if (sessionId !== undefined) {
      const session = sessions.get(sessionId);
      if (session === undefined || session.app.id !== app.id) return refuse(res, 404);
      await session.transport.handleRequest(req, res, body);
      return;
    }
    // A new connection starts with `initialize`, and nothing else does.
    if (req.method !== "POST" || !isInitializeRequest(body)) return refuse(res, 400);
    const server = options.serverFor(app);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, server, app });
      },
      onsessionclosed: (id) => endSession(id),
    });
    transport.onerror = () => undefined;
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  };

  const http = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) refuse(res, 500);
      else res.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(options.port, MCP_HOST, () => {
      http.off("error", reject);
      resolve();
    });
  });
  const address = http.address();
  const port = typeof address === "object" && address !== null ? address.port : options.port;
  host = `${MCP_HOST}:${port}`;

  return {
    port,
    connectedApps: () => [...new Set([...sessions.values()].map(({ app }) => app.id))],
    async disconnect(appId) {
      const ids = [...sessions].filter(([, { app }]) => app.id === appId).map(([id]) => id);
      await Promise.all(ids.map(endSession));
    },
    async close() {
      await Promise.all([...sessions.keys()].map(endSession));
      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
