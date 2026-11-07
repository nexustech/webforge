import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { NONCE, PROOF_PATH, proofFor } from "@webforge/mcp-bridge";
import { z } from "zod";
import { AI_INPUT_MAX_CHARS } from "../shared/ipc/ai.js";
import type { McpApp } from "./mcp-server.js";

/** The one address AI apps reach: the literal loopback address, never a name (ADR 0021). */
export const MCP_HOST = "127.0.0.1";

/** The one path the server answers. */
export const MCP_PATH = "/mcp";

/** The most a request's body may hold: an AI request's input, with room for its envelope. */
const MAX_BODY_BYTES = AI_INPUT_MAX_CHARS * 4 + 64 * 1024;

/** The most a challenge's body may hold: an app's id and a nonce. */
const MAX_CHALLENGE_BYTES = 1024;

/** A bridge's challenge: the app it's for, and a fresh nonce (ADR 0021). */
const challengeSchema = z.strictObject({
  app: z.string().min(1).max(64),
  nonce: z.string().regex(NONCE),
});

/** The most connections one app keeps at once: a new one ends its least recently used. */
export const MAX_SESSIONS_PER_APP = 4;

/** How long a connection lasts unused: a client that crashed never says it has gone. */
export const SESSION_IDLE_MS = 10 * 60_000;

/** How often idle connections are looked for, besides on each request and status. */
const SWEEP_EVERY_MS = 60_000;

/** A key as `Authorization: Bearer` carries it: 256 bits or more, base64url (ADR 0021). */
const BEARER = /^Bearer ([A-Za-z0-9_-]{43,128})$/;

/** What the listener works with. */
export type McpListenerOptions = {
  /** The port to listen on: the remembered one, or 0 for any (tests). */
  readonly port: number;
  /** The paired app a key belongs to, if any; how failures back off is its own (ADR 0021). */
  readonly authenticate: (key: string) => Promise<McpApp | undefined>;
  /** The server proof of the paired app `appId`, which its bridge checks; `null` if none. */
  readonly proofOf: (appId: string) => Promise<string | null>;
  /** The MCP server for one connection of `app` (`createMcpServer`). */
  readonly serverFor: (app: McpApp) => Server;
  /** The time, for tests. */
  readonly now?: () => number;
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

/** One MCP session: its transport and server, the app it's for, and when it was last used. */
type Session = {
  readonly transport: StreamableHTTPServerTransport;
  readonly server: Server;
  readonly app: McpApp;
  lastUsed: number;
};

/** Answers `status` with nothing more: no detail of why reaches a caller. */
function refuse(res: ServerResponse, status: number): void {
  res.writeHead(status, { "content-type": "text/plain" }).end();
}

/**
 * `req`'s body as JSON, or why not: too large (413), not JSON (400). Past the cap it keeps only
 * reading, keeping nothing, so the caller gets its answer rather than a reset connection.
 */
function bodyOf(
  req: IncomingMessage,
  max = MAX_BODY_BYTES,
): Promise<{ readonly json: unknown } | number> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) {
        chunks.length = 0;
        resolve(413);
      } else {
        chunks.push(chunk);
      }
    });
    req.on("error", () => resolve(400));
    req.on("end", () => {
      if (size > max) return;
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
 * - another path than {@link MCP_PATH} or {@link PROOF_PATH}, with 404;
 * - one without a paired app's key in `Authorization: Bearer`, with 401;
 * - a body over its cap (413) or not JSON (400);
 * - a session that isn't the caller's app's, with 404, as an unknown one is.
 *
 * A bridge's challenge at {@link PROOF_PATH} needs no key: it is answered with HMAC-SHA256 of its
 * nonce and this address under the app's server proof, which proves to the bridge that it is
 * Webforge answering before it sends its key. An unknown app's is answered under a decoy, so the
 * answer doesn't tell which apps there are.
 *
 * Each app keeps at most {@link MAX_SESSIONS_PER_APP} connections, and one unused for
 * {@link SESSION_IDLE_MS} ends: a client that crashed never ends its own. Nothing of a request is
 * logged.
 */
export async function startMcpListener(options: McpListenerOptions): Promise<McpListener> {
  const sessions = new Map<string, Session>();
  const now = options.now ?? Date.now;
  let host = "";
  /** The proof an unknown app's challenge is answered under: no use to anyone. */
  const decoy = randomBytes(32).toString("base64url");

  const endSession = async (id: string) => {
    const session = sessions.get(id);
    if (session === undefined) return;
    sessions.delete(id);
    await session.server.close().catch(() => undefined);
  };

  /** Ends the connections unused for {@link SESSION_IDLE_MS}. */
  const sweep = () => {
    const at = now();
    for (const [id, session] of sessions) {
      if (at - session.lastUsed >= SESSION_IDLE_MS) void endSession(id);
    }
  };

  /** Keeps `app`'s connections under the cap, ending its least recently used. */
  const makeRoom = (app: McpApp) => {
    const own = [...sessions].filter(([, session]) => session.app.id === app.id);
    own.sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
    for (const [id] of own.slice(0, Math.max(0, own.length - MAX_SESSIONS_PER_APP + 1))) {
      void endSession(id);
    }
  };

  /** Answers a bridge's challenge with the proof that this is Webforge (ADR 0021). */
  const answerChallenge = async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") return refuse(res, 405);
    const read = await bodyOf(req, MAX_CHALLENGE_BYTES);
    if (typeof read === "number") return refuse(res, read);
    const challenge = challengeSchema.safeParse(read.json);
    if (!challenge.success) return refuse(res, 400);
    const { app, nonce } = challenge.data;
    const proof = proofFor((await options.proofOf(app)) ?? decoy, host, nonce);
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ proof }));
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    sweep();
    if (req.headers.origin !== undefined || req.headers.host !== host) return refuse(res, 403);
    const path = new URL(req.url ?? "/", "http://placeholder").pathname;
    if (path === PROOF_PATH) return answerChallenge(req, res);
    if (path !== MCP_PATH) return refuse(res, 404);
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
      session.lastUsed = now();
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
        makeRoom(app);
        sessions.set(id, { transport, server, app, lastUsed: now() });
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
  const sweeping = setInterval(sweep, SWEEP_EVERY_MS);
  sweeping.unref();
  const address = http.address();
  const port = typeof address === "object" && address !== null ? address.port : options.port;
  host = `${MCP_HOST}:${port}`;

  return {
    port,
    connectedApps() {
      sweep();
      return [...new Set([...sessions.values()].map(({ app }) => app.id))];
    },
    async disconnect(appId) {
      const ids = [...sessions].filter(([, { app }]) => app.id === appId).map(([id]) => id);
      await Promise.all(ids.map(endSession));
    },
    async close() {
      clearInterval(sweeping);
      await Promise.all([...sessions.keys()].map(endSession));
      http.closeAllConnections();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
