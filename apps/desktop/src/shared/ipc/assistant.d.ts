import { z } from "zod";
/**
 * The `assistant` domain (6.9a–c, ADR 0026 §7): the contract between main, which runs the
 * assistant, and its panel. A change to it needs a note to the panel's stream.
 */
/** The version of the app's consent wording (ADR 0026 §4): a change to the facts raises it. */
export declare const ASSISTANT_CONSENT_VERSION = 1;
export declare const MONTHLY_LIMIT_DEFAULT_USD = 5;
/** A model the person can choose (§2). */
declare const modelSchema: z.ZodObject<
  {
    id: z.ZodString;
    name: z.ZodString;
    maker: z.ZodNullable<z.ZodString>;
    tested: z.ZodBoolean;
    zdr: z.ZodBoolean;
    perReplyUsd: z.ZodNullable<z.ZodNumber>;
    pricey: z.ZodBoolean;
  },
  z.core.$strict
>;
/** See {@link modelSchema}. */
export type AssistantModel = z.infer<typeof modelSchema>;
/** The assistant as the panel and Settings show it. */
declare const statusSchema: z.ZodObject<
  {
    enabled: z.ZodBoolean;
    consentVersion: z.ZodNullable<z.ZodInt>;
    consentReach: z.ZodNullable<
      z.ZodObject<
        {
          reach: z.ZodEnum<{
            openrouter: "openrouter";
            server: "server";
            "this-computer": "this-computer";
          }>;
          host: z.ZodOptional<z.ZodString>;
        },
        z.core.$strict
      >
    >;
    provider: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<
          {
            kind: z.ZodLiteral<"openrouter">;
            signedIn: z.ZodBoolean;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            kind: z.ZodEnum<{
              lmstudio: "lmstudio";
              ollama: "ollama";
            }>;
            baseUrl: z.ZodString;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            kind: z.ZodLiteral<"server">;
            baseUrl: z.ZodString;
            hasKey: z.ZodBoolean;
          },
          z.core.$strict
        >,
      ],
      "kind"
    >;
    reach: z.ZodEnum<{
      openrouter: "openrouter";
      server: "server";
      "this-computer": "this-computer";
    }>;
    model: z.ZodNullable<
      z.ZodObject<
        {
          id: z.ZodString;
          name: z.ZodString;
          maker: z.ZodNullable<z.ZodString>;
          tested: z.ZodBoolean;
          zdr: z.ZodBoolean;
          perReplyUsd: z.ZodNullable<z.ZodNumber>;
          pricey: z.ZodBoolean;
        },
        z.core.$strict
      >
    >;
    month: z.ZodObject<
      {
        spentUsd: z.ZodNumber;
        limitUsd: z.ZodNumber;
        warned: z.ZodBoolean;
        reached: z.ZodBoolean;
      },
      z.core.$strict
    >;
    reviewBeforeApplying: z.ZodBoolean;
    allowRetainingModels: z.ZodBoolean;
  },
  z.core.$strict
>;
/** See {@link statusSchema}. */
export type AssistantStatus = z.infer<typeof statusSchema>;
/** What Settings changes; what's left out stays as it is. */
declare const settingsSchema: z.ZodObject<
  {
    provider: z.ZodOptional<
      z.ZodDiscriminatedUnion<
        [
          z.ZodObject<
            {
              kind: z.ZodLiteral<"openrouter">;
            },
            z.core.$strict
          >,
          z.ZodObject<
            {
              kind: z.ZodEnum<{
                lmstudio: "lmstudio";
                ollama: "ollama";
              }>;
              baseUrl: z.ZodOptional<z.ZodString>;
            },
            z.core.$strict
          >,
          z.ZodObject<
            {
              kind: z.ZodLiteral<"server">;
              baseUrl: z.ZodString;
            },
            z.core.$strict
          >,
        ],
        "kind"
      >
    >;
    modelId: z.ZodOptional<z.ZodString>;
    monthlyLimitUsd: z.ZodOptional<z.ZodNumber>;
    reviewBeforeApplying: z.ZodOptional<z.ZodBoolean>;
    allowRetainingModels: z.ZodOptional<z.ZodBoolean>;
  },
  z.core.$strict
>;
/** See {@link settingsSchema}. */
type AssistantSettings = z.infer<typeof settingsSchema>;
/** What the person had selected when they sent the message (§6). */
declare const contextSchema: z.ZodObject<
  {
    pageId: z.ZodOptional<z.ZodString>;
    nodeId: z.ZodOptional<z.ZodString>;
  },
  z.core.$strict
>;
/** See {@link contextSchema}. */
type MessageContext = z.infer<typeof contextSchema>;
declare const signInResultSchema: z.ZodObject<
  {
    status: z.ZodEnum<{
      cancelled: "cancelled";
      failed: "failed";
      "insecure-server": "insecure-server";
      "keychain-unavailable": "keychain-unavailable";
      offline: "offline";
      refused: "refused";
      "signed-in": "signed-in";
      "timed-out": "timed-out";
    }>;
  },
  z.core.$strict
>;
/** See {@link signInResultSchema}. */
type SignInResult = z.infer<typeof signInResultSchema>;
/** Why a message wasn't sent, or a reply stopped early. The panel words each with `t()`. */
export declare const ASSISTANT_ERRORS: readonly [
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
];
declare const errorSchema: z.ZodEnum<{
  busy: "busy";
  "consent-needed": "consent-needed";
  failed: "failed";
  "insecure-server": "insecure-server";
  "limit-reached": "limit-reached";
  "model-unavailable": "model-unavailable";
  "no-credit": "no-credit";
  "no-model": "no-model";
  "no-site": "no-site";
  "not-signed-in": "not-signed-in";
  offline: "offline";
  "provider-error": "provider-error";
  "rate-limited": "rate-limited";
  unauthorized: "unauthorized";
}>;
/** One of {@link ASSISTANT_ERRORS}. */
export type AssistantErrorCode = z.infer<typeof errorSchema>;
declare const sendResultSchema: z.ZodUnion<
  readonly [
    z.ZodObject<
      {
        status: z.ZodLiteral<"sending">;
        replyId: z.ZodUUID;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodEnum<{
          busy: "busy";
          "consent-needed": "consent-needed";
          failed: "failed";
          "insecure-server": "insecure-server";
          "limit-reached": "limit-reached";
          "model-unavailable": "model-unavailable";
          "no-credit": "no-credit";
          "no-model": "no-model";
          "no-site": "no-site";
          "not-signed-in": "not-signed-in";
          offline: "offline";
          "provider-error": "provider-error";
          "rate-limited": "rate-limited";
          unauthorized: "unauthorized";
        }>;
      },
      z.core.$strict
    >,
  ]
