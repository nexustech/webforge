import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { t } from "@webforge/i18n";
import { z } from "zod";
import { linkToOpen } from "../../shared/assistant-links.js";
import {
  ASSISTANT_CONSENT_VERSION,
  type AssistantApi,
  type AssistantErrorCode,
  type AssistantEvent,
  type AssistantModel,
  type AssistantStatus,
  type ConversationTurn,
  MONTHLY_LIMIT_DEFAULT_USD,
} from "../../shared/ipc/assistant.js";
import type { AssistantService } from "../assistant-ipc.js";
import type { CredentialStore } from "../credential-store.js";
import { createJsonStore, type JsonStoreFiles } from "../json-store.js";
import { logFailure } from "../log.js";
import type { HeldCall, ReplyOutcome, Selection, ToolClient } from "./assistant-loop.js";
import { isLoopback, keySafeAt, streamChat } from "./chat-client.js";
import {
  type EndpointResult,
  endpointFor,
  OPENROUTER_BASE_URL,
  OPENROUTER_KEY,
  SERVER_KEY,
} from "./endpoint.js";
import { openRouterModels, preselected, serverModels } from "./models.js";
import type { OpenRouterSignIn } from "./openrouter-sign-in.js";

/**
 * The assistant in main (6.9a, ADR 0026): its settings, consent, keys, sign-in, the month's spend
 * and the model list, behind the `assistant` domain's calls, and the one-off drafts of 6.9d's
 * writing help (#873). `send` runs 6.9b's loop (`assistant-loop.ts`) for a message that passes
 * every check, keeping the conversation in memory.
 *
 * Kept in `assistant.json` in the app's user data, with no content: the provider and model, the
 * limit, the month's spend, the app's consent version and each site's yes by its project id
 * (never in the site file). Keys only in the credential store.
 */

/** How long a draft waits for the model before giving up: a local model on a slow computer. */
const DRAFT_TIMEOUT_MS = 120_000;

/** A local server's address when Settings gives none (ADR 0026 §2). */
const LOCAL_DEFAULTS = {
  ollama: "http://localhost:11434/v1",
  lmstudio: "http://localhost:1234/v1",
} as const;

const modelSchema = z.strictObject({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  maker: z.string().min(1).max(100).nullable(),
  tested: z.boolean(),
  zdr: z.boolean(),
  perReplyUsd: z.number().nonnegative().nullable(),
  pricey: z.boolean(),
});

const fileSchema = z.strictObject({
  version: z.literal(1),
  /** The app consent's wording the person agreed to; null before, or after *Turn off*. */
  consentVersion: z.int().positive().nullable(),
  /** Where it was given for: the wording names who receives what (§4). */
  consentReach: z
    .strictObject({
      reach: z.enum(["this-computer", "openrouter", "server"]),
      host: z.string().min(1).max(300).optional(),
    })
    .nullable(),
  provider: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("openrouter") }),
    z.strictObject({
      kind: z.enum(["ollama", "lmstudio", "server"]),
      baseUrl: z.string().max(2000),
    }),
  ]),
  model: modelSchema.nullable(),
  limitUsd: z.number().min(1).max(1000),
  allowRetainingModels: z.boolean(),
  /** AIA-5's _Review before applying_ (6.9e): a reply's changes are held until applied. */
  reviewBeforeApplying: z.boolean().default(false),
  /** The spend of `month` (`2026-11`, in this computer's time zone), and whether 80% was said. */
  month: z.strictObject({
    key: z.string().regex(/^\d{4}-\d{2}$/),
    spentUsd: z.number().nonnegative(),
    warned: z.boolean(),
  }),
  /** Each site's yes or no, by its project id. */
  sites: z.record(z.uuid(), z.boolean()),
});

type AssistantFile = z.infer<typeof fileSchema>;

type SignInResult = Awaited<ReturnType<AssistantApi["signIn"]>>;

type ConsentReach = NonNullable<AssistantFile["consentReach"]>;

