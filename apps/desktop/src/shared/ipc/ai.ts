import { BUSINESS_TYPES, SITE_NAME_MAX, siteSettingsSchema } from "@webforge/model";
import { businessDetailsSchema, TEMPLATE_IDS } from "@webforge/templates";
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

/**
 * The window's one tool that changes the site (4.12b, AIB-7): it asks the person for pictures or
 * files through Webforge's own *Add files* dialog, with the app's reason. The app never gives a
 * path or an address, and Webforge fetches nothing: the person chooses what's added.
 */
export const REQUEST_MEDIA = {
  name: "requestMedia",
  description:
    'Asks the person to add pictures or files to the site\'s Media, with your reason ("Photos of your workshop and team"), through Webforge\'s own Add files dialog. You never give a path or a web address, and nothing is downloaded: the person chooses the files on their computer, or adds none. Answers with the id, file name and kind of each one added, which updateFields takes as { "mediaId": id }. If it times out while the person is still choosing, the media query shows what they added.',
  input: z.strictObject({ reason: z.string().trim().min(1).max(200) }),
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

/** The in-app assistant's app id in the tool layer (6.9b): paired apps' are random UUIDs. */
export const ASSISTANT_APP_ID = "assistant";

/**
 * The assistant's reply whose changes are held (6.9e, _Review before applying_): its requests go
 * to a draft of the site in the window, never to the site. Only the assistant's server sets it.
 */
const stageSchema = z.uuid();

/**
 * What an AI app asks of the open site (F-AI-1, 4.8): a query that reads it, or a command that
 * changes it, on behalf of the app the person paired (4.9). Main checks it and forwards it (S21);
 * the renderer runs it.
 */
export const aiRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("query"),
    name: nameSchema,
    input: inputSchema,
    stage: stageSchema.optional(),
  }),
  z.strictObject({
    kind: z.literal("command"),
    name: nameSchema,
    input: inputSchema,
    /** The app's name, as the person gave it when pairing: "AI (‹app›): …" in Undo History. */
    app: z.string().min(1).max(80),
    stage: stageSchema.optional(),
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
    /** Its undo step and what it changed: the assistant's alone (6.9b), never an AI app's. */
    entryId: z.string().min(1).max(200).optional(),
    target: z
      .strictObject({
        pageId: z.string().min(1).max(200),
        nodeId: z.string().min(1).max(200).optional(),
      })
      .optional(),
  }),
  z.strictObject({
    status: z.enum(["invalid", "not-found", "refused", "busy", "declined"]),
    message: z.string(),
  }),
  /**
   * A brief the person is still checking (4.12a): main's own answer, never the window's. The app
   * asks `briefStatus` with its id later.
   */
  z.strictObject({
    status: z.literal("waiting"),
    data: z.strictObject({ briefId: z.int().positive() }),
    message: z.string(),
  }),
]);

/** See {@link aiResponseSchema}. */
export type AiResponse = z.infer<typeof aiResponseSchema>;

/** A request's id, which its answer names. */
const requestIdSchema = z.int().positive();

/**
 * A site an AI app describes (4.12a, AIB-5): the quick start's answers, which Webforge opens the
 * quick start with for the person to check and create, or not. The type is the one answer it
 * needs; the rest is the quick start's to fill in as it would (QS-6).
 */
export const siteBriefSchema = z.strictObject({
  /** The business type, the quick start's first answer: `food`, `trades`… */
  businessType: z.enum(BUSINESS_TYPES),
  /** Its kind for search engines, one of the type's (`AutoRepair` for a garage). */
  businessKind: siteSettingsSchema.shape.general.shape.businessKind,
  name: z.string().trim().min(1).max(SITE_NAME_MAX),
  /** *What you do*: one line, Site Settings' description. */
  whatYouDo: businessDetailsSchema.shape.description,
  /** One of the type's templates; its first when left out. */
  template: z.enum(TEMPLATE_IDS).optional(),
  /** A theme preset; the template's when left out. */
  theme: z.string().min(1).max(40).optional(),
  /** A brand colour (`#c62828`), or a curated theme's palette by its preset: the theme's own when left out. */
  colours: z
    .union([
      z.strictObject({ colour: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
      z.strictObject({ palette: z.string().min(1).max(40) }),
    ])
    .optional(),
  /** The template's pages to leave out, by id: never its home page. */
  leaveOut: z.array(z.string().min(1).max(100)).max(100).optional(),
  /** The type's page recipes to add, by id. */
  recipes: z.array(z.string().min(1).max(100)).max(50).optional(),
  phone: businessDetailsSchema.shape.phone,
  email: businessDetailsSchema.shape.email,
  address: businessDetailsSchema.shape.address,
  openingHours: businessDetailsSchema.shape.openingHours,
  webAddress: businessDetailsSchema.shape.webAddress,
});

/** See {@link siteBriefSchema}. */
export type SiteBrief = z.infer<typeof siteBriefSchema>;

/**
 * What became of a brief in the window: the person created the site, or closed the quick start;
 * or the window refused it (Content mode) or had a New Site or quick start of the person's open.
 */
const BRIEF_OUTCOMES = ["created", "declined", "refused", "busy"] as const;

/** One of {@link BRIEF_OUTCOMES}. */
export type BriefOutcome = (typeof BRIEF_OUTCOMES)[number];

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
  /**
   * What became of the brief sent with this id (4.12a): sent before the window starts over with a
   * site it created, so it arrives.
   */
  aiBriefAnswer: {
    channel: "ai:brief-answer",
    request: z.tuple([requestIdSchema, z.enum(BRIEF_OUTCOMES)]),
    response: z.null(),
  },
} as const;

/** Messages the main process sends to the renderer in the `ai` domain. */
export const aiEvents = {
  /** An AI app's request, with an id; the renderer answers with `ai:answer` and that id. */
  request: { channel: "ai:request", args: z.tuple([requestIdSchema, aiRequestSchema]) },
  /**
   * Its asker gave up on request `id` (the assistant's Stop, 6.9b): a question the window is
   * asking for it closes, and the command is declined. One already answered is untouched.
   */
  cancel: { channel: "ai:cancel", args: z.tuple([requestIdSchema]) },
  /** An AI app's brief (4.12a): the window opens the quick start with it, filled in. */
  brief: { channel: "ai:brief", args: z.tuple([requestIdSchema, siteBriefSchema]) },
} as const;

/** `window.webforge.ai`. */
export interface AiApi {
  /**
   * Answers AI apps' requests with `answer` until the returned function is called; meanwhile the
   * main process knows a site is open to ask.
   */
  onRequest(
    sessionId: string,
    answer: (request: AiRequest, onCancel: (cancelled: () => void) => void) => Promise<AiResponse>,
  ): () => void;
  /**
   * Calls `open` with each AI app's brief (4.12a) until the returned function is called: the window
   * shows the quick start filled in, and tells main what became of it with `answer`, which it waits
   * for before starting over with a new site.
   */
  onBrief(
    open: (brief: SiteBrief, answer: (outcome: BriefOutcome) => Promise<void>) => void,
  ): () => void;
}
