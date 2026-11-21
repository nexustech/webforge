import { CONFIRM_TIMEOUT_MS } from "@webforge/commands";
import type { MediaMeta } from "@webforge/model";
import { z } from "zod";
import { mediaStatusInput, requestMediaInput } from "../../shared/ai-tools.js";
import type { AiRequest, AiResponse } from "../../shared/ipc/ai.js";

/** What an AI app asks the person for: who asks, and why, in the app's own words. */
export type MediaAsk = { readonly app: string; readonly reason: string };

/** What the window's answer to `requestMedia` works with. */
export type MediaRequestDeps = {
  /**
   * Shows the app's question in Webforge, and resolves with whether the person chose to add files.
   * `signal` aborts when it has waited too long: the question closes, and nothing is added.
   */
  readonly ask: (asked: MediaAsk, signal: AbortSignal) => Promise<boolean>;
  /** Webforge's own Add files dialog: what the person chose, imported; none if they cancelled. */
  readonly choose: () => Promise<readonly MediaMeta[]>;
  /** Puts what they chose in Media, as one undo step of the person's own. */
  readonly add: (items: readonly MediaMeta[]) => void;
  /** Whether the person is busy otherwise: typing, a drag, or another question. */
  readonly busy: () => boolean;
  /** How long the question waits for an answer: a minute, as an AI app's Allow does. */
  readonly askForMs?: number;
  /** How long `requestMedia` waits for the person before answering `waiting`. */
  readonly answerWithinMs?: number;
  /** How long a request's outcome is kept for `mediaStatus` once the person has chosen. */
  readonly keepMs?: number;
  /** The first request's id; a random one when left out. */
  readonly firstId?: number;
};

/**
 * How long `requestMedia` waits for the person before answering `waiting` with its id: under the
 * 60 s an MCP client waits by default, as a brief's (`ANSWER_WITHIN_MS` in main's site-brief.ts).
 * Choosing pictures takes minutes (#1252).
 */
const ANSWER_WITHIN_MS = 45_000;

/** How long a request's outcome waits to be read with `mediaStatus`, as a brief's does. */
const KEEP_MS = 30 * 60_000;

const BUSY: AiResponse = {
  status: "busy",
  message: "The person is editing, or answering another question: try again shortly.",
};

const OTHER_APP: AiResponse = {
  status: "busy",
  message:
    "The person is choosing files for another app's request: ask again once they've finished.",
};

/** Where a request is: its question shown, or the Add files dialog open. */
type Step = "asking" | "choosing";

/** What the app is answered while the person hasn't finished, by where its request is. */
const waiting = (requestId: number, step: Step, again: boolean): AiResponse => ({
  status: "waiting",
  data: { requestId },
  message:
    (again ? "Your last requestMedia is still open: " : "") +
    (step === "asking"
      ? "the person hasn't answered your question yet"
      : "the person is choosing files in Add files") +
    ". Ask mediaStatus with this requestId in a while; don't ask requestMedia again.",
});

const notFound = (requestId: number): AiResponse => ({
  status: "not-found",
  message: `There is no media request ${requestId} waiting: it ended when the site closed, or long ago. The media query lists what the site has.`,
});

/** The window's answers to `requestMedia` and `mediaStatus`, and what ends them with the site. */
type MediaRequests = {
  readonly requestMedia: (request: AiRequest) => Promise<AiResponse>;
  readonly mediaStatus: (request: AiRequest) => AiResponse;
  /** The site closes: what's kept goes, and a request still open answers `not-found` after. */
  readonly close: () => void;
};

/**
 * The window's answer to `requestMedia` (4.12b, AIB-7), which it routes here by its definition. It
 * asks the person, with the app's reason, whether to add pictures or files; on **Add Files…** it
 * opens Webforge's own Add files dialog, and answers with the id, file name and kind of each one
 * the person added. The app never names a file, and nothing is fetched. One request at a time.
 *
 * A person takes minutes to choose pictures, longer than an app waits for an answer (#1252): if
 * they haven't finished within {@link ANSWER_WITHIN_MS}, it answers `waiting` with the request's
 * id, as a brief does, and `mediaStatus` gives the outcome later, for {@link KEEP_MS}. A
 * second `requestMedia` meanwhile is told the first is still open, with its id.
 */
