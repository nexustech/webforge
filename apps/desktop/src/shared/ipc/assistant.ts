import { z } from "zod";
import { sessionIdSchema } from "./project.js";

/**
 * The `assistant` domain (6.9a–c, ADR 0026 §7): the contract between main, which runs the
 * assistant, and its panel. A change to it needs a note to the panel's stream.
 */

/** The version of the app's consent wording (ADR 0026 §4): a change to the facts raises it. */
export const ASSISTANT_CONSENT_VERSION = 1;

/** The monthly limit's bounds, and its default, in US dollars (AIA-8). */
const MONTHLY_LIMIT_MIN_USD = 1;
const MONTHLY_LIMIT_MAX_USD = 1000;
export const MONTHLY_LIMIT_DEFAULT_USD = 5;

/** The longest message the person can send. */
const MESSAGE_MAX_CHARS = 8000;

const baseUrlSchema = z
  .string()
  .max(2000)
  .refine((value) => URL.canParse(value) && /^https?:$/.test(new URL(value).protocol), {
    message: "A server's address starts with http:// or https://.",
  });

/** Where requests go (§2). Never a key: only whether there is one. */
const providerSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("openrouter"), signedIn: z.boolean() }),
  z.strictObject({ kind: z.enum(["ollama", "lmstudio"]), baseUrl: baseUrlSchema }),
  z.strictObject({ kind: z.literal("server"), baseUrl: baseUrlSchema, hasKey: z.boolean() }),
]);

/** See {@link providerSchema}. */
type AssistantProvider = z.infer<typeof providerSchema>;

/** Whether requests leave this computer: the consent's wording, and whether a site is asked. */
const reachSchema = z.enum(["this-computer", "openrouter", "server"]);

/** See {@link reachSchema}. */
type Reach = z.infer<typeof reachSchema>;

/** A model the person can choose (§2). */
const modelSchema = z.strictObject({
  /** As the provider names it: `anthropic/claude-sonnet-4.5`. */
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  /** Who made it: "Anthropic"; null for a local model. */
  maker: z.string().min(1).max(100).nullable(),
  /** On Webforge's tested list. */
  tested: z.boolean(),
  /** Has a zero-data-retention endpoint (OpenRouter only). */
  zdr: z.boolean(),
  /** The rough cost of a typical reply, in US dollars; null when unpriced. */
  perReplyUsd: z.number().nonnegative().nullable(),
  /** Over the price threshold: asks once before it's chosen. */
  pricey: z.boolean(),
});

/** See {@link modelSchema}. */
export type AssistantModel = z.infer<typeof modelSchema>;

const monthSchema = z.strictObject({
  spentUsd: z.number().nonnegative(),
  limitUsd: z.number().min(MONTHLY_LIMIT_MIN_USD).max(MONTHLY_LIMIT_MAX_USD),
});

/** See {@link monthSchema}. */
type AssistantMonth = z.infer<typeof monthSchema>;

/** The assistant as the panel and Settings show it. */
const statusSchema = z.strictObject({
  /** The app's consent given and not turned off. */
  enabled: z.boolean(),
  /** The app consent's wording the person agreed to; null before they have. */
  consentVersion: z.int().positive().nullable(),
  /**
   * Where the consent was given for (ADR 0026 §4): its wording depends on it. A change of provider
   * that this doesn't cover leaves `enabled` false until the person agrees again.
   */
  consentReach: z
    .strictObject({ reach: reachSchema, host: z.string().min(1).max(300).optional() })
    .nullable(),
  provider: providerSchema,
  reach: reachSchema,
  model: modelSchema.nullable(),
  month: monthSchema.extend({
    /** The 80% warning has been given this month. */
    warned: z.boolean(),
    /** The limit is reached: nothing is sent until next month or a higher limit. */
    reached: z.boolean(),
  }),
  /** AIA-5's setting: always false, and not shown, until 6.9b stages commands (ADR 0026 §7). */
  reviewBeforeApplying: z.boolean(),
  /** Advanced: models that may keep requests (§2); false by default. */
  allowRetainingModels: z.boolean(),
});

