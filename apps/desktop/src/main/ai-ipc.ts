import { t } from "@webforge/i18n/main";
import type { IpcMain } from "electron";
import { z } from "zod";
import { changeStatusSchema, windowTool } from "../shared/ai-tools.js";
import {
  type AiRequest,
  type AiResponse,
  ANSWER_WITHIN_MS,
  aiEvents,
  aiRequestSchema,
} from "../shared/ipc/ai.js";
import { registerIpcHandler } from "./ipc.js";

/** How long a query waits for the renderer's answer. */
const QUERY_TIMEOUT_MS = 15_000;

/**
 * How long a command waits for the window to answer, unless the window says it's asking the person
 * (`ai:asking`): then it waits for their answer however long it takes (5.34, UA-1).
 */
const COMMAND_TIMEOUT_MS = 75_000;

/** How long a change's outcome waits to be read with `changeStatus`, as a brief's does. */
const KEEP_MS = 30 * 60_000;

// What an AI app is told when the window can't answer, by the app's name (`{appName}`, #1004).

const noSite = (): AiResponse => ({ status: "not-found", message: t("aiApps.answer.noSite") });
/** What a request waiting on the window gets once it reloads: its answer never comes (#663). */
const reloaded = (): AiResponse => ({ status: "not-found", message: t("aiApps.answer.reloaded") });

const noAnswer = (): AiResponse => ({ status: "busy", message: t("aiApps.answer.noAnswer") });

/**
 * What a request still waiting gets once its site closes, or its window goes (5.34): no decline,
 * so the app needn't wait before it asks again.
 */
const siteClosed = (): AiResponse => ({
  status: "not-found",
  message: t("aiApps.answer.siteClosed"),
});

/**
 * The most requests that wait on the window at once (S21): one command per app, as each waits for
 * the person, a few commands in all, and a few queries. The rest are answered `busy` at once.
 */
const MAX_WAITING = { commandsPerApp: 1, commands: 4, queries: 4 } as const;

const tooManyWaiting = (): AiResponse => ({ status: "busy", message: t("aiApps.answer.tooMany") });

/**
 * What a paired app is told while the person hasn't answered its change's question (#1364): its
 * id, for `changeStatus`. `again` when the app sent the same change again meanwhile.
 */
const waitingFor = (changeId: number, again: boolean): AiResponse => ({
  status: "waiting",
  data: { changeId },
  message: t(again ? "aiApps.answer.sentAgain" : "aiApps.answer.waiting"),
});

/** What an app's other change gets while one of its changes waits on the person (#1364). */
const anotherWaits = (): AiResponse => ({
  status: "busy",
  message: t("aiApps.answer.anotherWaits"),
});

