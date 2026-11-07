import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  isInitializeRequest,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PROOF_PATH, proofFor } from "./proof.js";

export const KEY = "k".repeat(43);
export const PROOF = "p".repeat(43);
export const APP = "6f1c1b8e-6a43-4f53-9a0b-4a4f8f3c2d11";
export const MESSAGES = {
  unreachable: "Webforge isn't answering.",
  notWebforge: "Something else answers at Webforge's address.",
  keyRefused: "Webforge didn't take the key.",
  failed: "Webforge couldn't answer.",
};

/** A request the test server got: its path, and whether it carried a key. */
type Seen = { readonly path: string; readonly authorization: string | undefined };

/** How the test server answers a challenge. */
export type ProofMode =
  /** As Webforge does. */
  | "right"
  /** As a program that doesn't know the proof would. */
  | "wrong"
  /** As Webforge at another port would, a squatter passing the challenge on to it. */
  | "other-port"
  /** Rightly, then closing the connection. */
  | "close";

/** A server that answers as Webforge's does: the proof, then MCP with a key. */
export async function startTestServer(mode: ProofMode = "right") {
  const seen: Seen[] = [];
  const sessions = new Map<string, StreamableHTTPServerTransport>();
  let calls = 0;

  const read = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });

  const mcpServer = () => {
    const server = new Server({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [{ name: "echo", description: "Echoes", inputSchema: { type: "object" } }],
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      calls += 1;
      return { content: [{ type: "text", text: JSON.stringify(request.params.arguments ?? {}) }] };
    });
    return server;
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const path = req.url ?? "";
    seen.push({ path, authorization: req.headers.authorization });
    const body = await read(req);
    if (path === PROOF_PATH) {
      const { nonce } = JSON.parse(body) as { nonce: string };
      const host = `127.0.0.1:${port}`;
      const proof =
        mode === "wrong"
          ? proofFor("x".repeat(43), host, nonce)
          : proofFor(PROOF, mode === "other-port" ? `127.0.0.1:${port + 1}` : host, nonce);
      res.writeHead(200, {
        "content-type": "application/json",
        ...(mode === "close" ? { connection: "close" } : {}),
      });
      res.end(JSON.stringify({ proof }));
      return;
    }
    if (req.headers.authorization !== `Bearer ${KEY}`) {
      res.writeHead(401).end();
      return;
    }
    const json: unknown = JSON.parse(body);
    const id = req.headers["mcp-session-id"];
    if (typeof id === "string") {
      const transport = sessions.get(id);
      if (transport === undefined) {
        res.writeHead(404).end();
        return;
      }
      await transport.handleRequest(req, res, json);
      return;
    }
    if (!isInitializeRequest(json)) {
      res.writeHead(400).end();
      return;
    }
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, transport);
      },
    });
    await mcpServer().connect(transport);
    await transport.handleRequest(req, res, json);
  };

  const http = createServer((req, res) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const port = (http.address() as AddressInfo).port;

  return {
    address: `http://127.0.0.1:${port}/mcp`,
    seen,
    calls: () => calls,
    /** Ends every session, as Webforge does with an idle one or when it restarts. */
    endSessions: () => sessions.clear(),
    close: () =>
      new Promise<void>((resolve) => {
        http.closeAllConnections();
        http.close(() => resolve());
      }),
  };
}