/** See {@link statusSchema}. */
export type AssistantStatus = z.infer<typeof statusSchema>;

/** What Settings changes; what's left out stays as it is. */
const settingsSchema = z.strictObject({
  provider: z
    .discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("openrouter") }),
      z.strictObject({ kind: z.enum(["ollama", "lmstudio"]), baseUrl: baseUrlSchema.optional() }),
      z.strictObject({ kind: z.literal("server"), baseUrl: baseUrlSchema }),
    ])
    .optional(),
  modelId: modelSchema.shape.id.optional(),
  monthlyLimitUsd: z.number().min(MONTHLY_LIMIT_MIN_USD).max(MONTHLY_LIMIT_MAX_USD).optional(),
  reviewBeforeApplying: z.boolean().optional(),
  allowRetainingModels: z.boolean().optional(),
});

/** See {@link settingsSchema}. */
type AssistantSettings = z.infer<typeof settingsSchema>;

/** What the person had selected when they sent the message (§6). */
const contextSchema = z.strictObject({
  pageId: z.string().min(1).max(100).optional(),
  nodeId: z.string().min(1).max(100).optional(),
});

/** See {@link contextSchema}. */
type MessageContext = z.infer<typeof contextSchema>;

const signInResultSchema = z.strictObject({
  status: z.enum([
    "signed-in",
    "cancelled",
    "timed-out",
    "refused",
    "keychain-unavailable",
    "offline",
    /** A key for a server over plain `http:` that isn't on this computer: never kept (#976). */
    "insecure-server",
    "failed",
  ]),
});

/** See {@link signInResultSchema}. */
type SignInResult = z.infer<typeof signInResultSchema>;

/** Why a message wasn't sent, or a reply stopped early. The panel words each with `t()`. */
export const ASSISTANT_ERRORS = [
  /** The app's or this site's yes is missing (§4). */
  "consent-needed",
  "not-signed-in",
  "no-model",
  /** The month's limit (§5). */
  "limit-reached",
  /** A reply is already under way for this site. */
  "busy",
  /** The session isn't the site open in the window. */
  "no-site",
  /** The provider couldn't be reached. */
  "offline",
  /** The provider refused the key (revoked?): sign in again. */
  "unauthorized",
  /** OpenRouter's 402: the account has run out. */
  "no-credit",
  "rate-limited",
  /** The model, or a ZDR endpoint for it, isn't there now. */
  "model-unavailable",
  /** Any other refusal or malformed answer from the provider. */
  "provider-error",
  /**
   * A key would go over plain `http:` to a server that isn't on this computer, where it and the
   * site's text could be read on the way: nothing is sent (#976).
   */
  "insecure-server",
  "failed",
] as const;

const errorSchema = z.enum(ASSISTANT_ERRORS);

/** One of {@link ASSISTANT_ERRORS}. */
export type AssistantErrorCode = z.infer<typeof errorSchema>;

/** A reply's id, which every event of the reply names. */
const replyIdSchema = z.uuid();

const sendResultSchema = z.union([
  z.strictObject({ status: z.literal("sending"), replyId: replyIdSchema }),
  z.strictObject({ status: errorSchema }),
]);

/** See {@link sendResultSchema}. */
type SendResult = z.infer<typeof sendResultSchema>;

const modelsResultSchema = z.union([
  z.strictObject({ status: z.literal("ok"), models: z.array(modelSchema).max(1000) }),
  z.strictObject({ status: errorSchema }),
]);

/** See {@link modelsResultSchema}. */
type ModelsResult = z.infer<typeof modelsResultSchema>;

/** A change one tool call made: one undo step (§1). */
const stepSchema = z.strictObject({
  /** The `HistoryManager` entry, for *Undo these changes*. */
  entryId: z.string().min(1).max(100),
  /** "AI (Assistant): Edited Hero text". */
  label: z.string().min(1).max(300),
  /** Where it changed the site, for the review card to show on the canvas; none if site-wide. */
  target: z
    .strictObject({
      pageId: z.string().min(1).max(100),
      nodeId: z.string().min(1).max(100).optional(),
    })
    .optional(),
});

