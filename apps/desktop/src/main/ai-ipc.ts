import type { IpcMain } from "electron";
import { type AiRequest, type AiResponse, aiEvents } from "../shared/ipc/ai.js";
import { registerIpcHandler } from "./ipc.js";

/** How long a query waits for the renderer's answer. */
const QUERY_TIMEOUT_MS = 15_000;

/** How long a command waits: a minute for the person to allow it (D7), then time to run. */
const COMMAND_TIMEOUT_MS = 75_000;

const NO_SITE: AiResponse = { status: "not-found", message: "No site is open in Webforge." };
const NO_ANSWER: AiResponse = {
  status: "busy",
  message: "Webforge didn't answer in time: try again.",
};

/** The parts of the window an AI app's request goes to; a fake in tests. */
export type AiWindow = {
  readonly webContents: {
    send(channel: string, ...args: unknown[]): void;
    /** A crashed renderer can't answer. */
    isCrashed(): boolean;
  };
};

/** Forwards AI apps' requests to the open site's window (F-AI-1); the MCP server (4.9) uses it. */
export type AiBridge = {
  /**
   * Sends `request` to the window and resolves with its answer. Nothing is logged of a request
   * or its answer (architecture §9). With no site open, or no answer in time, it says so.
   */
  ask(request: AiRequest): Promise<AiResponse>;
};

/**
 * Registers the `ai` IPC calls and returns the bridge that uses them (4.8): main holds no
 * document, so each request goes to the renderer, which runs it through the command layer
 * (`@webforge/commands`) and answers with `ai:answer`. The renderer says with `ai:listening`
 * whether a site is open to ask.
 */
export function registerAiHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  window: () => AiWindow | undefined,
  timeouts: { readonly queryMs?: number; readonly commandMs?: number } = {},
): AiBridge {
  const waiting = new Map<number, (response: AiResponse) => void>();
  let listening = false;
  let nextId = 1;

  registerIpcHandler(ipc, "aiAnswer", isTrustedSender, (id, response) => {
    waiting.get(id)?.(response);
    return null;
  });
  registerIpcHandler(ipc, "aiListening", isTrustedSender, (on) => {
    listening = on;
    return null;
  });

  return {
    ask(request) {
      const target = window();
      if (!listening || target === undefined || target.webContents.isCrashed()) {
        return Promise.resolve(NO_SITE);
      }
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
        waiting.set(id, settle);
        target.webContents.send(aiEvents.request.channel, id, request);
      });
    },
  };
}