>;
/** See {@link sendResultSchema}. */
type SendResult = z.infer<typeof sendResultSchema>;
declare const modelsResultSchema: z.ZodUnion<
  readonly [
    z.ZodObject<
      {
        status: z.ZodLiteral<"ok">;
        models: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              name: z.ZodString;
              maker: z.ZodNullable<z.ZodString>;
              tested: z.ZodBoolean;
              zdr: z.ZodBoolean;
              perReplyUsd: z.ZodNullable<z.ZodNumber>;
              pricey: z.ZodBoolean;
            },
            z.core.$strict
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodEnum<{
          busy: "busy";
          "consent-needed": "consent-needed";
          failed: "failed";
          "insecure-server": "insecure-server";
          "limit-reached": "limit-reached";
          "model-unavailable": "model-unavailable";
          "no-credit": "no-credit";
          "no-model": "no-model";
          "no-site": "no-site";
          "not-signed-in": "not-signed-in";
          offline: "offline";
          "provider-error": "provider-error";
          "rate-limited": "rate-limited";
          unauthorized: "unauthorized";
        }>;
      },
      z.core.$strict
    >,
  ]
>;
/** See {@link modelsResultSchema}. */
type ModelsResult = z.infer<typeof modelsResultSchema>;
/** A change one tool call made: one undo step (§1). */
declare const stepSchema: z.ZodObject<
  {
    entryId: z.ZodString;
    label: z.ZodString;
    target: z.ZodOptional<
      z.ZodObject<
        {
          pageId: z.ZodString;
          nodeId: z.ZodOptional<z.ZodString>;
        },
        z.core.$strict
      >
    >;
  },
  z.core.$strict
>;
/** See {@link stepSchema}. */
export type ReplyStep = z.infer<typeof stepSchema>;
/**
 * A change the reply holds for the person to apply (6.9e, _Review before applying_): what it would
 * do, and where. Nothing in the site has changed, so it has no undo step yet.
 */
declare const heldSchema: z.ZodObject<
  {
    label: z.ZodString;
    target: z.ZodOptional<
      z.ZodObject<
        {
          pageId: z.ZodString;
          nodeId: z.ZodOptional<z.ZodString>;
        },
        z.core.$strict
      >
    >;
  },
  z.core.$strict
>;
/** See {@link heldSchema}. */
export type HeldChange = z.infer<typeof heldSchema>;
/** A link to another website the reply added or changed, by its host as a browser reads it (S18). */
declare const linkSchema: z.ZodObject<
  {
    host: z.ZodString;
    href: z.ZodString;
  },
  z.core.$strict
>;
/** See {@link linkSchema}. */
export type ReplyLink = z.infer<typeof linkSchema>;
/** Why a reply ended. */
declare const stopSchema: z.ZodEnum<{
  end: "end";
  "limit-reached": "limit-reached";
  "max-tokens": "max-tokens";
  "model-call-cap": "model-call-cap";
  stopped: "stopped";
  "tool-cap": "tool-cap";
}>;
/** See {@link stopSchema}. */
export type ReplyStop = z.infer<typeof stopSchema>;
/** One exchange of the conversation, as `conversation()` gives it back. */
declare const turnSchema: z.ZodObject<
  {
    replyId: z.ZodUUID;
    message: z.ZodString;
    reply: z.ZodString;
    state: z.ZodEnum<{
      done: "done";
      failed: "failed";
      replying: "replying";
    }>;
    stop: z.ZodOptional<
      z.ZodEnum<{
        end: "end";
        "limit-reached": "limit-reached";
        "max-tokens": "max-tokens";
        "model-call-cap": "model-call-cap";
        stopped: "stopped";
        "tool-cap": "tool-cap";
      }>
    >;
    error: z.ZodOptional<
      z.ZodEnum<{
        busy: "busy";
        "consent-needed": "consent-needed";
        failed: "failed";
        "insecure-server": "insecure-server";
        "limit-reached": "limit-reached";
        "model-unavailable": "model-unavailable";
        "no-credit": "no-credit";
        "no-model": "no-model";
        "no-site": "no-site";
        "not-signed-in": "not-signed-in";
        offline: "offline";
        "provider-error": "provider-error";
        "rate-limited": "rate-limited";
        unauthorized: "unauthorized";
      }>
    >;
    costUsd: z.ZodNullable<z.ZodNumber>;
    steps: z.ZodArray<
      z.ZodObject<
        {
          entryId: z.ZodString;
          label: z.ZodString;
          target: z.ZodOptional<
            z.ZodObject<
              {
                pageId: z.ZodString;
                nodeId: z.ZodOptional<z.ZodString>;
              },
              z.core.$strict
            >
          >;
        },
        z.core.$strict
      >
    >;
    links: z.ZodArray<
      z.ZodObject<
        {
          host: z.ZodString;
          href: z.ZodString;
        },
        z.core.$strict
      >
    >;
    safetyVersion: z.ZodOptional<
      z.ZodObject<
        {
          versionId: z.ZodString;
          label: z.ZodString;
        },
        z.core.$strict
      >
    >;
    held: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            label: z.ZodString;
            target: z.ZodOptional<
              z.ZodObject<
                {
                  pageId: z.ZodString;
                  nodeId: z.ZodOptional<z.ZodString>;
                },
                z.core.$strict
              >
            >;
          },
          z.core.$strict
        >
      >
    >;
  },
  z.core.$strict
>;
/** See {@link turnSchema}. */
export type ConversationTurn = z.infer<typeof turnSchema>;
/** The longest piece of the site's text a draft takes, and the longest page it reads. */
export declare const DRAFT_TEXT_MAX = 4000;
/** The longest draft main gives back: twice the longest text a rewrite takes. */
export declare const DRAFT_RESULT_MAX: number;
/** The most texts one page's draft rewrites for the business (QS-7). */
export declare const DRAFT_TEXTS_MAX = 40;
/**
 * What a draft is of (#873): the site's text it needs and nothing more (§6), for main to word the
 * request. Main holds the prompts; the renderer names only the kind.
 */