/** Where requests go now: this computer, OpenRouter, or a named server by its host. */
const reachOf = (file: AssistantFile): ConsentReach => {
  if (file.provider.kind === "openrouter") return { reach: "openrouter" };
  if (isLoopback(file.provider.baseUrl)) return { reach: "this-computer" };
  let host = file.provider.baseUrl;
  try {
    host = new URL(file.provider.baseUrl).host;
  } catch {
    // An address that won't parse is its own host, so no other matches it.
  }
  return { reach: "server", host };
};

/**
 * Whether consent given for `given` covers requests going to `now` (§4): the same reach, and for
 * a named server the same host. Nothing leaves this computer for a local model, so any consent
 * covers that; a consent for a local model covers nothing that leaves it.
 */
const covers = (given: ConsentReach | null, now: ConsentReach) =>
  given !== null &&
  (now.reach === "this-computer" ||
    (given.reach === now.reach && (now.reach !== "server" || given.host === now.host)));

/** A calendar month's key in this computer's time zone: `2026-11`. */
const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export type AssistantServiceOptions = {
  readonly dir: string;
  readonly credentials: CredentialStore;
  readonly signIn: OpenRouterSignIn;
  /** Electron's `net.fetch`, for the system's proxy. */
  readonly fetchFn: typeof fetch;
  /** The app's name, for OpenRouter's title header: it carries no content. */
  readonly appName: string;
  /** The open site's project id for a session, or undefined if it isn't the open one. */
  readonly projectOf: (session: string) => string | undefined;
  /** Sends an event to the editor window. */
  readonly emit: (event: AssistantEvent) => void;
  /** Opens a web address in the person's browser (`shell.openExternal`). */
  readonly openExternal: (url: string) => Promise<void>;
  /**
   * Connects to 4.9's tool layer for a reply (6.9b): the MCP service's in-memory client, with
   * `beforeCommand` run ahead of each of its commands.
   */
  readonly connectTools: (
    beforeCommand: () => Promise<void>,
    /** The reply whose changes are held (6.9e): its requests go to its draft in the window. */
    stage?: string,
  ) => Promise<{ readonly client: ToolClient; close(): Promise<void> }>;
  /**
   * Saves a version of `session`'s site named `name` before the assistant's first change (S20):
   * `saved` with its id; `held` when one from the last few minutes holds the site from before
   * already; `failed` when none could be saved.
   */
  readonly saveVersionBefore: (session: string, name: string) => Promise<SafetySave>;
  /**
   * Closes any question the window is asking for the assistant's commands (D7), declined: Stop
   * doesn't wait for the person's answer (6.9b).
   */
  readonly cancelQuestions: () => void;
  readonly now?: () => Date;
  readonly files?: JsonStoreFiles;
};

/** What came of saving the safety version: see {@link AssistantServiceOptions.saveVersionBefore}. */
type SafetySave =
  | { readonly status: "saved"; readonly versionId: string }
  | { readonly status: "held" }
  | { readonly status: "failed" };

/** What {@link Assistant.preflight} found: the site's project id, or why nothing may be sent. */
type Preflight =
  | { readonly status: "ok"; readonly project: string }
  | { readonly status: AssistantErrorCode };

/**
 * The service and what 6.9b's loop uses beside it: the checks before sending, the endpoint, and
 * adding a reply's cost.
 */
export type Assistant = AssistantService & {
  /** Each site's conversation, by its project id, in memory only: 6.9b's loop adds the turns. */
  readonly conversations: Map<string, ConversationTurn[]>;
  /**
   * Whether anything of `session`'s site may be sent now: it's the open site, the app's and the
   * site's yes are given (§4), the person is signed in, a model is chosen, and the month's limit
   * isn't reached (§5). `send` and `draft` both ask it first.
   */
  preflight(session: string): Promise<Preflight>;
  /** Where model calls go now, with the key and the model (§2). */
  endpoint(): Promise<EndpointResult>;
  /** Adds a reply's cost to the month's (§5), saying so at 80% and at the limit. */
  addCost(usd: number): Promise<AssistantStatus["month"]>;
};