/** See {@link stepSchema}. */
export type ReplyStep = z.infer<typeof stepSchema>;

/**
 * A change the reply holds for the person to apply (6.9e, _Review before applying_): what it would
 * do, and where. Nothing in the site has changed, so it has no undo step yet.
 */
const heldSchema = stepSchema.omit({ entryId: true });

/** See {@link heldSchema}. */
export type HeldChange = z.infer<typeof heldSchema>;

/** The most changes one reply holds: its tool calls' cap. */
const HELD_MAX = 25;

/** A link to another website the reply added or changed, by its host as a browser reads it (S18). */
const linkSchema = z.strictObject({
  host: z.string().min(1).max(300),
  href: z.string().min(1).max(2000),
});

/** See {@link linkSchema}. */
export type ReplyLink = z.infer<typeof linkSchema>;

/** Why a reply ended. */
const stopSchema = z.enum([
  "end",
  "stopped",
  "tool-cap",
  "model-call-cap",
  "max-tokens",
  "limit-reached",
]);

/** See {@link stopSchema}. */
export type ReplyStop = z.infer<typeof stopSchema>;

/** One exchange of the conversation, as `conversation()` gives it back. */
const turnSchema = z.strictObject({
  replyId: replyIdSchema,
  /** What the person sent. */
  message: z.string().max(MESSAGE_MAX_CHARS),
  /** The reply's text so far: whole once it has ended. */
  reply: z.string(),
  state: z.enum(["replying", "done", "failed"]),
  stop: stopSchema.optional(),
  error: errorSchema.optional(),
  costUsd: z.number().nonnegative().nullable(),
  steps: z.array(stepSchema),
  links: z.array(linkSchema),
  /**
   * The safety version this reply saved before its first change (S20): on the conversation's
   * first turn that changed something, for a panel opened again to point *Open Version History* at.
   */
  safetyVersion: z
    .strictObject({ versionId: z.string().min(1).max(100), label: z.string().min(1).max(300) })
    .optional(),
  /** The changes it holds, with _Review before applying_ on, until applied or discarded. */
  held: z.array(heldSchema).max(HELD_MAX).optional(),
});

/** See {@link turnSchema}. */
export type ConversationTurn = z.infer<typeof turnSchema>;

/** The longest piece of the site's text a draft takes, and the longest page it reads. */
export const DRAFT_TEXT_MAX = 4000;
const DRAFT_PAGE_MAX = 8000;

/** The longest draft main gives back: twice the longest text a rewrite takes. */
export const DRAFT_RESULT_MAX = 2 * DRAFT_TEXT_MAX;

/** The most texts one page's draft rewrites for the business (QS-7). */
export const DRAFT_TEXTS_MAX = 40;

/** The site's language, as Site Settings holds it (`en-GB`): what a draft is written in. */
const languageSchema = z
  .string()
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/)
  .max(35);

/**
 * What a draft is of (#873): the site's text it needs and nothing more (§6), for main to word the
 * request. Main holds the prompts; the renderer names only the kind.
 */
const draftRequestSchema = z.discriminatedUnion("kind", [
  /** The selected text, rewritten as asked, in its own language (G25a). */
  z.strictObject({
    kind: z.literal("rewrite"),
    how: z.enum(["friendlier", "shorter", "grammar"]),
    text: z.string().trim().min(1).max(DRAFT_TEXT_MAX),
  }),
  /** A page's description for search results and shares, from its title and text (G25b). */
  z.strictObject({
    kind: z.literal("description"),
    language: languageSchema,
    site: z.string().max(200),
    page: z.strictObject({
      title: z.string().max(200),
      text: z.string().trim().min(1).max(DRAFT_PAGE_MAX),
    }),
  }),
  /**
   * An image's alt text, from its file's name and the text near it (G25b): never the image
   * itself, as no Media file is ever sent (§6).
   */
  z.strictObject({
    kind: z.literal("alt"),
    language: languageSchema,
    fileName: z.string().min(1).max(300),
    page: z.string().max(200),
    nearby: z.string().max(DRAFT_TEXT_MAX),
  }),
  /**
   * A template page's texts rewritten for the business the quick start describes (QS-7): each
   * text's role ("Hero heading") and its sample, answered in the same order.
   */
  z.strictObject({
    kind: z.literal("business"),
    language: languageSchema,
    business: z.strictObject({
      name: z.string().trim().min(1).max(200),
      type: z.string().max(100),
      about: z.string().trim().min(1).max(DRAFT_TEXT_MAX),
    }),
    texts: z
      .array(
        z.strictObject({
          role: z.string().min(1).max(100),
          sample: z.string().max(DRAFT_TEXT_MAX),
        }),
      )
      .min(1)
      .max(DRAFT_TEXTS_MAX),
  }),
]);

