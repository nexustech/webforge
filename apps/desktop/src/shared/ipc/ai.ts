import { z } from "zod";
import { sessionIdSchema } from "./project.js";

/**
 * The tools the window answers itself, beside the command layer's (4.9): what each does, for an AI
 * app. Each takes nothing, so none can be pointed at an address, a path or a host.
 */
export const APP_TOOLS = {
  runSiteCheck:
    "Runs Site Check on the open site, as the person's Site Check panel does for an export: " +
    "each rule that found something, by its id, its title and its level (must, should or tip), " +
    "with the places by id (a page, an element, a Media item, a menu item). It never gives a " +
    "finding's text: read the place with pageTree or fields.",
  openPreview:
    "Opens the open site's preview in the person's browser on this computer, as the Preview " +
    "command does, showing the page shown in Webforge. It takes nothing, and never opens the " +
    "phone preview. A second request within a few seconds opens nothing more.",
} as const;

/** The name of one of {@link APP_TOOLS}. */
export type AppToolName = keyof typeof APP_TOOLS;

/** Whether `name` is one of {@link APP_TOOLS}. */
export const isAppTool = (name: string): name is AppToolName => Object.hasOwn(APP_TOOLS, name);

/** A query's or command's name: `outline`, `addNode`. Which ones exist, the renderer checks. */
const nameSchema = z.string().regex(/^[a-zA-Z]{1,64}$/);

/** The most an AI app's request may carry as JSON: well over any command's input (S21). */
export const AI_INPUT_MAX_CHARS = 256_000;

/** Whether `input` fits in {@link AI_INPUT_MAX_CHARS} as JSON; a value JSON can't hold doesn't. */
const fitsAsJson = (input: unknown) => {
  try {
    return (JSON.stringify(input) ?? "").length <= AI_INPUT_MAX_CHARS;
  } catch {
    return false;
  }
};

/** A request's input: whatever its query or command takes, which the renderer checks. */
const inputSchema = z.unknown().refine(fitsAsJson, {
  message: `A request's input can be at most ${AI_INPUT_MAX_CHARS} characters as JSON.`,
});

/**
 * What an AI app asks of the open site (F-AI-1, 4.8): a query that reads it, or a command that
 * changes it, on behalf of the app the person paired (4.9). Main checks it and forwards it (S21);
 * the renderer runs it.
 */
export const aiRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("query"), name: nameSchema, input: inputSchema }),
  z.strictObject({
    kind: z.literal("command"),
    name: nameSchema,
    input: inputSchema,
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
  /**
   * Whether the window answers AI apps' requests for the site opened as `sessionId`: it does while
   * that site is open in it (#663). Main sends none once another site has opened, or while the
   * window reloads.
   */
  aiListening: {
    channel: "ai:listening",
    request: z.tuple([sessionIdSchema, z.boolean()]),
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
  onRequest(sessionId: string, answer: (request: AiRequest) => Promise<AiResponse>): () => void;
}
