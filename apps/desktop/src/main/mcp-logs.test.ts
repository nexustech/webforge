import { request } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiResponse } from "../shared/ipc/ai.js";
import { setLogSink } from "./log.js";
import { createAppLimits } from "./mcp-limits.js";
import { MCP_HOST, MCP_PATH, type McpListener, startMcpListener } from "./mcp-listener.js";
import { createMcpServer, type McpApp } from "./mcp-server.js";

/** What an AI app sends and gets back here: it must reach no log, console or crash report. */
const MARKER = "zzMarker49zz";
const CLAUDE: McpApp = { id: "app-1", name: "Claude" };
const KEY = "k".repeat(43);

/** Everything written: the log sink's lines, the console's, and errors nobody caught. */
let written: string[] = [];
const keep = (...parts: unknown[]) => {
  written.push(parts.map((part) => (part instanceof Error ? part.stack : String(part))).join(" "));
};
let listener: McpListener;

beforeEach(() => {
  written = [];
  setLogSink((level, line) => keep(level, line));
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation(keep);
  }
  process.on("unhandledRejection", keep);
  process.on("uncaughtException", keep);
});

afterEach(async () => {
  await listener.close();
  setLogSink();
  vi.restoreAllMocks();
  process.off("unhandledRejection", keep);
  process.off("uncaughtException", keep);
});

/** The answers `ask` gives in turn, the last one a throw. */
const answers: (() => AiResponse)[] = [
  () => ({ status: "done", data: { text: MARKER } }),
  () => ({ status: "invalid", message: `Not a ${MARKER}` }),
  () => ({ status: "declined", message: MARKER }),
  () => {
    throw new Error(`The window failed on ${MARKER}`);
  },
];

/** A raw request to the listener, for what an SDK client never sends. */
function raw(headers: Record<string, string>, body: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: MCP_HOST,
        port: listener.port,
        path: MCP_PATH,
        method: "POST",
        headers: {
          host: `${MCP_HOST}:${listener.port}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...headers,
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

describe("what AI apps send and get, kept out of the logs (4.9, security review)", () => {
  it("logs nothing of a tool call, its answer, its failure or a refused request", async () => {
    let turn = 0;
    const limits = createAppLimits(async () => {
      const answer = answers[Math.min(turn, answers.length - 1)];
      turn += 1;
      return answer?.() ?? { status: "busy", message: "" };
    });
    listener = await startMcpListener({
      port: 0,
      authenticate: async (key) => (key === KEY ? CLAUDE : undefined),
      serverFor: (app) =>
        createMcpServer({ name: "Webforge", version: "1" }, app, (asked) =>
          limits.ask(app.id, asked),
        ),
    });
    const client = new Client({ name: "test", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://${MCP_HOST}:${listener.port}${MCP_PATH}`), {
        requestInit: { headers: { authorization: `Bearer ${KEY}` } },
      }),
    );

    const results = [];
    for (const name of ["outline", "editText", "addPage", "fields"]) {
      results.push(
        await client
          .callTool({ name, arguments: { title: MARKER, text: MARKER, nodeId: MARKER } })
          .catch((error: unknown) => error),
      );
    }
    await client.callTool({ name: MARKER, arguments: {} }).catch(() => undefined);
    await client.close();
    // What no client sends: a wrong key, a body over the cap, one that isn't JSON.
    const wrongKey = `${MARKER}${"x".repeat(43 - MARKER.length)}`;
    await raw({ authorization: `Bearer ${wrongKey}` }, `{"x":"${MARKER}"}`);
    await raw({ authorization: `Bearer ${KEY}` }, `${MARKER}`.repeat(200_000));
    await raw({ authorization: `Bearer ${KEY}` }, `{${MARKER}`);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The app got its answers: the marker went through, as it should.
    expect(JSON.stringify(results)).toContain(MARKER);
    expect(written.filter((line) => line.includes(MARKER))).toEqual([]);
  });
});