/** The assistant's service in main (see the top of this file). */
export function createAssistantService(options: AssistantServiceOptions): Assistant {
  const now = options.now ?? (() => new Date());
  const empty = (): AssistantFile => ({
    version: 1,
    consentVersion: null,
    consentReach: null,
    provider: { kind: "openrouter" },
    model: null,
    limitUsd: MONTHLY_LIMIT_DEFAULT_USD,
    allowRetainingModels: false,
    reviewBeforeApplying: false,
    month: { key: monthKey(now()), spentUsd: 0, warned: false },
    sites: {},
  });
  const store = createJsonStore(join(options.dir, "assistant.json"), fileSchema, {
    empty: empty(),
    onDamaged: "reset",
    ...(options.files === undefined ? {} : { files: options.files }),
  });
  /** The file, with last month's spend let go. */
  const read = async (): Promise<AssistantFile> => {
    const file = await store.read();
    const key = monthKey(now());
    return file.month.key === key ? file : { ...file, month: { key, spentUsd: 0, warned: false } };
  };
  const write = async (change: (file: AssistantFile) => AssistantFile) => {
    await store.update((file) => {
      const key = monthKey(now());
      const current =
        file.month.key === key ? file : { ...file, month: { key, spentUsd: 0, warned: false } };
      return change(current);
    });
  };
  /** Each site's conversation, by project id: in memory only, never written anywhere (§6). */
  const conversations = new Map<string, ConversationTurn[]>();
  /** The models last listed, for `update({ modelId })` to keep the chosen one's details. */
  let listed: readonly AssistantModel[] = [];
  /** Whether the models last listed say `id` keeps no requests: unknown counts as no. */
  const isZdr = (id: string): boolean => listed.find((each) => each.id === id)?.zdr === true;
  /** The sign-in under way, whose answer keeps the key: a pasted code's ends it. */
  let signingIn: Promise<SignInResult> | null = null;
  /** The sites with a draft under way, by project id. */
  const drafting = new Set<string>();
  /**
   * Each site's held changes (6.9e), by project id: the reply that made them, the opening of the
   * site it was made in, and its calls as asked, to ask again when applied. Only the last reply's:
   * its stage in the window replaces the one before. Never another opening's: the window's stage
   * went with it, so a site switch discards them.
   */
  const held = new Map<
    string,
    { readonly replyId: string; readonly session: string; readonly calls: readonly HeldCall[] }
  >();

  /** `session`'s site's held changes of reply `replyId`, if it's still open as it was then. */
  const holdingOf = (session: string, replyId: string) => {
    const project = dropStale(session);
    if (project === undefined) return undefined;
    const holding = held.get(project);
    if (holding === undefined || holding.replyId !== replyId) return undefined;
    return { project, holding };
  };

  /**
   * Drops `session`'s site's held changes if another opening of it made them: their stage went
   * with that window's. Its card is told, so it never offers an Apply that finds nothing
   * (#1063's review). The site's project id, or undefined if `session` isn't the open site.
   */
  const dropStale = (session: string) => {
    const project = options.projectOf(session);
    if (project === undefined) return undefined;
    const holding = held.get(project);
    if (holding !== undefined && holding.session !== session) {
      held.delete(project);
      settled(project, holding.replyId);
      options.emit({
        session,
        type: "held",
        replyId: holding.replyId,
        state: "discarded",
        steps: [],
        refused: [],
      });
    }
    return project;
  };
  /** The sites whose held changes are being applied. */
  const applying = new Set<string>();
  /** The replies under way, by their id: Stop aborts one. A site has one at a time. */
  const replies = new Map<string, { readonly project: string; readonly stop: AbortController }>();
  /**
   * Each conversation's safety version (S20), by project id, saved before its first change. One
   * that failed is forgotten, so the next change tries again.
   */
  const safety = new Map<string, Promise<SafetySave>>();

  const status = async (): Promise<AssistantStatus> => {
    const file = await read();
    const key =
      file.provider.kind === "openrouter"
        ? await options.credentials.get(OPENROUTER_KEY)
        : file.provider.kind === "server"
          ? await options.credentials.get(SERVER_KEY)
          : null;
    const provider: AssistantStatus["provider"] =
      file.provider.kind === "openrouter"
        ? { kind: "openrouter", signedIn: key !== null }
        : file.provider.kind === "server"
          ? { kind: "server", baseUrl: file.provider.baseUrl, hasKey: key !== null }
          : { kind: file.provider.kind, baseUrl: file.provider.baseUrl };
    const now = reachOf(file);
    const reach = now.reach;
    return {
      enabled: file.consentVersion === ASSISTANT_CONSENT_VERSION && covers(file.consentReach, now),
      consentVersion: file.consentVersion,
      consentReach: file.consentReach,
      provider,
      reach,
      model: file.model,
      month: {
        spentUsd: file.month.spentUsd,
        limitUsd: file.limitUsd,
        warned: file.month.warned,
        reached: file.month.spentUsd >= file.limitUsd,
      },
      reviewBeforeApplying: file.reviewBeforeApplying,
      allowRetainingModels: file.allowRetainingModels,
    };
  };

  /** The status, told to the window too: Settings and the panel follow it. */
  const changed = async () => {
    const next = await status();
    options.emit({ type: "status", status: next });
    return next;
  };

  /** A key, checked with one request before it's kept: OpenRouter's `/key`, a server's `/models`. */
  const checkKey = async (url: string, key: string) => {
    try {
      const response = await options.fetchFn(url, { headers: { authorization: `Bearer ${key}` } });
      await response.body?.cancel().catch(() => undefined);
      if (response.ok) return "ok";
      return response.status === 401 || response.status === 403 ? "refused" : "failed";
    } catch {
      return "offline";
    }
  };

  /** Keeps `key` under `name`: `keychain-unavailable` where the store won't encrypt it. */
  const keep = async (name: string, key: string) => {
    try {
      await options.credentials.set(name, key);
      return true;
    } catch (error) {
      logFailure("assistant key", error);
      return false;
    }
  };

  /**
   * The conversation's safety version, saved before its first change (S20, ADR 0026 §1): the
   * reply that saved it says so, and keeps it for a panel opened again.
   */
  const safetyFirst = async (session: string, project: string, turn: ConversationTurn) => {
    const pending = safety.get(project);
    if (pending !== undefined) {
      await pending;
      return;
    }
    const label = t("assistant.version.before");
    const saving = options
      .saveVersionBefore(session, label)
      .catch((): SafetySave => ({ status: "failed" }));
    safety.set(project, saving);
    const saved = await saving;
    if (saved.status === "failed") {
      // Not saved: the next change tries again. The command still runs, as an AI app's does.
      safety.delete(project);
      return;
    }
    // A recent version holds the site from before already: kept for the conversation, unnamed.
    if (saved.status === "held") return;
    const { versionId } = saved;
    turn.safetyVersion = { versionId, label };
    options.emit({ session, type: "safety-version", replyId: turn.replyId, versionId, label });
  };

  /** Runs `turn`'s reply, telling the window as it goes, and keeps how it ended. */
  const reply = async (run: {
    readonly session: string;
    readonly project: string;
    readonly turn: ConversationTurn;
    readonly earlier: readonly ConversationTurn[];
    readonly selection: Selection;
    readonly target: Extract<EndpointResult, { status: "ok" }>;
    readonly signal: AbortSignal;
    /** _Review before applying_ (6.9e): the reply's changes go to a draft, held. */
    readonly staged: boolean;
  }) => {
    const { session, project, turn } = run;
    const { replyId } = turn;
    /** Whether the reply's site is still the one open: another's is never its to read or change. */
    const stillOpen = () => options.projectOf(session) === project;
    // A new reply's stage replaces the last one's in the window: its held changes go, and the
    // last reply's card says so (#1059's review).
    const replaced = held.get(project);
    if (replaced !== undefined) {
      held.delete(project);
      settled(project, replaced.replyId);
      options.emit({
        session: replaced.session,
        type: "held",
        replyId: replaced.replyId,
        state: "discarded",
        steps: [],
        refused: [],
      });
    }
    let outcome: ReplyOutcome;
    try {
      // Loaded with the first reply, never at start-up (#892): the loop brings the commands
      // package, and the MCP service the SDK.
      const { runReply } = await import("./assistant-loop.js");
      const tools = await options.connectTools(
        async () => {
          // The window acts on whichever site it has open: not this reply's, no change is asked.
          if (!stillOpen()) throw new Error("The reply's site isn't open");
          // Held, nothing changes until they're applied: the version is saved then.
          if (!run.staged) await safetyFirst(session, project, turn);
        },
        run.staged ? replyId : undefined,
      );
      try {
        outcome = await runReply({
          fetchFn: options.fetchFn,
          endpoint: run.target.endpoint,
          model: run.target.model,
          tools: tools.client,
          earlier: run.earlier,
          message: turn.message,
          selection: run.selection,
          signal: run.signal,
          stillOpen,
          staged: run.staged,
          addCost: async (usd) => (await service.addCost(usd)).reached,
          onText: (delta) => {
            turn.reply += delta;
            options.emit({ session, type: "text", replyId, delta });
          },
          onTool: (call) => options.emit({ session, type: "tool", replyId, ...call }),
        });
      } finally {
        await tools.close().catch(() => undefined);
      }
    } catch (error) {
      logFailure("assistant reply", error);
      outcome = { status: "failed", error: "failed", costUsd: null, steps: [], held: [] };
    }
    turn.costUsd = outcome.costUsd;
    turn.steps = [...outcome.steps];
    // Held only while the reply's site is still the one open: a site switch discards them.
    const holds = outcome.held.length > 0 && stillOpen();
    const changes = holds ? outcome.held.map((call) => call.change) : [];
    if (holds) {
      held.set(project, { replyId, session, calls: outcome.held });
      turn.held = changes;
    }
    if (outcome.status === "failed") {
      turn.state = "failed";
      turn.error = outcome.error;
      options.emit({
        session,
        type: "reply-failed",
        replyId,
        error: outcome.error,
        steps: turn.steps,
      });
      return;
    }
    turn.state = "done";
    turn.stop = outcome.stop;
    turn.links = [...outcome.links];
    const { month } = await status();
    options.emit({
      session,
      type: "reply-done",
      replyId,
      stop: outcome.stop,
      costUsd: outcome.costUsd,
      month: { spentUsd: month.spentUsd, limitUsd: month.limitUsd },
      steps: turn.steps,
      links: turn.links,
      ...(changes.length > 0 ? { held: changes } : {}),
    });
  };

  /** Turn `replyId` of `project`'s conversation, without its held changes now they're settled. */
  const settled = (project: string, replyId: string) => {
    const turns = conversations.get(project) ?? [];
    const index = turns.findIndex((each) => each.replyId === replyId);
    const turn = turns[index];
    if (turn === undefined) return undefined;
    const { held: _settled, ...rest } = turn;
    turns[index] = rest;
    return rest;
  };

  const service: Assistant = {
    conversations,
    status,
    setEnabled: async (enabled, version) => {
      if (enabled) {
        // The consent covers where requests go now: the wording the person saw named it.
        await write((file) => ({ ...file, consentVersion: version, consentReach: reachOf(file) }));
      } else {
        // Turn off: the keys go from this computer; the sites' answers name no secret, and stay.
        options.signIn.cancel();
        await options.credentials.delete(OPENROUTER_KEY);
        await options.credentials.delete(SERVER_KEY);
        await write((file) => ({ ...file, consentVersion: null, consentReach: null }));
      }
      return changed();
    },
    update: async (settings) => {
      const model =
        settings.modelId === undefined
          ? undefined
          : (listed.find((each) => each.id === settings.modelId) ?? {
              id: settings.modelId,
              name: settings.modelId,
              maker: null,
              tested: false,
              zdr: false,
              perReplyUsd: null,
              pricey: false,
            });
      let forgetServerKey = false;
      await write((file) => {
        let next = { ...file };
        if (settings.provider !== undefined) {
          const provider =
            settings.provider.kind === "openrouter"
              ? { kind: "openrouter" as const }
              : {
                  kind: settings.provider.kind,
                  baseUrl: (
                    settings.provider.baseUrl ??
                    (settings.provider.kind === "server"
                      ? ""
                      : LOCAL_DEFAULTS[settings.provider.kind])
                  ).replace(/\/+$/, ""),
                };
          // Another provider's models aren't this one's: the choice starts again.
          if (JSON.stringify(provider) !== JSON.stringify(file.provider)) {
            next = { ...next, provider, model: null };
            // A server's key was given for that server: it never goes to another address.
            forgetServerKey = file.provider.kind === "server";
          }
        }
        if (model !== undefined) next = { ...next, model };
        if (settings.monthlyLimitUsd !== undefined)
          next = { ...next, limitUsd: settings.monthlyLimitUsd };
        if (settings.reviewBeforeApplying !== undefined) {
          next = { ...next, reviewBeforeApplying: settings.reviewBeforeApplying };
        }
        if (settings.allowRetainingModels !== undefined) {
          next = { ...next, allowRetainingModels: settings.allowRetainingModels };
        }
        // Off, no request goes to a model that may keep it (AIA-7): an OpenRouter model not listed
        // as ZDR, or not listed at all, gives way to the tested default if that's ZDR, or to none.
        if (
          settings.allowRetainingModels === false &&
          next.provider.kind === "openrouter" &&
          next.model !== null &&
          !isZdr(next.model.id)
        ) {
          const first = preselected(listed);
          next = { ...next, model: first?.zdr === true ? first : null };
        }
        return next;
      });
      if (forgetServerKey) await options.credentials.delete(SERVER_KEY);
      return changed();
    },
    signIn: (mode) => {
      const signing = (async (): Promise<SignInResult> => {
        const outcome = await options.signIn.start(mode);
        if (outcome.status !== "signed-in") return { status: outcome.status };
        if (!(await keep(OPENROUTER_KEY, outcome.key))) return { status: "keychain-unavailable" };
        await changed();
        return { status: "signed-in" };
      })();
      signingIn = signing;
      void signing.finally(() => {
        if (signingIn === signing) signingIn = null;
      });
      return signing;
    },
    finishSignIn: async (code) => {
      const signing = signingIn;
      const outcome = await options.signIn.finishWithCode(code);
      // A right code ends the sign-in under way, which keeps the key: answer once it's kept.
      if (outcome.status === "signed-in" && signing !== null) return signing;
      return { status: outcome.status === "signed-in" ? "failed" : outcome.status };
    },
    cancelSignIn: async () => {
      options.signIn.cancel();
    },
    setKey: async (key) => {
      const file = await read();
      if (file.provider.kind !== "openrouter" && file.provider.kind !== "server") {
        return { status: "failed" };
      }
      // A key for a server over plain http that isn't on this computer is never kept (#976).
      if (file.provider.kind === "server" && !keySafeAt(file.provider.baseUrl)) {
        return { status: "insecure-server" };
      }
      const [url, name] =
        file.provider.kind === "openrouter"
          ? [`${OPENROUTER_BASE_URL}/key`, OPENROUTER_KEY]
          : [`${file.provider.baseUrl}/models`, SERVER_KEY];
      const checked = await checkKey(url, key);
      if (checked !== "ok") return { status: checked };
      if (!(await keep(name, key))) return { status: "keychain-unavailable" };
      await changed();
      return { status: "signed-in" };
    },
    models: async () => {
      const file = await read();
      const key =
        file.provider.kind === "server"
          ? ((await options.credentials.get(SERVER_KEY)) ?? undefined)
          : undefined;
      // A key never travels unencrypted to another computer (#976), here as in the chat client.
      if (
        file.provider.kind !== "openrouter" &&
        key !== undefined &&
        !keySafeAt(file.provider.baseUrl)
      ) {
        return { status: "insecure-server" };
      }
      const result =
        file.provider.kind === "openrouter"
          ? await openRouterModels(options.fetchFn, file.allowRetainingModels)
          : await serverModels(options.fetchFn, file.provider.baseUrl, key);
      if (result.status !== "ok") return result;
      listed = result.models;
      // A first list preselects Webforge's tested default (§2).
      const first = preselected(result.models);
      if (file.model === null && first !== null) {
        await write((each) => (each.model === null ? { ...each, model: first } : each));
        await changed();
      }
      return result;
    },
    siteConsent: async (session) => {
      const current = await status();
      if (current.reach === "this-computer") return { asked: true, allowed: true };
      const project = options.projectOf(session);
      if (project === undefined) return { asked: false, allowed: false };
      const answer = (await read()).sites[project];
      return { asked: answer !== undefined, allowed: answer === true };
    },
    setSiteConsent: async (session, allowed) => {
      const project = options.projectOf(session);
      if (project === undefined) return;
      await write((file) => ({ ...file, sites: { ...file.sites, [project]: allowed } }));
    },
    preflight: async (session) => {
      const current = await status();
      const project = options.projectOf(session);
      if (project === undefined) return { status: "no-site" };
      if (!current.enabled) return { status: "consent-needed" };
      if (current.reach !== "this-computer" && !(await service.siteConsent(session)).allowed) {
        return { status: "consent-needed" };
      }
      if (current.provider.kind === "openrouter" && !current.provider.signedIn) {
        return { status: "not-signed-in" };
      }
      if (current.model === null) return { status: "no-model" };
      if (current.month.reached) return { status: "limit-reached" };
      return { status: "ok", project };
    },
    endpoint: async () => endpointFor(await read(), options.credentials, options.appName),
    send: async (session, text, context) => {
      const checked = await service.preflight(session);
      if (checked.status !== "ok") return { status: checked.status };
      const { project } = checked;
      // One reply at a time for a site, and none while its held changes are being applied.
      if (applying.has(project) || [...replies.values()].some((each) => each.project === project)) {
        return { status: "busy" };
      }
      // Taken before anything is awaited, so a second message can't start a second reply.
      const replyId = randomUUID();
      const stop = new AbortController();
      replies.set(replyId, { project, stop });
      const target = await service.endpoint();
      if (target.status !== "ok") {
        replies.delete(replyId);
        return { status: target.status };
      }
      const turns = conversations.get(project) ?? [];
      conversations.set(project, turns);
      const earlier = [...turns];
      const turn: ConversationTurn = {
        replyId,
        message: text,
        reply: "",
        state: "replying",
        costUsd: null,
        steps: [],
        links: [],
      };
      turns.push(turn);
      options.emit({ session, type: "reply-started", replyId, model: target.model });
      const { reviewBeforeApplying: staged } = await read();
      void reply({
        session,
        project,
        turn,
        earlier,
        selection: context,
        target,
        signal: stop.signal,
        staged,
      })
        .catch((error: unknown) => logFailure("assistant reply", error))
        .finally(() => replies.delete(replyId));
      return { status: "sending", replyId };
    },
    draft: async (session, request) => {
      const checked = await service.preflight(session);
      if (checked.status !== "ok") return { status: checked.status };
      // One draft at a time for a site: a second ask waits for the first's answer.
      if (drafting.has(checked.project)) return { status: "busy" };
      drafting.add(checked.project);
      try {
        const target = await service.endpoint();
        if (target.status !== "ok") return { status: target.status };
        // Loaded when first used, never at start-up (#892): the site text's rule comes from the
        // commands package, which brings the site components with it.
        const { draftChat, draftTexts } = await import("./drafts.js");
        const chat = draftChat(request, target.model, AbortSignal.timeout(DRAFT_TIMEOUT_MS));
        const result = await streamChat(options.fetchFn, target.endpoint, chat, () => undefined);
        // Only a timeout stops a draft: the model didn't answer in time.
        if (result.status === "aborted") return { status: "offline" };
        if (result.status === "failed") return { status: result.error };
        const { costUsd } = result.usage;
        // Counted even when the answer can't be used: the provider has billed it.
        if (costUsd !== null && costUsd > 0) await service.addCost(costUsd);
        const texts = draftTexts(request, result.text);
        return texts === undefined
          ? { status: "provider-error" }
          : { status: "ok", texts, costUsd };
      } finally {
        drafting.delete(checked.project);
      }
    },
    stop: async (replyId) => {
      const reply = replies.get(replyId);
      if (reply === undefined) return;
      reply.stop.abort();
      // A command waiting for the person's yes is declined, and the reply ends after it.
      options.cancelQuestions();
    },
    applyHeld: async (session, replyId) => {
      if (options.projectOf(session) === undefined) return { status: "no-site" };
      const found = holdingOf(session, replyId);
      if (found === undefined) return { status: "nothing-held" };
      const { project, holding } = found;
      const replying = [...replies.values()].some((each) => each.project === project);
      if (replying || applying.has(project)) return { status: "busy" };
      applying.add(project);
      try {
        const stillOpen = () => options.projectOf(session) === project;
        const turn = conversations.get(project)?.find((each) => each.replyId === replyId);
        const { applyHeld } = await import("./assistant-loop.js");
        const tools = await options.connectTools(async () => {
          if (!stillOpen()) throw new Error("The reply's site isn't open");
          if (turn !== undefined) await safetyFirst(session, project, turn);
        });
        let applied: Awaited<ReturnType<typeof applyHeld>>;
        try {
          applied = await applyHeld(tools.client, holding.calls, stillOpen);
        } finally {
          await tools.close().catch(() => undefined);
        }
        held.delete(project);
        const now = settled(project, replyId);
        if (now !== undefined) now.steps = [...now.steps, ...applied.steps];
        options.emit({ session, type: "held", replyId, state: "applied", ...applied });
        return { status: "applied" };
      } finally {
        applying.delete(project);
      }
    },
    discardHeld: async (session, replyId) => {
      const found = holdingOf(session, replyId);
      if (found === undefined) return;
      const { project } = found;
      if (applying.has(project)) return;
      held.delete(project);
      settled(project, replyId);
      options.emit({ session, type: "held", replyId, state: "discarded", steps: [], refused: [] });
    },
    newConversation: async (session) => {
      const project = options.projectOf(session);
      if (project === undefined) return;
      conversations.delete(project);
      // A new conversation's first change saves a version of its own.
      safety.delete(project);
      held.delete(project);
    },
    conversation: async (session) => {
      // A panel opened again never shows held changes it can't apply.
      const project = dropStale(session);
      return project === undefined ? [] : structuredClone(conversations.get(project) ?? []);
    },
    openLink: async (session, replyId, href) => {
      const project = options.projectOf(session);
      const turn =
        project === undefined
          ? undefined
          : conversations.get(project)?.find((each) => each.replyId === replyId);
      // Only a web address that reply holds, in main's own copy of it.
      const address = turn === undefined ? undefined : linkToOpen(turn, href);
      if (address === undefined) return { status: "refused" };
      try {
        await options.openExternal(address);
        return { status: "opened" };
      } catch {
        return { status: "failed" };
      }
    },
    addCost: async (usd) => {
      let crossed: "warning" | "reached" | undefined;
      await write((file) => {
        const spentUsd = file.month.spentUsd + usd;
        const before = file.month.spentUsd;
        if (before < file.limitUsd && spentUsd >= file.limitUsd) crossed = "reached";
        else if (!file.month.warned && spentUsd >= file.limitUsd * 0.8) crossed = "warning";
        return {
          ...file,
          month: { ...file.month, spentUsd, warned: file.month.warned || crossed !== undefined },
        };
      });
      const { month } = await status();
      const counted = { spentUsd: month.spentUsd, limitUsd: month.limitUsd };
      if (crossed !== undefined) {
        options.emit({ type: "limit", level: crossed, month: counted });
      }
      return month;
    },
  };
  return service;
}