const noChange = (): AiResponse => ({ status: "not-found", message: t("aiApps.answer.noChange") });

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
    /** Calls `listener` once the window has closed, or its renderer has gone (5.34). */
    on(event: "destroyed" | "render-process-gone", listener: () => void): unknown;
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
  ask(
    request: unknown,
    appId?: string,
    /** The outcome of a change that answered `waiting`, once the person answers (#1364). */
    late?: (response: AiResponse) => void,
  ): Promise<AiResponse>;
  /**
   * Gives up on the commands of the app with id `appId` waiting for the window (the assistant's
   * Stop, 6.9b): a question asked for one closes, and it's declined. Each still answers through
   * `ask`. By id, never by name: a paired app may be named "Assistant" (#1050's review). Not a
   * change already answered `waiting`: the app has its id, and its question waits (#1364).
   */
  cancel(appId: string): void;
  /**
   * What became of paired app `appId`'s change that answered `waiting` (#1364), by the `changeId`
   * in `input`: `waiting` still, or its outcome, kept for {@link KEEP_MS}. Another app's reads as
   * none.
   */
  changeStatus(input: unknown, appId: string): AiResponse;
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
  timeouts: {
    readonly queryMs?: number;
    readonly commandMs?: number;
    readonly answerWithinMs?: number;
    readonly keepMs?: number;
  } = {},
): AiBridge {
  const answerWithinMs = timeouts.answerWithinMs ?? ANSWER_WITHIN_MS;
  const keepMs = timeouts.keepMs ?? KEEP_MS;
  /** Each request waiting on the window: how to settle it, and who asked (a command's app). */
  const waiting = new Map<
    number,
    {
      readonly settle: (response: AiResponse) => void;
      /** It waits on the person now: no time limit (5.34). */
      readonly asking: () => void;
      readonly app: string | undefined;
      readonly appId: string | undefined;
      /** A paired app's command, as sent: the same one sent again is the same change (#1364). */
      readonly sent: string | undefined;
      /** The window is asking the person about it. */
      asked: boolean;
      /** Its id was given out with `waiting`: its outcome is kept for `changeStatus` (#1364). */
      parked: boolean;
    }
  >();
  /** What became of the changes that answered `waiting`, by id, and whose they are (#1364). */
  const kept = new Map<
    number,
    {
      readonly appId: string | undefined;
      readonly outcome: AiResponse;
      readonly timer: ReturnType<typeof setTimeout>;
    }
  >();
  /** Settles every request still waiting with `response`. */
  const settleAll = (response: () => AiResponse) => {
    for (const { settle } of [...waiting.values()]) settle(response());
  };
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
      settleAll(reloaded);
    });
    // Gone: nothing will answer what waits on it, a question without a time limit among them.
    const gone = () => {
      listening = undefined;
      settleAll(siteClosed);
    };
    target.webContents.on("destroyed", gone);
    target.webContents.on("render-process-gone", gone);
  };

  registerIpcHandler(ipc, "aiAnswer", isTrustedSender, (id, response) => {
    waiting.get(id)?.settle(response);
    return null;
  });
  registerIpcHandler(ipc, "aiAsking", isTrustedSender, (id) => {
    waiting.get(id)?.asking();
    return null;
  });
  registerIpcHandler(ipc, "aiListening", isTrustedSender, (sessionId, on) => {
    if (on) {
      listening = sessionId;
      watch(window());
    } else if (listening === sessionId) {
      listening = undefined;
      // Its site closed: a question still waiting ends, as no decline (5.34).
      settleAll(siteClosed);
    }
    return null;
  });

  return {
    ask(asked, appId, late) {
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
        return Promise.resolve(noSite());
      }
      // A paired app's command (5.35): one whose question the person leaves waiting answers
      // `waiting` with its id, for the app to ask about later (#1364).
      const sent =
        request.kind === "command" && request.appId !== undefined
          ? JSON.stringify([request.name, request.input])
          : undefined;
      if (sent !== undefined) {
        for (const [id, each] of waiting) {
          if (each.appId !== appId || !each.asked) continue;
          // Sent again while the person decides: the same change, never made twice.
          if (each.sent === sent) {
            each.parked = true;
            return Promise.resolve(waitingFor(id, true));
          }
          if (each.parked) return Promise.resolve(anotherWaits());
        }
      }
      if (tooMany(request)) return Promise.resolve(tooManyWaiting());
      // A window tool that waits on the person or a build has a time of its own (#1255).
      const timeoutMs =
        windowTool(request.name)?.timeoutMs ??
        (request.kind === "query"
          ? (timeouts.queryMs ?? QUERY_TIMEOUT_MS)
          : (timeouts.commandMs ?? COMMAND_TIMEOUT_MS));
      const id = nextId++;
      const started = Date.now();
      return new Promise((resolve) => {
        let within: ReturnType<typeof setTimeout> | undefined;
        // This call answered `waiting`: its outcome reaches the caller later, through `late`.
        let toldWaiting = false;
        const settle = (response: AiResponse) => {
          clearTimeout(timer);
          clearTimeout(within);
          waiting.delete(id);
          if (entry.parked) {
            const forget = setTimeout(() => kept.delete(id), keepMs);
            forget.unref?.();
            kept.set(id, { appId: entry.appId, outcome: response, timer: forget });
          }
          if (toldWaiting) late?.(response);
          resolve(response);
        };
        const timer = setTimeout(() => settle(noAnswer()), timeoutMs);
        const entry = {
          settle,
          asking: () => {
            clearTimeout(timer);
            if (entry.asked) return;
            entry.asked = true;
            if (sent === undefined) return;
            // The app's call may give up before the person answers: it's told the change's id
            // first, and the question stays.
            within = setTimeout(
              () => {
                entry.parked = true;
                toldWaiting = true;
                resolve(waitingFor(id, false));
              },
              Math.max(0, started + answerWithinMs - Date.now()),
            );
          },
          app: request.kind === "command" ? request.app : undefined,
          appId: request.kind === "command" ? appId : undefined,
          sent,
          asked: false,
          parked: false,
        };
        waiting.set(id, entry);
        target.webContents.send(aiEvents.request.channel, id, request);
      });
    },
    cancel(appId) {
      const target = window();
      if (target === undefined || target.webContents.isCrashed()) return;
      for (const [id, each] of waiting) {
        if (each.appId === appId && !each.parked) {
          target.webContents.send(aiEvents.cancel.channel, id);
        }
      }
    },
    changeStatus(input, appId) {
      const parsed = changeStatusSchema.safeParse(input);
      if (!parsed.success) return { status: "invalid", message: z.prettifyError(parsed.error) };
      const { changeId } = parsed.data;
      const open = waiting.get(changeId);
      if (open?.parked === true && open.appId === appId) return waitingFor(changeId, false);
      const outcome = kept.get(changeId);
      return outcome !== undefined && outcome.appId === appId ? outcome.outcome : noChange();
    },
  };
}