/** See {@link draftRequestSchema}. */
export type DraftRequest = z.infer<typeof draftRequestSchema>;

/**
 * A draft: one text, or a business draft's one per text asked, in order, with its cost. Nothing in
 * the site has changed: the renderer shows it for review, and keeps it as one undo step.
 */
const draftResultSchema = z.union([
  z.strictObject({
    status: z.literal("ok"),
    texts: z.array(z.string().max(DRAFT_RESULT_MAX)).min(1).max(DRAFT_TEXTS_MAX),
    costUsd: z.number().nonnegative().nullable(),
  }),
  z.strictObject({ status: errorSchema }),
]);

/** See {@link draftResultSchema}. */
export type DraftResult = z.infer<typeof draftResultSchema>;

/** A tool's name, as 4.9's tool layer names it. */
const toolSchema = z.string().regex(/^[a-zA-Z]{1,64}$/);

/** A tool call's id within its reply. */
const callIdSchema = z.string().min(1).max(100);

/**
 * What main tells the panel (ADR 0026 §7), in order per reply. A reply's events name its site's
 * session; `limit` and `status` are the app's, and name none. `reply-done` or `reply-failed` closes
 * every reply `reply-started` began; nothing more comes for it.
 */
const eventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    session: sessionIdSchema,
    type: z.literal("reply-started"),
    replyId: replyIdSchema,
    model: z.string().max(200),
  }),
  /** Streamed text: plain text with limited Markdown; no images or HTML (AIA-9). */
  z.strictObject({
    session: sessionIdSchema,
    type: z.literal("text"),
    replyId: replyIdSchema,
    delta: z.string(),
  }),
  /** A tool call starting (`running`), or how it came out. Read calls carry no step. */
  z.strictObject({
    session: sessionIdSchema,
    type: z.literal("tool"),
    replyId: replyIdSchema,
    callId: callIdSchema,
    tool: toolSchema,
    state: z.enum(["running", "done", "refused", "declined", "busy", "invalid", "failed"]),
    step: stepSchema.optional(),
  }),
  /** The first change of a conversation saved a version first (S20). */
  z.strictObject({
    session: sessionIdSchema,
    type: z.literal("safety-version"),
    replyId: replyIdSchema,
    versionId: z.string().min(1).max(100),
    label: z.string().min(1).max(300),
  }),
  /** The reply has ended: its cost, the month's total, and the review card's content. */
  z.strictObject({
    session: sessionIdSchema,
    type: z.literal("reply-done"),
    replyId: replyIdSchema,
    stop: stopSchema,
    costUsd: z.number().nonnegative().nullable(),
    month: monthSchema,
    steps: z.array(stepSchema),
    links: z.array(linkSchema),
    /** The changes it holds for the person to apply (6.9e); none when they apply at once. */
    held: z.array(heldSchema).max(HELD_MAX).optional(),
  }),
  /**
   * A reply's held changes, applied (each now a step) or discarded (6.9e). Applied ones the site
   * no longer allows, such as an element since deleted, are `refused`.
   */
  z.strictObject({
    session: sessionIdSchema,
    type: z.literal("held"),
    replyId: replyIdSchema,
    state: z.enum(["applied", "discarded"]),
    steps: z.array(stepSchema),
    refused: z.array(heldSchema).max(HELD_MAX),
  }),
  z.strictObject({
    session: sessionIdSchema,
    type: z.literal("reply-failed"),
    replyId: replyIdSchema,
    error: errorSchema,
    steps: z.array(stepSchema),
  }),
  /**
   * The month's total crossed 80%, or reached the limit (§5): once each a month. The app's, not a
   * site's: it names no session.
   */
  z.strictObject({
    type: z.literal("limit"),
    level: z.enum(["warning", "reached"]),
    month: monthSchema,
  }),
  /** The status changed in main: sign-in, Turn off, settings, a new month. The app's: no session. */
  z.strictObject({ type: z.literal("status"), status: statusSchema }),
]);