declare const draftRequestSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        kind: z.ZodLiteral<"rewrite">;
        how: z.ZodEnum<{
          friendlier: "friendlier";
          grammar: "grammar";
          shorter: "shorter";
        }>;
        text: z.ZodString;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        kind: z.ZodLiteral<"description">;
        language: z.ZodString;
        site: z.ZodString;
        page: z.ZodObject<
          {
            title: z.ZodString;
            text: z.ZodString;
          },
          z.core.$strict
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        kind: z.ZodLiteral<"alt">;
        language: z.ZodString;
        fileName: z.ZodString;
        page: z.ZodString;
        nearby: z.ZodString;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        kind: z.ZodLiteral<"business">;
        language: z.ZodString;
        business: z.ZodObject<
          {
            name: z.ZodString;
            type: z.ZodString;
            about: z.ZodString;
          },
          z.core.$strict
        >;
        texts: z.ZodArray<
          z.ZodObject<
            {
              role: z.ZodString;
              sample: z.ZodString;
            },
            z.core.$strict
          >
        >;
      },
      z.core.$strict
    >,
  ],
  "kind"
>;
/** See {@link draftRequestSchema}. */
export type DraftRequest = z.infer<typeof draftRequestSchema>;
/**
 * A draft: one text, or a business draft's one per text asked, in order, with its cost. Nothing in
 * the site has changed: the renderer shows it for review, and keeps it as one undo step.
 */
declare const draftResultSchema: z.ZodUnion<
  readonly [
    z.ZodObject<
      {
        status: z.ZodLiteral<"ok">;
        texts: z.ZodArray<z.ZodString>;
        examples: z.ZodOptional<z.ZodArray<z.ZodBoolean>>;
        costUsd: z.ZodNullable<z.ZodNumber>;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        status: z.ZodEnum<{
          busy: "busy";
          "consent-needed": "consent-needed";
          failed: "failed";
          "insecure-server": "insecure-server";
          "limit-reached": "limit-reached";
          "model-unavailable": "model-unavailable";
          "no-credit": "no-credit";
          "no-model": "no-model";
          "no-site": "no-site";
          "not-signed-in": "not-signed-in";
          offline: "offline";
          "provider-error": "provider-error";
          "rate-limited": "rate-limited";
          unauthorized: "unauthorized";
        }>;
      },
      z.core.$strict
    >,
  ]
>;
/** See {@link draftResultSchema}. */
export type DraftResult = z.infer<typeof draftResultSchema>;
/**
 * What main tells the panel (ADR 0026 §7), in order per reply. A reply's events name its site's
 * session; `limit` and `status` are the app's, and name none. `reply-done` or `reply-failed` closes
 * every reply `reply-started` began; nothing more comes for it.
 */
