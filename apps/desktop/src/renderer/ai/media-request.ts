import { CONFIRM_TIMEOUT_MS } from "@webforge/commands";
import type { MediaMeta } from "@webforge/model";
import { z } from "zod";
import { type AiRequest, type AiResponse, REQUEST_MEDIA } from "../../shared/ipc/ai.js";

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
};

const BUSY: AiResponse = {
  status: "busy",
  message: "The person is editing, or answering another question: try again shortly.",
};

/**
 * The window's answer to `requestMedia` (4.12b, AIB-7): `undefined` for any other request. It
 * asks the person, with the app's reason, whether to add pictures or files; on **Add Files…** it
 * opens Webforge's own Add files dialog, and answers with the id, file name and kind of each one
 * the person added. The app never names a file, and nothing is fetched. One question at a time.
 */
export function createMediaRequests(
  deps: MediaRequestDeps,
): (request: AiRequest) => Promise<AiResponse> | undefined {
  let asking = false;
  const answer = async (app: string, input: unknown): Promise<AiResponse> => {
    const parsed = REQUEST_MEDIA.input.safeParse(input);
    if (!parsed.success) return { status: "invalid", message: z.prettifyError(parsed.error) };
    if (asking || deps.busy()) return BUSY;
    asking = true;
    try {
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), deps.askForMs ?? CONFIRM_TIMEOUT_MS);
      let chose: boolean;
      try {
        chose = await deps.ask({ app, reason: parsed.data.reason }, timeout.signal);
      } finally {
        clearTimeout(timer);
      }
      if (!chose) return { status: "declined", message: "The person didn't add files." };
      const items = await deps.choose();
      if (items.length === 0) {
        return { status: "declined", message: "The person chose no files." };
      }
      deps.add(items);
      return {
        status: "done",
        data: { added: items.map(({ id, fileName, kind }) => ({ id, fileName, kind })) },
      };
    } finally {
      asking = false;
    }
  };
  return (request) =>
    request.kind === "command" && request.name === REQUEST_MEDIA.name
      ? answer(request.app, request.input)
      : undefined;
}