/** See {@link eventSchema}. */
export type AssistantEvent = z.infer<typeof eventSchema>;

/** IPC channels of the `assistant` domain (`assistant:*`). Each one's arguments are checked. */
export const assistantChannels = {
  assistantStatus: {
    channel: "assistant:status",
    request: z.tuple([]),
    response: statusSchema,
  },
  /** The app's consent at the wording `version` shown; `false` is *Turn off*, which deletes the key. */
  assistantSetEnabled: {
    channel: "assistant:set-enabled",
    request: z.tuple([z.boolean(), z.int().positive()]),
    response: statusSchema,
  },
  assistantUpdate: {
    channel: "assistant:update",
    request: z.tuple([settingsSchema]),
    response: statusSchema,
  },
  /** OpenRouter sign-in (§3): `browser`, its callback; `code`, a code OpenRouter shows to paste. */
  assistantSignIn: {
    channel: "assistant:sign-in",
    request: z.tuple([z.enum(["browser", "code"])]),
    response: signInResultSchema,
  },
  /** The code the person pasted, after a `code` sign-in. */
  assistantFinishSignIn: {
    channel: "assistant:finish-sign-in",
    request: z.tuple([z.string().trim().min(1).max(500)]),
    response: signInResultSchema,
  },
  assistantCancelSignIn: {
    channel: "assistant:cancel-sign-in",
    request: z.tuple([]),
    response: z.null(),
  },
  /** A key pasted in Advanced, for the provider chosen: checked with one request first. */
  assistantSetKey: {
    channel: "assistant:set-key",
    request: z.tuple([z.string().trim().min(1).max(500)]),
    response: signInResultSchema,
  },
  assistantModels: {
    channel: "assistant:models",
    request: z.tuple([]),
    response: modelsResultSchema,
  },
  /** This site's consent (§4); `asked` is false until the person has answered. */
  assistantSiteConsent: {
    channel: "assistant:site-consent",
    request: z.tuple([sessionIdSchema]),
    response: z.strictObject({ asked: z.boolean(), allowed: z.boolean() }),
  },
  assistantSetSiteConsent: {
    channel: "assistant:set-site-consent",
    request: z.tuple([sessionIdSchema, z.boolean()]),
    response: z.null(),
  },
  /** Sends a message in the site's conversation; the reply comes as events with its `replyId`. */
  assistantSend: {
    channel: "assistant:send",
    request: z.tuple([
      sessionIdSchema,
      z.string().trim().min(1).max(MESSAGE_MAX_CHARS),
      contextSchema,
    ]),
    response: sendResultSchema,
  },
  /**
   * A one-off draft of the site's text (#873), outside the conversation and with no tools: main
   * makes one model call and answers with the text. It changes nothing in the site.
   */
  assistantDraft: {
    channel: "assistant:draft",
    request: z.tuple([sessionIdSchema, draftRequestSchema]),
    response: draftResultSchema,
  },
  /** Stops the reply: no further model or tool call. Changes made stay, and stay undoable. */
  assistantStop: {
    channel: "assistant:stop",
    request: z.tuple([replyIdSchema]),
    response: z.null(),
  },
  /** Forgets the site's conversation (*New conversation*). */
  assistantNewConversation: {
    channel: "assistant:new-conversation",
    request: z.tuple([sessionIdSchema]),
    response: z.null(),
  },
  /**
   * Opens a link from a reply in the person's browser, once they've clicked it: its address as the
   * reply wrote it (the Markdown token's `href`). Main opens only a web address that reply holds,
   * in its own copy of the conversation.
   */
  assistantOpenLink: {
    channel: "assistant:open-link",
    request: z.tuple([sessionIdSchema, replyIdSchema, z.string().min(1).max(2000)]),
    response: z.strictObject({ status: z.enum(["opened", "refused", "failed"]) }),
  },
  /**
   * Applies a reply's held changes (6.9e): each as the undo step it would have been, asking the
   * person where it would. The outcome comes as a `held` event too.
   */
  assistantApplyHeld: {
    channel: "assistant:apply-held",
    request: z.tuple([sessionIdSchema, replyIdSchema]),
    response: z.strictObject({ status: z.enum(["applied", "nothing-held", "busy", "no-site"]) }),
  },
  /** Discards a reply's held changes (6.9e): the site stays as it is. */
  assistantDiscardHeld: {
    channel: "assistant:discard-held",
    request: z.tuple([sessionIdSchema, replyIdSchema]),
    response: z.null(),
  },
  /** The site's conversation so far, for a panel opened again. */
  assistantConversation: {
    channel: "assistant:conversation",
    request: z.tuple([sessionIdSchema]),
    response: z.array(turnSchema).max(500),
  },
} as const;

