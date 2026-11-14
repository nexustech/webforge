import { randomBytes, timingSafeEqual } from "node:crypto";
import { Agent, type ClientRequestArgs, type IncomingHttpHeaders, request } from "node:http";
import { createInterface } from "node:readline";
import type { Duplex, Readable, Writable } from "node:stream";
import type { BridgeConfig } from "./config.js";
import { PROOF_PATH, proofFor } from "./proof.js";

/** The most bytes of one answer read: far more than any of Webforge's, short of the whole site. */
const MAX_ANSWER_BYTES = 64 * 1024 * 1024;

/** JSON-RPC's code for a server error, which every error the bridge answers with uses. */
const SERVER_ERROR = -32000;

/** An HTTP answer, read in full. */
type Answer = {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly body: Buffer;
};

/** Why a message didn't reach Webforge, as the bridge tells the AI app. */
type Failure = keyof BridgeConfig["messages"];

/**
 * Node's callback for a new connection, as Node calls it when the connection fails: with the error
 * and no socket, which it reads only on success. `@types/node` types the socket as always there.
 * As a method, its parameters are compared both ways, so a callback of either type fits.
 */
type Connected = { done(error: Error, socket?: Duplex): void };

/**
 * An agent that opens one connection, and never another: a request that would need a new one fails
 * before anything is sent. The bridge checks the server on that connection, then sends the key on
 * the same one, so the key never goes to a server it didn't check (ADR 0021).
 */
class OneConnectionAgent extends Agent {
  #opened = false;

  override createConnection(
    options: ClientRequestArgs,
    callback?: (error: Error | null, socket: Duplex) => void,
  ): Duplex | null | undefined {
    if (this.#opened) {
      // No socket comes with the error (#989).
      const done: Connected["done"] | undefined = callback;
      done?.(new Error("connection closed"));
      return undefined;
    }
    this.#opened = true;
    return super.createConnection(options, callback);
  }
}