export function createMediaRequests(deps: MediaRequestDeps): MediaRequests {
  const answerWithinMs = deps.answerWithinMs ?? ANSWER_WITHIN_MS;
  const keepMs = deps.keepMs ?? KEEP_MS;
  /** The request the person is answering now, whose app it is, and where it is. */
  let open: { readonly id: number; readonly app: string; step: Step } | undefined;
  /**
   * What became of requests answered `waiting`, by id, for {@link KEEP_MS}. Not forgotten once read:
   * a query doesn't say which app asks, so one app's read can't take another's outcome away.
   */
  const kept = new Map<
    number,
    { readonly outcome: AiResponse; readonly timer: ReturnType<typeof setTimeout> }
  >();
  /** Those answered `waiting` whose outcome is still to come. */
  const parked = new Set<number>();
  // From a random start: an id an app kept from the site open before can't name one of this one's.
  let nextId = deps.firstId ?? 1 + ((crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 2 ** 30);

  /** Asks the person, then opens Add files: what came of request `id`. */
  const run = async (id: number, asked: MediaAsk): Promise<AiResponse> => {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), deps.askForMs ?? CONFIRM_TIMEOUT_MS);
    let chose: boolean;
    try {
      chose = await deps.ask(asked, timeout.signal);
    } finally {
      clearTimeout(timer);
    }
    if (!chose) return { status: "declined", message: "The person didn't add files." };
    if (open?.id === id) open.step = "choosing";
    const items = await deps.choose();
    if (items.length === 0) return { status: "declined", message: "The person chose no files." };
    deps.add(items);
    return {
      status: "done",
      data: {
        added: items.map(({ id: mediaId, fileName, kind }) => ({ id: mediaId, fileName, kind })),
      },
    };
  };

  const requestMedia = async (app: string, input: unknown): Promise<AiResponse> => {
    const parsed = requestMediaInput.safeParse(input);
    if (!parsed.success) return { status: "invalid", message: z.prettifyError(parsed.error) };
    if (open !== undefined) {
      if (open.app !== app) return OTHER_APP;
      // Its outcome is kept for mediaStatus, whichever ask is answered first.
      parked.add(open.id);
      return waiting(open.id, open.step, true);
    }
    if (deps.busy()) return BUSY;
    const id = nextId++;
    open = { id, app, step: "asking" };
    const outcome = run(id, { app, reason: parsed.data.reason })
      .catch((): AiResponse => ({ status: "declined", message: "No files were added." }))
      .then((response) => {
        if (open?.id === id) open = undefined;
        if (parked.delete(id)) {
          const timer = setTimeout(() => kept.delete(id), keepMs);
          kept.set(id, { outcome: response, timer });
        }
        return response;
      });
    let within: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<"late">((resolve) => {
      within = setTimeout(() => resolve("late"), answerWithinMs);
    });
    const first = await Promise.race([outcome, late]);
    clearTimeout(within);
    if (first !== "late") return first;
    parked.add(id);
    return waiting(id, open?.step ?? "choosing", false);
  };

  return {
    requestMedia: async (request) =>
      request.kind === "command"
        ? requestMedia(request.app, request.input)
        : { status: "invalid", message: "requestMedia is a command." },
    mediaStatus: (request) => {
      const parsed = mediaStatusInput.safeParse(request.input);
      if (!parsed.success) return { status: "invalid", message: z.prettifyError(parsed.error) };
      const { requestId } = parsed.data;
      if (open?.id === requestId && parked.has(requestId))
        return waiting(requestId, open.step, false);
      return kept.get(requestId)?.outcome ?? notFound(requestId);
    },
    close: () => {
      for (const { timer } of kept.values()) clearTimeout(timer);
      kept.clear();
      parked.clear();
    },
  };
}
