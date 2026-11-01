import type { AiRequest, AiResponse } from "../shared/ipc/ai.js";
import type { AiBridge } from "./ai-ipc.js";

/** How many of each an app may ask in a minute (ADR 0021, security review). */
export const PER_MINUTE = { query: 120, command: 30 } as const;

/** How long an app's commands wait after the person declines one, doubling up to the most. */
export const DECLINED_BACK_OFF_MS = { first: 15_000, most: 5 * 60_000 } as const;

const MINUTE_MS = 60_000;

const TOO_FAST: AiResponse = {
  status: "busy",
  message: "Too many requests in the last minute: wait a little, then ask again.",
};
const BACKING_OFF: AiResponse = {
  status: "busy",
  message:
    "The person declined your last change. Wait before asking for another, and ask them first.",
};

/** What an app may ask now (S20, ADR 0021). */
export type AppLimits = {
  /** `ask`, for app `appId`: `busy` at once past its rate, or while it backs off after a decline. */
  ask(appId: string, request: AiRequest): Promise<AiResponse>;
  /** Forgets app `appId`: it was removed. */
  forget(appId: string): void;
};

/**
 * Limits on each app's requests, over `ask` (S20, ADR 0021): {@link PER_MINUTE} queries and
 * commands, and after the person declines a command, none for {@link DECLINED_BACK_OFF_MS},
 * doubling with each further decline. The bridge lets each app have one command in flight.
 */
export function createAppLimits(ask: AiBridge["ask"], now: () => number = Date.now): AppLimits {
  type State = {
    times: { query: number[]; command: number[] };
    backOffUntil: number;
    backOffMs: number;
  };
  const apps = new Map<string, State>();
  const stateOf = (appId: string): State => {
    let state = apps.get(appId);
    if (state === undefined) {
      state = {
        times: { query: [], command: [] },
        backOffUntil: 0,
        backOffMs: DECLINED_BACK_OFF_MS.first,
      };
      apps.set(appId, state);
    }
    return state;
  };
  return {
    async ask(appId, request) {
      const state = stateOf(appId);
      const at = now();
      const times = state.times[request.kind].filter((time) => at - time < MINUTE_MS);
      state.times[request.kind] = times;
      if (times.length >= PER_MINUTE[request.kind]) return TOO_FAST;
      if (request.kind === "command" && at < state.backOffUntil) return BACKING_OFF;
      times.push(at);
      const response = await ask(request);
      if (request.kind === "command") {
        if (response.status === "declined") {
          state.backOffUntil = now() + state.backOffMs;
          state.backOffMs = Math.min(state.backOffMs * 2, DECLINED_BACK_OFF_MS.most);
        } else if (response.status === "done") {
          state.backOffMs = DECLINED_BACK_OFF_MS.first;
        }
      }
      return response;
    },
    forget(appId) {
      apps.delete(appId);
    },
  };
}