/** Sends one request through `agent`, reading the whole answer. */
function send(
  agent: Agent,
  url: URL,
  path: string,
  headers: Record<string, string>,
  body: string,
): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        agent,
        host: url.hostname,
        port: url.port,
        path,
        method: "POST",
        headers: { ...headers, "content-length": String(Buffer.byteLength(body)) },
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_ANSWER_BYTES) incoming.destroy(new Error("answer too large"));
          else chunks.push(chunk);
        });
        incoming.on("error", reject);
        incoming.on("end", () =>
          resolve({
            status: incoming.statusCode ?? 0,
            headers: incoming.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

/** `text` as JSON, or `undefined`. */
function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The request id of `message`, if it is a request (one that waits for an answer). */
function requestId(message: unknown): string | number | undefined {
  if (typeof message !== "object" || message === null) return undefined;
  const { id, method } = message as { id?: unknown; method?: unknown };
  return typeof method === "string" && (typeof id === "string" || typeof id === "number")
    ? id
    : undefined;
}

const isInitialize = (message: unknown) =>
  typeof message === "object" &&
  message !== null &&
  (message as { method?: unknown }).method === "initialize";

/** Where the bridge reads and writes, and the settings it runs with. */
export type BridgeOptions = {
  /** MCP over stdio from the AI app: one JSON-RPC message a line. */
  readonly input: Readable;
  /** Where the bridge writes Webforge's answers, one a line. */
  readonly output: Writable;
  readonly config: BridgeConfig;
};

/**
 * The bridge Claude Desktop runs (ADR 0021, `webforge-bridge`): it takes MCP over stdio and sends
 * each message on to Webforge's server, with the key in `Authorization`. It holds no state but the
 * MCP session, and logs nothing.
 *
 * Before the key goes on any connection, the bridge checks it is Webforge answering there: it
 * sends a fresh nonce with the app's id and no key, and compares the answer with the HMAC under the
 * pairing's proof, in constant time. If it isn't Webforge, nothing more is sent, and the AI app is
 * told so. Each message has a connection of its own, checked so: a program that took the port while
 * Webforge was closed never gets the key.
 *
 * When Webforge has ended the session (it was idle, or Webforge restarted), the bridge starts
 * another with the AI app's own `initialize`, unseen by the app, and sends the message again.
 * Resolves once the input ends and every message has been answered.
 */
export async function runBridge({ input, output, config }: BridgeOptions): Promise<void> {
  const url = new URL(config.address);
  const host = `${url.hostname}:${url.port}`;
  let session: string | undefined;
  let protocolVersion: string | undefined;
  /** The AI app's `initialize`, sent again when Webforge has ended the session. */
  let initialize: unknown;
  let reconnecting: Promise<void> | undefined;

  const write = (message: unknown) => {
    output.write(`${JSON.stringify(message)}\n`);
  };

  /** Sends `body` with the key, on a connection checked to be Webforge's; or why it couldn't. */
  const exchange = async (
    key: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<Answer | Failure> => {
    const agent = new OneConnectionAgent({ keepAlive: true, maxSockets: 1 });
    try {
      const nonce = randomBytes(32).toString("base64url");
      let challenge: Answer;
      try {
        challenge = await send(
          agent,
          url,
          PROOF_PATH,
          { "content-type": "application/json" },
          JSON.stringify({ app: config.app, nonce }),
        );
      } catch {
        return "unreachable";
      }
      const answered = parse(challenge.body.toString("utf8"));
      const proof =
        challenge.status === 200 && typeof answered === "object" && answered !== null
          ? (answered as { proof?: unknown }).proof
          : undefined;
      const expected = Buffer.from(proofFor(config.proof, host, nonce));
      const given = Buffer.from(typeof proof === "string" ? proof : "");
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        return "notWebforge";
      }
      // Let the checked connection go back to the agent before the key goes on it.
      await new Promise((resolve) => setImmediate(resolve));
      try {
        return await send(
          agent,
          url,
          url.pathname,
          { ...headers, authorization: `Bearer ${key}` },
          body,
        );
      } catch {
        return "unreachable";
      }
    } finally {
      agent.destroy();
    }
  };

  /**
   * Sends `message` to Webforge: its answers, or why it couldn't. Unless `again` is off (the
   * reconnection's own messages, and a message sent again), it waits for a reconnection under way,
   * and starts one if Webforge has ended the session.
   */
  const post = async (message: unknown, again = true): Promise<unknown[] | Failure> => {
    if (config.key === null) return "keyRefused";
    if (again && reconnecting !== undefined) await reconnecting;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (!isInitialize(message)) {
      if (session !== undefined) headers["mcp-session-id"] = session;
      if (protocolVersion !== undefined) headers["mcp-protocol-version"] = protocolVersion;
    }
    const used = session;
    const answer = await exchange(config.key, headers, JSON.stringify(message));
    if (typeof answer === "string") return answer;
    if (answer.status === 401) return "keyRefused";
    if (answer.status === 404 && used !== undefined && again && initialize !== undefined) {
      // A session another message is replacing, or has, needs no reconnection of its own: the
      // message waits for that one.
      await (session === used ? reconnect() : reconnecting);
      return post(message, false);
    }
    if (answer.status === 202) return [];
    if (answer.status !== 200) return "failed";
    const parsed = parse(answer.body.toString("utf8"));
    if (parsed === undefined) return "failed";
    if (isInitialize(message)) {
      const id = answer.headers["mcp-session-id"];
      session = typeof id === "string" ? id : undefined;
      const result = (parsed as { result?: { protocolVersion?: unknown } }).result;
      if (typeof result?.protocolVersion === "string") protocolVersion = result.protocolVersion;
    }
    return Array.isArray(parsed) ? parsed : [parsed];
  };

  /** Starts a new session with the AI app's `initialize`, once however many messages need it. */
  const reconnect = () => {
    reconnecting ??= (async () => {
      session = undefined;
      const answer = await post(initialize, false);
      if (Array.isArray(answer)) {
        await post({ jsonrpc: "2.0", method: "notifications/initialized" }, false);
      }
    })().finally(() => {
      reconnecting = undefined;
    });
    return reconnecting;
  };

  /** Sends one message on, and writes what came back: Webforge's answers, or an error. */
  const relay = async (message: unknown) => {
    if (isInitialize(message)) initialize = message;
    const answer = await post(message);
    if (Array.isArray(answer)) {
      for (const each of answer) write(each);
      return;
    }
    const id = requestId(message);
    if (id !== undefined) {
      write({
        jsonrpc: "2.0",
        id,
        error: { code: SERVER_ERROR, message: config.messages[answer] },
      });
    }
  };

  const relaying = new Set<Promise<void>>();
  for await (const line of createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })) {
    if (line.trim() === "") continue;
    const message = parse(line);
    if (message === undefined) {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    // `initialize` first, alone: everything after it needs its session.
    if (isInitialize(message)) {
      await Promise.all(relaying);
      await relay(message);
      continue;
    }
    const each = relay(message).finally(() => relaying.delete(each));
    relaying.add(each);
  }
  await Promise.all(relaying);
}