declare const eventSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        session: z.ZodUUID;
        type: z.ZodLiteral<"reply-started">;
        replyId: z.ZodUUID;
        model: z.ZodString;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        session: z.ZodUUID;
        type: z.ZodLiteral<"text">;
        replyId: z.ZodUUID;
        delta: z.ZodString;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        session: z.ZodUUID;
        type: z.ZodLiteral<"tool">;
        replyId: z.ZodUUID;
        callId: z.ZodString;
        tool: z.ZodString;
        state: z.ZodEnum<{
          busy: "busy";
          declined: "declined";
          done: "done";
          failed: "failed";
          invalid: "invalid";
          refused: "refused";
          running: "running";
        }>;
        step: z.ZodOptional<
          z.ZodObject<
            {
              entryId: z.ZodString;
              label: z.ZodString;
              target: z.ZodOptional<
                z.ZodObject<
                  {
                    pageId: z.ZodString;
                    nodeId: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strict
                >
              >;
            },
            z.core.$strict
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        session: z.ZodUUID;
        type: z.ZodLiteral<"safety-version">;
        replyId: z.ZodUUID;
        versionId: z.ZodString;
        label: z.ZodString;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        session: z.ZodUUID;
        type: z.ZodLiteral<"reply-done">;
        replyId: z.ZodUUID;
        stop: z.ZodEnum<{
          end: "end";
          "limit-reached": "limit-reached";
          "max-tokens": "max-tokens";
          "model-call-cap": "model-call-cap";
          stopped: "stopped";
          "tool-cap": "tool-cap";
        }>;
        costUsd: z.ZodNullable<z.ZodNumber>;
        month: z.ZodObject<
          {
            spentUsd: z.ZodNumber;
            limitUsd: z.ZodNumber;
          },
          z.core.$strict
        >;
        steps: z.ZodArray<
          z.ZodObject<
            {
              entryId: z.ZodString;
              label: z.ZodString;
              target: z.ZodOptional<
                z.ZodObject<
                  {
                    pageId: z.ZodString;
                    nodeId: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strict
                >
              >;
            },
            z.core.$strict
          >
        >;
        links: z.ZodArray<
          z.ZodObject<
            {
              host: z.ZodString;
              href: z.ZodString;
            },
            z.core.$strict
          >
        >;
        held: z.ZodOptional<
          z.ZodArray<
            z.ZodObject<
              {
                label: z.ZodString;
                target: z.ZodOptional<
                  z.ZodObject<
                    {
                      pageId: z.ZodString;
                      nodeId: z.ZodOptional<z.ZodString>;
                    },
                    z.core.$strict
                  >
                >;
              },
              z.core.$strict
            >
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        session: z.ZodUUID;
        type: z.ZodLiteral<"held">;
        replyId: z.ZodUUID;
        state: z.ZodEnum<{
          applied: "applied";
          discarded: "discarded";
        }>;
        steps: z.ZodArray<
          z.ZodObject<
            {
              entryId: z.ZodString;
              label: z.ZodString;
              target: z.ZodOptional<
                z.ZodObject<
                  {
                    pageId: z.ZodString;
                    nodeId: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strict
                >
              >;
            },
            z.core.$strict
          >
        >;
        refused: z.ZodArray<
          z.ZodObject<
            {
              label: z.ZodString;
              target: z.ZodOptional<
                z.ZodObject<
                  {
                    pageId: z.ZodString;
                    nodeId: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strict
                >
              >;
            },
            z.core.$strict
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        session: z.ZodUUID;
        type: z.ZodLiteral<"reply-failed">;
        replyId: z.ZodUUID;
        error: z.ZodEnum<{
          busy: "busy";
          "consent-needed": "consent-needed";
          failed: "failed";
          "insecure-server": "insecure-server";
          "limit-reached": "limit-reached";
          "model-unavailable": "model-unavailable";
          "no-credit": "no-credit";
          "no-model": "no-model";
          "no-site": "no-site";
          "not-signed-in": "not-signed-in";
          offline: "offline";
          "provider-error": "provider-error";
          "rate-limited": "rate-limited";
          unauthorized: "unauthorized";
        }>;
        steps: z.ZodArray<
          z.ZodObject<
            {
              entryId: z.ZodString;
              label: z.ZodString;
              target: z.ZodOptional<
                z.ZodObject<
                  {
                    pageId: z.ZodString;
                    nodeId: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strict
                >
              >;
            },
            z.core.$strict
          >
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"limit">;
        level: z.ZodEnum<{
          reached: "reached";
          warning: "warning";
        }>;
        month: z.ZodObject<
          {
            spentUsd: z.ZodNumber;
            limitUsd: z.ZodNumber;
          },
          z.core.$strict
        >;
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        type: z.ZodLiteral<"status">;
        status: z.ZodObject<
          {
            enabled: z.ZodBoolean;
            consentVersion: z.ZodNullable<z.ZodInt>;
            consentReach: z.ZodNullable<
              z.ZodObject<
                {
                  reach: z.ZodEnum<{
                    openrouter: "openrouter";
                    server: "server";
                    "this-computer": "this-computer";
                  }>;
                  host: z.ZodOptional<z.ZodString>;
                },
                z.core.$strict
              >
            >;
            provider: z.ZodDiscriminatedUnion<
              [
                z.ZodObject<
                  {
                    kind: z.ZodLiteral<"openrouter">;
                    signedIn: z.ZodBoolean;
                  },
                  z.core.$strict
                >,
                z.ZodObject<
                  {
                    kind: z.ZodEnum<{
                      lmstudio: "lmstudio";
                      ollama: "ollama";
                    }>;
                    baseUrl: z.ZodString;
                  },
                  z.core.$strict
                >,
                z.ZodObject<
                  {
                    kind: z.ZodLiteral<"server">;
                    baseUrl: z.ZodString;
                    hasKey: z.ZodBoolean;
                  },
                  z.core.$strict
                >,
              ],
              "kind"
            >;
            reach: z.ZodEnum<{
              openrouter: "openrouter";
              server: "server";
              "this-computer": "this-computer";
            }>;
            model: z.ZodNullable<
              z.ZodObject<
                {
                  id: z.ZodString;
                  name: z.ZodString;
                  maker: z.ZodNullable<z.ZodString>;
                  tested: z.ZodBoolean;
                  zdr: z.ZodBoolean;
                  perReplyUsd: z.ZodNullable<z.ZodNumber>;
                  pricey: z.ZodBoolean;
                },
                z.core.$strict
              >
            >;
            month: z.ZodObject<
              {
                spentUsd: z.ZodNumber;
                limitUsd: z.ZodNumber;
                warned: z.ZodBoolean;
                reached: z.ZodBoolean;
              },
              z.core.$strict
            >;
            reviewBeforeApplying: z.ZodBoolean;
            allowRetainingModels: z.ZodBoolean;
          },
          z.core.$strict
        >;
      },
      z.core.$strict
    >,
  ],
  "type"
>;
/** See {@link eventSchema}. */
export type AssistantEvent = z.infer<typeof eventSchema>;
/** IPC channels of the `assistant` domain (`assistant:*`). Each one's arguments are checked. */
export declare const assistantChannels: {
  readonly assistantStatus: {
    readonly channel: "assistant:status";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodObject<
      {
        enabled: z.ZodBoolean;
        consentVersion: z.ZodNullable<z.ZodInt>;
        consentReach: z.ZodNullable<
          z.ZodObject<
            {
              reach: z.ZodEnum<{
                openrouter: "openrouter";
                server: "server";
                "this-computer": "this-computer";
              }>;
              host: z.ZodOptional<z.ZodString>;
            },
            z.core.$strict
          >
        >;
        provider: z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                kind: z.ZodLiteral<"openrouter">;
                signedIn: z.ZodBoolean;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                kind: z.ZodEnum<{
                  lmstudio: "lmstudio";
                  ollama: "ollama";
                }>;
                baseUrl: z.ZodString;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                kind: z.ZodLiteral<"server">;
                baseUrl: z.ZodString;
                hasKey: z.ZodBoolean;
              },
              z.core.$strict
            >,
          ],
          "kind"
        >;
        reach: z.ZodEnum<{
          openrouter: "openrouter";
          server: "server";
          "this-computer": "this-computer";
        }>;
        model: z.ZodNullable<
          z.ZodObject<
            {
              id: z.ZodString;
              name: z.ZodString;
              maker: z.ZodNullable<z.ZodString>;
              tested: z.ZodBoolean;
              zdr: z.ZodBoolean;
              perReplyUsd: z.ZodNullable<z.ZodNumber>;
              pricey: z.ZodBoolean;
            },
            z.core.$strict
          >
        >;
        month: z.ZodObject<
          {
            spentUsd: z.ZodNumber;
            limitUsd: z.ZodNumber;
            warned: z.ZodBoolean;
            reached: z.ZodBoolean;
          },
          z.core.$strict
        >;
        reviewBeforeApplying: z.ZodBoolean;
        allowRetainingModels: z.ZodBoolean;
      },
      z.core.$strict
    >;
  };
  /** The app's consent at the wording `version` shown; `false` is *Turn off*, which deletes the key. */
  readonly assistantSetEnabled: {
    readonly channel: "assistant:set-enabled";
    readonly request: z.ZodTuple<[z.ZodBoolean, z.ZodInt], null>;
    readonly response: z.ZodObject<
      {
        enabled: z.ZodBoolean;
        consentVersion: z.ZodNullable<z.ZodInt>;
        consentReach: z.ZodNullable<
          z.ZodObject<
            {
              reach: z.ZodEnum<{
                openrouter: "openrouter";
                server: "server";
                "this-computer": "this-computer";
              }>;
              host: z.ZodOptional<z.ZodString>;
            },
            z.core.$strict
          >
        >;
        provider: z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                kind: z.ZodLiteral<"openrouter">;
                signedIn: z.ZodBoolean;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                kind: z.ZodEnum<{
                  lmstudio: "lmstudio";
                  ollama: "ollama";
                }>;
                baseUrl: z.ZodString;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                kind: z.ZodLiteral<"server">;
                baseUrl: z.ZodString;
                hasKey: z.ZodBoolean;
              },
              z.core.$strict
            >,
          ],
          "kind"
        >;
        reach: z.ZodEnum<{
          openrouter: "openrouter";
          server: "server";
          "this-computer": "this-computer";
        }>;
        model: z.ZodNullable<
          z.ZodObject<
            {
              id: z.ZodString;
              name: z.ZodString;
              maker: z.ZodNullable<z.ZodString>;
              tested: z.ZodBoolean;
              zdr: z.ZodBoolean;
              perReplyUsd: z.ZodNullable<z.ZodNumber>;
              pricey: z.ZodBoolean;
            },
            z.core.$strict
          >
        >;
        month: z.ZodObject<
          {
            spentUsd: z.ZodNumber;
            limitUsd: z.ZodNumber;
            warned: z.ZodBoolean;
            reached: z.ZodBoolean;
          },
          z.core.$strict
        >;
        reviewBeforeApplying: z.ZodBoolean;
        allowRetainingModels: z.ZodBoolean;
      },
      z.core.$strict
    >;
  };
  readonly assistantUpdate: {
    readonly channel: "assistant:update";
    readonly request: z.ZodTuple<
      [
        z.ZodObject<
          {
            provider: z.ZodOptional<
              z.ZodDiscriminatedUnion<
                [
                  z.ZodObject<
                    {
                      kind: z.ZodLiteral<"openrouter">;
                    },
                    z.core.$strict
                  >,
                  z.ZodObject<
                    {
                      kind: z.ZodEnum<{
                        lmstudio: "lmstudio";
                        ollama: "ollama";
                      }>;
                      baseUrl: z.ZodOptional<z.ZodString>;
                    },
                    z.core.$strict
                  >,
                  z.ZodObject<
                    {
                      kind: z.ZodLiteral<"server">;
                      baseUrl: z.ZodString;
                    },
                    z.core.$strict
                  >,
                ],
                "kind"
              >
            >;
            modelId: z.ZodOptional<z.ZodString>;
            monthlyLimitUsd: z.ZodOptional<z.ZodNumber>;
            reviewBeforeApplying: z.ZodOptional<z.ZodBoolean>;
            allowRetainingModels: z.ZodOptional<z.ZodBoolean>;
          },
          z.core.$strict
        >,
      ],
      null
    >;
    readonly response: z.ZodObject<
      {
        enabled: z.ZodBoolean;
        consentVersion: z.ZodNullable<z.ZodInt>;
        consentReach: z.ZodNullable<
          z.ZodObject<
            {
              reach: z.ZodEnum<{
                openrouter: "openrouter";
                server: "server";
                "this-computer": "this-computer";
              }>;
              host: z.ZodOptional<z.ZodString>;
            },
            z.core.$strict
          >
        >;
        provider: z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                kind: z.ZodLiteral<"openrouter">;
                signedIn: z.ZodBoolean;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                kind: z.ZodEnum<{
                  lmstudio: "lmstudio";
                  ollama: "ollama";
                }>;
                baseUrl: z.ZodString;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                kind: z.ZodLiteral<"server">;
                baseUrl: z.ZodString;
                hasKey: z.ZodBoolean;
              },
              z.core.$strict
            >,
          ],
          "kind"
        >;
        reach: z.ZodEnum<{
          openrouter: "openrouter";
          server: "server";
          "this-computer": "this-computer";
        }>;
        model: z.ZodNullable<
          z.ZodObject<
            {
              id: z.ZodString;
              name: z.ZodString;
              maker: z.ZodNullable<z.ZodString>;
              tested: z.ZodBoolean;
              zdr: z.ZodBoolean;
              perReplyUsd: z.ZodNullable<z.ZodNumber>;
              pricey: z.ZodBoolean;
            },
            z.core.$strict
          >
        >;
        month: z.ZodObject<
          {
            spentUsd: z.ZodNumber;
            limitUsd: z.ZodNumber;
            warned: z.ZodBoolean;
            reached: z.ZodBoolean;
          },
          z.core.$strict
        >;
        reviewBeforeApplying: z.ZodBoolean;
        allowRetainingModels: z.ZodBoolean;
      },
      z.core.$strict
    >;
  };
  /** OpenRouter sign-in (§3): `browser`, its callback; `code`, a code OpenRouter shows to paste. */
  readonly assistantSignIn: {
    readonly channel: "assistant:sign-in";
    readonly request: z.ZodTuple<
      [
        z.ZodEnum<{
          browser: "browser";
          code: "code";
        }>,
      ],
      null
    >;
    readonly response: z.ZodObject<
      {
        status: z.ZodEnum<{
          cancelled: "cancelled";
          failed: "failed";
          "insecure-server": "insecure-server";
          "keychain-unavailable": "keychain-unavailable";
          offline: "offline";
          refused: "refused";
          "signed-in": "signed-in";
          "timed-out": "timed-out";
        }>;
      },
      z.core.$strict
    >;
  };
  /** The code the person pasted, after a `code` sign-in. */
  readonly assistantFinishSignIn: {
    readonly channel: "assistant:finish-sign-in";
    readonly request: z.ZodTuple<[z.ZodString], null>;
    readonly response: z.ZodObject<
      {
        status: z.ZodEnum<{
          cancelled: "cancelled";
          failed: "failed";
          "insecure-server": "insecure-server";
          "keychain-unavailable": "keychain-unavailable";
          offline: "offline";
          refused: "refused";
          "signed-in": "signed-in";
          "timed-out": "timed-out";
        }>;
      },
      z.core.$strict
    >;
  };
  readonly assistantCancelSignIn: {
    readonly channel: "assistant:cancel-sign-in";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodNull;
  };
  /** A key pasted in Advanced, for the provider chosen: checked with one request first. */
  readonly assistantSetKey: {
    readonly channel: "assistant:set-key";
    readonly request: z.ZodTuple<[z.ZodString], null>;
    readonly response: z.ZodObject<
      {
        status: z.ZodEnum<{
          cancelled: "cancelled";
          failed: "failed";
          "insecure-server": "insecure-server";
          "keychain-unavailable": "keychain-unavailable";
          offline: "offline";
          refused: "refused";
          "signed-in": "signed-in";
          "timed-out": "timed-out";
        }>;
      },
      z.core.$strict
    >;
  };
  readonly assistantModels: {
    readonly channel: "assistant:models";
    readonly request: z.ZodTuple<[], null>;
    readonly response: z.ZodUnion<
      readonly [
        z.ZodObject<
          {
            status: z.ZodLiteral<"ok">;
            models: z.ZodArray<
              z.ZodObject<
                {
                  id: z.ZodString;
                  name: z.ZodString;
                  maker: z.ZodNullable<z.ZodString>;
                  tested: z.ZodBoolean;
                  zdr: z.ZodBoolean;
                  perReplyUsd: z.ZodNullable<z.ZodNumber>;
                  pricey: z.ZodBoolean;
                },
                z.core.$strict
              >
            >;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodEnum<{
              busy: "busy";
              "consent-needed": "consent-needed";
              failed: "failed";
              "insecure-server": "insecure-server";
              "limit-reached": "limit-reached";
              "model-unavailable": "model-unavailable";
              "no-credit": "no-credit";
              "no-model": "no-model";
              "no-site": "no-site";
              "not-signed-in": "not-signed-in";
              offline: "offline";
              "provider-error": "provider-error";
              "rate-limited": "rate-limited";
              unauthorized: "unauthorized";
            }>;
          },
          z.core.$strict
        >,
      ]
    >;
  };
  /** This site's consent (§4); `asked` is false until the person has answered. */
  readonly assistantSiteConsent: {
    readonly channel: "assistant:site-consent";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodObject<
      {
        asked: z.ZodBoolean;
        allowed: z.ZodBoolean;
      },
      z.core.$strict
    >;
  };
  readonly assistantSetSiteConsent: {
    readonly channel: "assistant:set-site-consent";
    readonly request: z.ZodTuple<[z.ZodUUID, z.ZodBoolean], null>;
    readonly response: z.ZodNull;
  };
  /** Sends a message in the site's conversation; the reply comes as events with its `replyId`. */
  readonly assistantSend: {
    readonly channel: "assistant:send";
    readonly request: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodString,
        z.ZodObject<
          {
            pageId: z.ZodOptional<z.ZodString>;
            nodeId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strict
        >,
      ],
      null
    >;
    readonly response: z.ZodUnion<
      readonly [
        z.ZodObject<
          {
            status: z.ZodLiteral<"sending">;
            replyId: z.ZodUUID;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodEnum<{
              busy: "busy";
              "consent-needed": "consent-needed";
              failed: "failed";
              "insecure-server": "insecure-server";
              "limit-reached": "limit-reached";
              "model-unavailable": "model-unavailable";
              "no-credit": "no-credit";
              "no-model": "no-model";
              "no-site": "no-site";
              "not-signed-in": "not-signed-in";
              offline: "offline";
              "provider-error": "provider-error";
              "rate-limited": "rate-limited";
              unauthorized: "unauthorized";
            }>;
          },
          z.core.$strict
        >,
      ]
    >;
  };
  /**
   * A one-off draft of the site's text (#873), outside the conversation and with no tools: main
   * makes one model call and answers with the text. It changes nothing in the site.
   */
  readonly assistantDraft: {
    readonly channel: "assistant:draft";
    readonly request: z.ZodTuple<
      [
        z.ZodUUID,
        z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                kind: z.ZodLiteral<"rewrite">;
                how: z.ZodEnum<{
                  friendlier: "friendlier";
                  grammar: "grammar";
                  shorter: "shorter";
                }>;
                text: z.ZodString;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                kind: z.ZodLiteral<"description">;
                language: z.ZodString;
                site: z.ZodString;
                page: z.ZodObject<
                  {
                    title: z.ZodString;
                    text: z.ZodString;
                  },
                  z.core.$strict
                >;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                kind: z.ZodLiteral<"alt">;
                language: z.ZodString;
                fileName: z.ZodString;
                page: z.ZodString;
                nearby: z.ZodString;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                kind: z.ZodLiteral<"business">;
                language: z.ZodString;
                business: z.ZodObject<
                  {
                    name: z.ZodString;
                    type: z.ZodString;
                    about: z.ZodString;
                  },
                  z.core.$strict
                >;
                texts: z.ZodArray<
                  z.ZodObject<
                    {
                      role: z.ZodString;
                      sample: z.ZodString;
                    },
                    z.core.$strict
                  >
                >;
              },
              z.core.$strict
            >,
          ],
          "kind"
        >,
      ],
      null
    >;
    readonly response: z.ZodUnion<
      readonly [
        z.ZodObject<
          {
            status: z.ZodLiteral<"ok">;
            texts: z.ZodArray<z.ZodString>;
            examples: z.ZodOptional<z.ZodArray<z.ZodBoolean>>;
            costUsd: z.ZodNullable<z.ZodNumber>;
          },
          z.core.$strict
        >,
        z.ZodObject<
          {
            status: z.ZodEnum<{
              busy: "busy";
              "consent-needed": "consent-needed";
              failed: "failed";
              "insecure-server": "insecure-server";
              "limit-reached": "limit-reached";
              "model-unavailable": "model-unavailable";
              "no-credit": "no-credit";
              "no-model": "no-model";
              "no-site": "no-site";
              "not-signed-in": "not-signed-in";
              offline: "offline";
              "provider-error": "provider-error";
              "rate-limited": "rate-limited";
              unauthorized: "unauthorized";
            }>;
          },
          z.core.$strict
        >,
      ]
    >;
  };
  /** Stops the reply: no further model or tool call. Changes made stay, and stay undoable. */
  readonly assistantStop: {
    readonly channel: "assistant:stop";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodNull;
  };
  /** Forgets the site's conversation (*New conversation*). */
  readonly assistantNewConversation: {
    readonly channel: "assistant:new-conversation";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodNull;
  };
  /**
   * Opens a link from a reply in the person's browser, once they've clicked it: its address as the
   * reply wrote it (the Markdown token's `href`). Main opens only a web address that reply holds,
   * in its own copy of the conversation.
   */
  readonly assistantOpenLink: {
    readonly channel: "assistant:open-link";
    readonly request: z.ZodTuple<[z.ZodUUID, z.ZodUUID, z.ZodString], null>;
    readonly response: z.ZodObject<
      {
        status: z.ZodEnum<{
          failed: "failed";
          opened: "opened";
          refused: "refused";
        }>;
      },
      z.core.$strict
    >;
  };
  /**
   * Applies a reply's held changes (6.9e): each as the undo step it would have been, asking the
   * person where it would. The outcome comes as a `held` event too.
   */
  readonly assistantApplyHeld: {
    readonly channel: "assistant:apply-held";
    readonly request: z.ZodTuple<[z.ZodUUID, z.ZodUUID], null>;
    readonly response: z.ZodObject<
      {
        status: z.ZodEnum<{
          applied: "applied";
          busy: "busy";
          "no-site": "no-site";
          "nothing-held": "nothing-held";
        }>;
      },
      z.core.$strict
    >;
  };
  /** Discards a reply's held changes (6.9e): the site stays as it is. */
  readonly assistantDiscardHeld: {
    readonly channel: "assistant:discard-held";
    readonly request: z.ZodTuple<[z.ZodUUID, z.ZodUUID], null>;
    readonly response: z.ZodNull;
  };
  /** The site's conversation so far, for a panel opened again. */
  readonly assistantConversation: {
    readonly channel: "assistant:conversation";
    readonly request: z.ZodTuple<[z.ZodUUID], null>;
    readonly response: z.ZodArray<
      z.ZodObject<
        {
          replyId: z.ZodUUID;
          message: z.ZodString;
          reply: z.ZodString;
          state: z.ZodEnum<{
            done: "done";
            failed: "failed";
            replying: "replying";
          }>;
          stop: z.ZodOptional<
            z.ZodEnum<{
              end: "end";
              "limit-reached": "limit-reached";
              "max-tokens": "max-tokens";
              "model-call-cap": "model-call-cap";
              stopped: "stopped";
              "tool-cap": "tool-cap";
            }>
          >;
          error: z.ZodOptional<
            z.ZodEnum<{
              busy: "busy";
              "consent-needed": "consent-needed";
              failed: "failed";
              "insecure-server": "insecure-server";
              "limit-reached": "limit-reached";
              "model-unavailable": "model-unavailable";
              "no-credit": "no-credit";
              "no-model": "no-model";
              "no-site": "no-site";
              "not-signed-in": "not-signed-in";
              offline: "offline";
              "provider-error": "provider-error";
              "rate-limited": "rate-limited";
              unauthorized: "unauthorized";
            }>
          >;
          costUsd: z.ZodNullable<z.ZodNumber>;
          steps: z.ZodArray<
            z.ZodObject<
              {
                entryId: z.ZodString;
                label: z.ZodString;
                target: z.ZodOptional<
                  z.ZodObject<
                    {
                      pageId: z.ZodString;
                      nodeId: z.ZodOptional<z.ZodString>;
                    },
                    z.core.$strict
                  >
                >;
              },
              z.core.$strict
            >
          >;
          links: z.ZodArray<
            z.ZodObject<
              {
                host: z.ZodString;
                href: z.ZodString;
              },
              z.core.$strict
            >
          >;
          safetyVersion: z.ZodOptional<
            z.ZodObject<
              {
                versionId: z.ZodString;
                label: z.ZodString;
              },
              z.core.$strict
            >
          >;
          held: z.ZodOptional<
            z.ZodArray<
              z.ZodObject<
                {
                  label: z.ZodString;
                  target: z.ZodOptional<
                    z.ZodObject<
                      {
                        pageId: z.ZodString;
                        nodeId: z.ZodOptional<z.ZodString>;
                      },
                      z.core.$strict
                    >
                  >;
                },
                z.core.$strict
              >
            >
          >;
        },
        z.core.$strict
      >
    >;
  };
};
/** Messages the main process sends the editor window. Its preload checks each one's arguments. */
export declare const assistantEvents: {
  readonly event: {
    readonly channel: "assistant:event";
    readonly args: z.ZodTuple<
      [
        z.ZodDiscriminatedUnion<
          [
            z.ZodObject<
              {
                session: z.ZodUUID;
                type: z.ZodLiteral<"reply-started">;
                replyId: z.ZodUUID;
                model: z.ZodString;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                session: z.ZodUUID;
                type: z.ZodLiteral<"text">;
                replyId: z.ZodUUID;
                delta: z.ZodString;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                session: z.ZodUUID;
                type: z.ZodLiteral<"tool">;
                replyId: z.ZodUUID;
                callId: z.ZodString;
                tool: z.ZodString;
                state: z.ZodEnum<{
                  busy: "busy";
                  declined: "declined";
                  done: "done";
                  failed: "failed";
                  invalid: "invalid";
                  refused: "refused";
                  running: "running";
                }>;
                step: z.ZodOptional<
                  z.ZodObject<
                    {
                      entryId: z.ZodString;
                      label: z.ZodString;
                      target: z.ZodOptional<
                        z.ZodObject<
                          {
                            pageId: z.ZodString;
                            nodeId: z.ZodOptional<z.ZodString>;
                          },
                          z.core.$strict
                        >
                      >;
                    },
                    z.core.$strict
                  >
                >;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                session: z.ZodUUID;
                type: z.ZodLiteral<"safety-version">;
                replyId: z.ZodUUID;
                versionId: z.ZodString;
                label: z.ZodString;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                session: z.ZodUUID;
                type: z.ZodLiteral<"reply-done">;
                replyId: z.ZodUUID;
                stop: z.ZodEnum<{
                  end: "end";
                  "limit-reached": "limit-reached";
                  "max-tokens": "max-tokens";
                  "model-call-cap": "model-call-cap";
                  stopped: "stopped";
                  "tool-cap": "tool-cap";
                }>;
                costUsd: z.ZodNullable<z.ZodNumber>;
                month: z.ZodObject<
                  {
                    spentUsd: z.ZodNumber;
                    limitUsd: z.ZodNumber;
                  },
                  z.core.$strict
                >;
                steps: z.ZodArray<
                  z.ZodObject<
                    {
                      entryId: z.ZodString;
                      label: z.ZodString;
                      target: z.ZodOptional<
                        z.ZodObject<
                          {
                            pageId: z.ZodString;
                            nodeId: z.ZodOptional<z.ZodString>;
                          },
                          z.core.$strict
                        >
                      >;
                    },
                    z.core.$strict
                  >
                >;
                links: z.ZodArray<
                  z.ZodObject<
                    {
                      host: z.ZodString;
                      href: z.ZodString;
                    },
                    z.core.$strict
                  >
                >;
                held: z.ZodOptional<
                  z.ZodArray<
                    z.ZodObject<
                      {
                        label: z.ZodString;
                        target: z.ZodOptional<
                          z.ZodObject<
                            {
                              pageId: z.ZodString;
                              nodeId: z.ZodOptional<z.ZodString>;
                            },
                            z.core.$strict
                          >
                        >;
                      },
                      z.core.$strict
                    >
                  >
                >;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                session: z.ZodUUID;
                type: z.ZodLiteral<"held">;
                replyId: z.ZodUUID;
                state: z.ZodEnum<{
                  applied: "applied";
                  discarded: "discarded";
                }>;
                steps: z.ZodArray<
                  z.ZodObject<
                    {
                      entryId: z.ZodString;
                      label: z.ZodString;
                      target: z.ZodOptional<
                        z.ZodObject<
                          {
                            pageId: z.ZodString;
                            nodeId: z.ZodOptional<z.ZodString>;
                          },
                          z.core.$strict
                        >
                      >;
                    },
                    z.core.$strict
                  >
                >;
                refused: z.ZodArray<
                  z.ZodObject<
                    {
                      label: z.ZodString;
                      target: z.ZodOptional<
                        z.ZodObject<
                          {
                            pageId: z.ZodString;
                            nodeId: z.ZodOptional<z.ZodString>;
                          },
                          z.core.$strict
                        >
                      >;
                    },
                    z.core.$strict
                  >
                >;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                session: z.ZodUUID;
                type: z.ZodLiteral<"reply-failed">;
                replyId: z.ZodUUID;
                error: z.ZodEnum<{
                  busy: "busy";
                  "consent-needed": "consent-needed";
                  failed: "failed";
                  "insecure-server": "insecure-server";
                  "limit-reached": "limit-reached";
                  "model-unavailable": "model-unavailable";
                  "no-credit": "no-credit";
                  "no-model": "no-model";
                  "no-site": "no-site";
                  "not-signed-in": "not-signed-in";
                  offline: "offline";
                  "provider-error": "provider-error";
                  "rate-limited": "rate-limited";
                  unauthorized: "unauthorized";
                }>;
                steps: z.ZodArray<
                  z.ZodObject<
                    {
                      entryId: z.ZodString;
                      label: z.ZodString;
                      target: z.ZodOptional<
                        z.ZodObject<
                          {
                            pageId: z.ZodString;
                            nodeId: z.ZodOptional<z.ZodString>;
                          },
                          z.core.$strict
                        >
                      >;
                    },
                    z.core.$strict
                  >
                >;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                type: z.ZodLiteral<"limit">;
                level: z.ZodEnum<{
                  reached: "reached";
                  warning: "warning";
                }>;
                month: z.ZodObject<
                  {
                    spentUsd: z.ZodNumber;
                    limitUsd: z.ZodNumber;
                  },
                  z.core.$strict
                >;
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                type: z.ZodLiteral<"status">;
                status: z.ZodObject<
                  {
                    enabled: z.ZodBoolean;
                    consentVersion: z.ZodNullable<z.ZodInt>;
                    consentReach: z.ZodNullable<
                      z.ZodObject<
                        {
                          reach: z.ZodEnum<{
                            openrouter: "openrouter";
                            server: "server";
                            "this-computer": "this-computer";
                          }>;
                          host: z.ZodOptional<z.ZodString>;
                        },
                        z.core.$strict
                      >
                    >;
                    provider: z.ZodDiscriminatedUnion<
                      [
                        z.ZodObject<
                          {
                            kind: z.ZodLiteral<"openrouter">;
                            signedIn: z.ZodBoolean;
                          },
                          z.core.$strict
                        >,
                        z.ZodObject<
                          {
                            kind: z.ZodEnum<{
                              lmstudio: "lmstudio";
                              ollama: "ollama";
                            }>;
                            baseUrl: z.ZodString;
                          },
                          z.core.$strict
                        >,
                        z.ZodObject<
                          {
                            kind: z.ZodLiteral<"server">;
                            baseUrl: z.ZodString;
                            hasKey: z.ZodBoolean;
                          },
                          z.core.$strict
                        >,
                      ],
                      "kind"
                    >;
                    reach: z.ZodEnum<{
                      openrouter: "openrouter";
                      server: "server";
                      "this-computer": "this-computer";
                    }>;
                    model: z.ZodNullable<
                      z.ZodObject<
                        {
                          id: z.ZodString;
                          name: z.ZodString;
                          maker: z.ZodNullable<z.ZodString>;
                          tested: z.ZodBoolean;
                          zdr: z.ZodBoolean;
                          perReplyUsd: z.ZodNullable<z.ZodNumber>;
                          pricey: z.ZodBoolean;
                        },
                        z.core.$strict
                      >
                    >;
                    month: z.ZodObject<
                      {
                        spentUsd: z.ZodNumber;
                        limitUsd: z.ZodNumber;
                        warned: z.ZodBoolean;
                        reached: z.ZodBoolean;
                      },
                      z.core.$strict
                    >;
                    reviewBeforeApplying: z.ZodBoolean;
                    allowRetainingModels: z.ZodBoolean;
                  },
                  z.core.$strict
                >;
              },
              z.core.$strict
            >,
          ],
          "type"
        >,
      ],
      null
    >;
  };
};
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
  siteConsent(session: string): Promise<{
    asked: boolean;
    allowed: boolean;
  }>;
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
  ): Promise<{
    status: "applied" | "nothing-held" | "busy" | "no-site";
  }>;
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
  ): Promise<{
    status: "opened" | "refused" | "failed";
  }>;
  /** Calls `listener` with each event main pushes. Returns a stop function. */
  onEvent(listener: (event: AssistantEvent) => void): () => void;
}
//# sourceMappingURL=assistant.d.ts.map
