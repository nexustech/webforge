import type { IpcMain } from "electron";
import { z } from "zod";
import { type AiRequest, type AiResponse, aiEvents, aiRequestSchema } from "../shared/ipc/ai.js";
import { registerIpcHandler } from "./ipc.js";

/** How long a query waits for the renderer's answer. */
const QUERY_TIMEOUT_MS = 15_000;

/** How long a command waits: a minute for the person to allow it (D7), then time to run. */
const COMMAND_TIMEOUT_MS = 75_000;

const NO_SITE: AiResponse = { status: "not-found", message: "No site is open in Webforge." };
/** What a request waiting on the window gets once it reloads: its answer never comes (#663). */
const RELOADED: AiResponse = {
  status: "not-found",
  message: "Webforge reloaded the site before it answered: ask again once it has.",
};

const NO_ANSWER: AiResponse = {
  status: "busy",
  message: "Webforge didn't answer in time: try again.",
};

/**
 * The most requests that wait on the window at once (S21): one command per app, as each waits for
 * the person, a few commands in all, and a few queries. The rest are answered `busy` at once.
 */
const MAX_WAITING = { commandsPerApp: 1, commands: 4, queries: 4 } as const;

const TOO_MANY: AiResponse = {
  status: "busy",
  message: "Webforge is still answering earlier requests: wait for their answers, then ask again.",
};

/** The parts of the window an AI app's request goes to; a fake in tests. */
export type AiWindow = {
  readonly webContents: {
    send(channel: string, ...args: unknown[]): void;
    /** A crashed renderer can't answer. */
    isCrashed(): boolean;
    /** Calls `listener` as the window starts loading a page: a reload, or the next site's. */
    on(
      event: "did-start-navigation",
      listener: (details: {
        readonly isMainFrame: boolean;
        readonly isSameDocument: boolean;
      }) => void,
    ): unknown;
  };
};

/** Whether the opening a window listens for is still the open site's (R6). */
export type AiSite = {
  staleReason(sessionId: string): "no-site" | "stale-session" | undefined;
};

/** The environment variable E2E tests launch Webforge with, to ask it as an AI app would. */
const E2E_AI_VARIABLE = "WEBFORGE_E2E_AI";

/** Forwards AI apps' requests to the open site's window (F-AI-1); the MCP server (4.9) uses it. */
export type AiBridge = {
  /**
   * Checks `request` against the contract and sends it to the window, resolving with its answer:
   * `invalid` at once for a request outside the contract, `busy` at once while too many wait
   * (S21). Nothing is logged of a request or its answer (architecture §9). With no site open, or
   * no answer in time, it says so.
   */
  ask(request: unknown): Promise<AiResponse>;
};

/**
 * Registers the `ai` IPC calls and returns the bridge that uses them (4.8): main holds no
 * document, so each request goes to the renderer, which runs it through the command layer
 * (`@webforge/commands`) and answers with `ai:answer`. The renderer says with `ai:listening`
 * whether a site is open to ask, and which opening of it (#663): a request goes only while that
 * opening is the open site's. Once the window starts loading again (a reload, a hand-off), it
 * listens no more, and requests waiting on it settle as `not-found` at once, rather than time out
 * as `busy` and be tried again.
 */
/**
 * Puts `ai` on main's globals (`webforgeAi`) for the E2E tests, which reach main through
 * Playwright's Electron launcher: only in an unpackaged app launched with `WEBFORGE_E2E_AI=1`, as
 * the tests launch it. Never in the installed app, nor in `pnpm dev`. Only main's own code can
 * read its globals.
 */
export function exposeForE2eTests(
  ai: AiBridge,
  packaged: boolean,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!packaged && env[E2E_AI_VARIABLE] === "1") Object.assign(globalThis, { webforgeAi: ai });
}

export function registerAiHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  window: () => AiWindow | undefined,
  site: AiSite,
  timeouts: { readonly queryMs?: number; readonly commandMs?: number } = {},
): AiBridge {
  /** Each request waiting on the window: how to settle it, and who asked (a command's app). */
  const waiting = new Map<
    number,
    { readonly settle: (response: AiResponse) => void; readonly app: string | undefined }
  >();
  /** Whether one more `request` would wait past {@link MAX_WAITING}. */
  const tooMany = (request: AiRequest) => {
    const all = [...waiting.values()];
    if (request.kind === "query") {
      return all.filter(({ app }) => app === undefined).length >= MAX_WAITING.queries;
    }
    const commands = all.filter(({ app }) => app !== undefined);
    return (
      commands.length >= MAX_WAITING.commands ||
      commands.filter(({ app }) => app === request.app).length >= MAX_WAITING.commandsPerApp
    );
  };
  // The opening of the site the window answers for, while it does.
  let listening: string | undefined;
  let nextId = 1;
  // Each window's page loads are watched once.
  const watched = new WeakSet<object>();
  const watch = (target: AiWindow | undefined) => {
    if (target === undefined || watched.has(target.webContents)) return;
    watched.add(target.webContents);
    target.webContents.on("did-start-navigation", (details) => {
      if (!details.isMainFrame || details.isSameDocument) return;
      listening = undefined;
      for (const { settle } of [...waiting.values()]) settle(RELOADED);
    });
  };

  registerIpcHandler(ipc, "aiAnswer", isTrustedSender, (id, response) => {
    waiting.get(id)?.settle(response);
    return null;
  });
  registerIpcHandler(ipc, "aiListening", isTrustedSender, (sessionId, on) => {
    if (on) {
      listening = sessionId;
      watch(window());
    } else if (listening === sessionId) {
      listening = undefined;
    }
    return null;
  });

  return {
    ask(asked) {
      const parsed = aiRequestSchema.safeParse(asked);
      if (!parsed.success) {
        return Promise.resolve({ status: "invalid", message: z.prettifyError(parsed.error) });
      }
      const request = parsed.data;
      const target = window();
      if (
        listening === undefined ||
        site.staleReason(listening) !== undefined ||
        target === undefined ||
        target.webContents.isCrashed()
      ) {
        return Promise.resolve(NO_SITE);
      }
      if (tooMany(request)) return Promise.resolve(TOO_MANY);
      const timeoutMs =
        request.kind === "query"
          ? (timeouts.queryMs ?? QUERY_TIMEOUT_MS)
          : (timeouts.commandMs ?? COMMAND_TIMEOUT_MS);
      const id = nextId++;
      return new Promise((resolve) => {
        const settle = (response: AiResponse) => {
          clearTimeout(timer);
          waiting.delete(id);
          resolve(response);
        };
        const timer = setTimeout(() => settle(NO_ANSWER), timeoutMs);
        waiting.set(id, { settle, app: request.kind === "command" ? request.app : undefined });
        target.webContents.send(aiEvents.request.channel, id, request);
      });
    },
  };
}
