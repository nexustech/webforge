import { z } from "zod";

/** A query's or command's name: `outline`, `addNode`. Which ones exist, the renderer checks. */
const nameSchema = z.string().regex(/^[a-zA-Z]{1,64}$/);

/**
 * What an AI app asks of the open site (F-AI-1, 4.8): a query that reads it, or a command that
 * changes it, on behalf of the app the person paired (4.9). Main forwards it; the renderer runs it.
 */
const aiRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("query"), name: nameSchema, input: z.unknown() }),
  z.strictObject({
    kind: z.literal("command"),
    name: nameSchema,
    input: z.unknown(),
    /** The app's name, as the person gave it when pairing: "AI (‹app›): …" in Undo History. */
    app: z.string().min(1).max(80),
  }),
]);

/** See {@link aiRequestSchema}. */
export type AiRequest = z.infer<typeof aiRequestSchema>;

/**
 * What came of a request: a query's data, a command done as one undo step, or why nothing changed.
 * `not-found` also answers when no site is open.
 */
const aiResponseSchema = z.union([
  z.strictObject({ status: z.literal("done"), data: z.unknown() }),
  z.strictObject({
    status: z.literal("done"),
    label: z.string().min(1),
    id: z.string().min(1).optional(),
  }),
  z.strictObject({
    status: z.enum(["invalid", "not-found", "refused", "busy", "declined"]),
    message: z.string(),
  }),
]);

/** See {@link aiResponseSchema}. */
export type AiResponse = z.infer<typeof aiResponseSchema>;

/** A request's id, which its answer names. */
const requestIdSchema = z.int().positive();

/** IPC channels of the `ai` domain (`ai:*`). Each one's arguments are checked. */
export const aiChannels = {
  /** The renderer's answer to the `ai:request` sent with this id. */
  aiAnswer: {
    channel: "ai:answer",
    request: z.tuple([requestIdSchema, aiResponseSchema]),
    response: z.null(),
  },
  /** Whether the window answers AI apps' requests: it does while a site is open in it. */
  aiListening: {
    channel: "ai:listening",
    request: z.tuple([z.boolean()]),
    response: z.null(),
  },
} as const;

/** Messages the main process sends to the renderer in the `ai` domain. */
export const aiEvents = {
  /** An AI app's request, with an id; the renderer answers with `ai:answer` and that id. */
  request: { channel: "ai:request", args: z.tuple([requestIdSchema, aiRequestSchema]) },
} as const;

/** `window.webforge.ai`. */
export interface AiApi {
  /**
   * Answers AI apps' requests with `answer` until the returned function is called; meanwhile the
   * main process knows a site is open to ask.
   */
  onRequest(answer: (request: AiRequest) => Promise<AiResponse>): () => void;
}
