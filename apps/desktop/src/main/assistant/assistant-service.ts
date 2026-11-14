import { join } from "node:path";
import { z } from "zod";
import { linkToOpen } from "../../shared/assistant-links.js";
import {
  ASSISTANT_CONSENT_VERSION,
  type AssistantApi,
  type AssistantEvent,
  type AssistantModel,
  type AssistantStatus,
  type ConversationTurn,
  MONTHLY_LIMIT_DEFAULT_USD,
} from "../../shared/ipc/assistant.js";
import type { AssistantService } from "../assistant-ipc.js";
import { assistantCredentialKey, type CredentialStore } from "../credential-store.js";
import { createJsonStore, type JsonStoreFiles } from "../json-store.js";
import { logFailure } from "../log.js";
import { isLoopback, keySafeAt } from "./chat-client.js";
import { openRouterModels, preselected, serverModels } from "./models.js";
import type { OpenRouterSignIn } from "./openrouter-sign-in.js";

/**
 * The assistant in main (6.9a, ADR 0026): its settings, consent, keys, sign-in, the month's spend
 * and the model list, behind the `assistant` domain's calls. `send` and the conversation are
 * 6.9b's loop: until it lands, a message that passes every check is answered `failed`.
 *
 * Kept in `assistant.json` in the app's user data, with no content: the provider and model, the
 * limit, the month's spend, the app's consent version and each site's yes by its project id
 * (never in the site file). Keys only in the credential store.
 */

const OPENROUTER_KEY = assistantCredentialKey("openrouter");
const SERVER_KEY = assistantCredentialKey("server");

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
  /** The open site's project id for a session, or undefined if it isn't the open one. */
  readonly projectOf: (session: string) => string | undefined;
  /** Sends an event to the editor window. */
  readonly emit: (event: AssistantEvent) => void;
  /** Opens a web address in the person's browser (`shell.openExternal`). */
  readonly openExternal: (url: string) => Promise<void>;
  readonly now?: () => Date;
  readonly files?: JsonStoreFiles;
};

/** The service and what 6.9b's loop uses beside it: the endpoint's key, and adding a reply's cost. */
export type Assistant = AssistantService & {
  /** Each site's conversation, by its project id, in memory only: 6.9b's loop adds the turns. */
  readonly conversations: Map<string, ConversationTurn[]>;
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
      // AIA-5's setting stays off and hidden until 6.9b stages commands (ADR 0026 §7).
      reviewBeforeApplying: false,
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
          ? ["https://openrouter.ai/api/v1/key", OPENROUTER_KEY]
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
    send: async (session) => {
      const current = await status();
      if (options.projectOf(session) === undefined) return { status: "no-site" };
      if (!current.enabled) return { status: "consent-needed" };
      if (current.reach !== "this-computer" && !(await service.siteConsent(session)).allowed) {
        return { status: "consent-needed" };
      }
      if (current.provider.kind === "openrouter" && !current.provider.signedIn) {
        return { status: "not-signed-in" };
      }
      if (current.model === null) return { status: "no-model" };
      if (current.month.reached) return { status: "limit-reached" };
      // 6.9b's loop answers from here.
      return { status: "failed" };
    },
    stop: async () => undefined,
    newConversation: async (session) => {
      const project = options.projectOf(session);
      if (project !== undefined) conversations.delete(project);
    },
    conversation: async (session) => {
      const project = options.projectOf(session);
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