/** Messages the main process sends the editor window. Its preload checks each one's arguments. */
export const assistantEvents = {
  event: { channel: "assistant:event", args: z.tuple([eventSchema]) },
} as const;

/** `window.webforge.assistant` (ADR 0026 §7). */
export interface AssistantApi {
  status(): Promise<AssistantStatus>;
  /** The app's consent at the wording `version`; `false` is *Turn off*: it deletes the key. */
  setEnabled(enabled: boolean, version: number): Promise<AssistantStatus>;
  update(settings: AssistantSettings): Promise<AssistantStatus>;
  /** OpenRouter sign-in: `browser`, its callback; `code`, OpenRouter shows a code to paste. */
  signIn(mode: "browser" | "code"): Promise<SignInResult>;
  /** The code the person pasted, after `signIn("code")`. */
  finishSignIn(code: string): Promise<SignInResult>;
  /** Stops a sign-in waiting for its callback or code. */
  cancelSignIn(): Promise<void>;
  /** A key pasted in Advanced: OpenRouter's, or Another server's. */
  setKey(key: string): Promise<SignInResult>;
  models(): Promise<ModelsResult>;
  siteConsent(session: string): Promise<{ asked: boolean; allowed: boolean }>;
  setSiteConsent(session: string, allowed: boolean): Promise<void>;
  /** Sends a message; the reply comes as events with the `replyId` this answers. */
  send(session: string, text: string, context: MessageContext): Promise<SendResult>;
  /**
   * A one-off draft of the site's text, with no tools (#873): the same checks as `send`, one
   * model call, its cost added to the month's. It changes nothing: the renderer keeps it, after
   * the person has reviewed it, as one undo step.
   */
  draft(session: string, request: DraftRequest): Promise<DraftResult>;
  /** Stops the reply: changes made stay, and stay undoable. */
  stop(replyId: string): Promise<void>;
  newConversation(session: string): Promise<void>;
  /**
   * Applies reply `replyId`'s held changes (6.9e): `nothing-held` if it holds none, `busy` while
   * a reply or another apply is under way.
   */
  applyHeld(
    session: string,
    replyId: string,
  ): Promise<{ status: "applied" | "nothing-held" | "busy" | "no-site" }>;
  /** Discards reply `replyId`'s held changes (6.9e). */
  discardHeld(session: string, replyId: string): Promise<void>;
  conversation(session: string): Promise<ConversationTurn[]>;
  /**
   * Opens `href`, a link in that reply as the reply wrote it (its Markdown token's `href`), in the
   * browser: only a web address the reply holds.
   */
  openLink(
    session: string,
    replyId: string,
    href: string,
  ): Promise<{ status: "opened" | "refused" | "failed" }>;
  /** Calls `listener` with each event main pushes. Returns a stop function. */
  onEvent(listener: (event: AssistantEvent) => void): () => void;
}
