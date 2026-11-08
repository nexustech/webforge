import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { type CredentialStore, mcpCredentialKey } from "./credential-store.js";
import type { JsonStore } from "./json-store.js";
import type { McpApp } from "./mcp-server.js";

/** How long a new key stays valid without being used: then it's revoked (ADR 0021). */
export const UNCLAIMED_KEY_MS = 5 * 60_000;

/** Wrong keys in a minute before each further wrong key's answer is held back. */
const FAILURES_BEFORE_DELAY = 3;
/**
 * How long a wrong key's answer then waits, doubling with each, up to {@link MAX_DELAY_MS}: a
 * caller hammering the server is slowed, and a connection is never held open for long.
 */
const FIRST_DELAY_MS = 250;
const MAX_DELAY_MS = 2_000;
const FAILURE_WINDOW_MS = 60_000;
/**
 * The most wrong keys' answers held back at once (S28, #794): beyond it, a wrong key is answered
 * at once, so a flood of them holds nothing open. A right key is never held back.
 */
const MAX_HELD_BACK = 16;

/** The longest app name, as the AI contract takes it ("AI (‹app›): …"). */
const NAME_MAX = 80;

/**
 * How an app reaches Webforge: Claude Desktop through its extension's bridge, which checks it's
 * Webforge before it sends its key; or another app directly, which sends its key to whatever
 * answers at the address (ADR 0021).
 */
export type AppKind = "claude" | "other";

/** A paired AI app, as Preferences › AI apps lists it: never its key. */
export type PairedApp = {
  readonly id: string;
  /** The name the person gave it, cleaned. */
  readonly name: string;
  /** How it connects; left out by builds before #794, and then taken as `other`. */
  readonly kind?: AppKind;
  readonly pairedAt: number;
  /** When it first connected with its key; `null` while the key waits to be used. */
  readonly claimedAt: number | null;
};

const pairedAppSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(NAME_MAX),
  kind: z.enum(["claude", "other"]).exactOptional(),
  pairedAt: z.number().int().nonnegative(),
  claimedAt: z.number().int().nonnegative().nullable(),
});

/** The paired apps (`<userData>/ai-apps.json`), and the port they reach Webforge on. */
export const aiAppsFileSchema = z.strictObject({
  version: z.literal(1),
  apps: z.array(pairedAppSchema).max(50),
  /** Whether *AI apps* is on in Preferences: off by default, and then nothing listens. */
  enabled: z.boolean(),
  /** Drawn once, the first time AI apps is turned on (ADR 0021); `null` until then. */
  port: z.int().min(1024).max(65535).nullable(),
  /**
   * The remembered port was taken, and Webforge listens on another (S27, #794): kept until the
   * person has seen it in AI apps, so a warning shown once at start isn't lost.
   */
  moved: z.boolean().exactOptional(),
});

/** See {@link aiAppsFileSchema}. */
export type AiAppsFile = z.infer<typeof aiAppsFileSchema>;

/** An empty {@link AiAppsFile}. */
export const NO_AI_APPS: AiAppsFile = { version: 1, apps: [], enabled: false, port: null };

/** What the credential store keeps of an app: its key's hash and its server proof, never the key. */
const secretSchema = z.strictObject({ keyHash: z.string(), proof: z.string() });

/** A new pairing: the app, its key (shown once), and the proof its bridge checks Webforge by. */
export type NewPairing = {
  readonly app: PairedApp;
  readonly key: string;
  readonly proof: string;
};

/**
 * What pairing an app came to: paired, or refused for a name that's empty once cleaned, or one
 * another paired app has (compared without case). Each app's name is its own: its changes are
 * named by it in Undo History, and its limits go by it as the bridge keeps them (#744 review).
 */
export type Pairing =
  | ({ readonly status: "paired" } & NewPairing)
  | { readonly status: "name-empty" | "name-taken" };

/** The paired AI apps (4.9, ADR 0021). */
export type AiApps = {
  /** The paired apps, those whose key waited too long left out (and removed). */
  list(): Promise<readonly PairedApp[]>;
  /**
   * Pairs an app named `name` (the person's name for it, cleaned), with a new key and proof, unless
   * the name is empty or another app's.
   */
  add(name: string, kind: AppKind): Promise<Pairing>;
  remove(id: string): Promise<void>;
  /**
   * Removes the apps that send their key to whatever answers at the address (`other`), with their
   * keys, and records that the port moved (S27): a program that took the old port may have been
   * sent their keys. Claude Desktop's bridge checks it's Webforge first, so its key never went.
   * Resolves to the ids removed.
   */
  movedFrom(): Promise<readonly string[]>;
  /** Whether the port moved since the person last saw AI apps. */
  moved(): Promise<boolean>;
  /** The person has seen that the port moved. */
  seenMoved(): Promise<void>;
  /**
   * The app `key` belongs to, if any: compared by hash, in constant time. Its first use claims
   * it; a key not used within {@link UNCLAIMED_KEY_MS} is revoked. A right key is always
   * accepted at once. After a few wrong keys in a minute, each further wrong key's answer is held
   * back a little longer, up to {@link MAX_DELAY_MS}: no caller can lock the paired apps out, as a
   * refusal of right keys would let any program on the computer do (#746 review).
   */
  authenticate(key: string): Promise<McpApp | undefined>;
  /** The server proof of app `id`, which its bridge checks (ADR 0021); `null` if none. */
  proofOf(id: string): Promise<string | null>;
  /** Whether *AI apps* is on. */
  enabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  /** The remembered port, or `null` before the first time AI apps is on. */
  port(): Promise<number | null>;
  setPort(port: number): Promise<void>;
};

/** `name` as an app's name: one line, no control characters, trimmed, at most {@link NAME_MAX}. */
export function cleanAppName(name: string): string {
  return name
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

const hashOf = (key: string) => createHash("sha256").update(key, "utf8").digest();

/** 256 random bits, base64url: a key or a proof. */
const secret = () => randomBytes(32).toString("base64url");

/**
 * `store`, read once and then kept in memory (S28, #794): every authentication and challenge reads
 * the apps, and a flood of them shouldn't queue behind the disk. Every change goes through here,
 * so what's kept is what's written.
 */
function cached(store: JsonStore<AiAppsFile>): JsonStore<AiAppsFile> {
  let kept: AiAppsFile | undefined;
  return {
    async read() {
      kept ??= await store.read();
      return kept;
    },
    async update(change) {
      try {
        await store.update((current) => {
          const next = change(current);
          kept = next ?? current;
          return next;
        });
      } catch (error) {
        // Not written: the next read goes to the file again.
        kept = undefined;
        throw error;
      }
    },
    idle: () => store.idle(),
  };
}

/** The paired apps in `store`, their secrets in `credentials`. */
export function createAiApps(
  store: JsonStore<AiAppsFile>,
  credentials: CredentialStore,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
): AiApps {
  const file = cached(store);
  /** Each app's secret, read once: the store decrypts on every read. */
  const secrets = new Map<string, z.infer<typeof secretSchema> | null>();
  const secretOf = async (id: string) => {
    if (!secrets.has(id)) {
      const stored = await credentials.get(mcpCredentialKey(id));
      let parsed: z.infer<typeof secretSchema> | null = null;
      try {
        parsed = stored === null ? null : secretSchema.parse(JSON.parse(stored));
      } catch {
        parsed = null;
      }
      secrets.set(id, parsed);
    }
    return secrets.get(id) ?? null;
  };

  const expired = (app: PairedApp) =>
    app.claimedAt === null && now() - app.pairedAt > UNCLAIMED_KEY_MS;

  const remove = async (id: string) => {
    secrets.delete(id);
    await credentials.delete(mcpCredentialKey(id));
    await file.update((current) =>
      current.apps.some((app) => app.id === id)
        ? { ...current, apps: current.apps.filter((app) => app.id !== id) }
        : undefined,
    );
  };

  const list = async () => {
    const { apps } = await file.read();
    for (const app of apps.filter(expired)) await remove(app.id);
    return apps.filter((app) => !expired(app));
  };

  /** Wrong keys since `since`: a count, which a flood of them can't grow past a number (S28). */
  let failures = { since: Number.NEGATIVE_INFINITY, count: 0 };
  /** Wrong keys whose answers are being held back now. */
  let heldBack = 0;
  /** A wrong key: counted, and its answer held back once there have been a few in a minute. */
  const failed = async () => {
    const at = now();
    if (at - failures.since >= FAILURE_WINDOW_MS) failures = { since: at, count: 0 };
    failures.count += 1;
    const over = failures.count - FAILURES_BEFORE_DELAY;
    if (over < 0 || heldBack >= MAX_HELD_BACK) return undefined;
    heldBack += 1;
    try {
      await sleep(Math.min(FIRST_DELAY_MS * 2 ** over, MAX_DELAY_MS));
    } finally {
      heldBack -= 1;
    }
    return undefined;
  };

  return {
    list,
    async add(name, kind) {
      const cleaned = cleanAppName(name);
      if (cleaned === "") return { status: "name-empty" };
      const same = cleaned.toLocaleLowerCase();
      if ((await list()).some((app) => app.name.toLocaleLowerCase() === same)) {
        return { status: "name-taken" };
      }
      const app: PairedApp = {
        id: randomUUID(),
        name: cleaned,
        kind,
        pairedAt: now(),
        claimedAt: null,
      };
      const pairing = { app, key: secret(), proof: secret() };
      const stored = { keyHash: hashOf(pairing.key).toString("base64url"), proof: pairing.proof };
      await credentials.set(mcpCredentialKey(app.id), JSON.stringify(stored));
      secrets.set(app.id, stored);
      await file.update((current) => ({ ...current, apps: [...current.apps, app] }));
      return { status: "paired", ...pairing };
    },
    remove,
    async movedFrom() {
      const direct = (await file.read()).apps.filter((app) => app.kind !== "claude");
      for (const app of direct) await remove(app.id);
      await file.update((current) =>
        current.moved === true ? undefined : { ...current, moved: true },
      );
      return direct.map((app) => app.id);
    },
    async moved() {
      return (await file.read()).moved === true;
    },
    async seenMoved() {
      await file.update((current) => {
        if (current.moved !== true) return undefined;
        const { moved: _seen, ...rest } = current;
        return rest;
      });
    },
    async authenticate(key) {
      const hash = hashOf(key);
      for (const app of await list()) {
        const stored = await secretOf(app.id);
        const known = stored === null ? null : Buffer.from(stored.keyHash, "base64url");
        if (known === null || known.length !== hash.length || !timingSafeEqual(known, hash)) {
          continue;
        }
        if (app.claimedAt === null) {
          await file.update((current) => ({
            ...current,
            apps: current.apps.map((each) =>
              each.id === app.id ? { ...each, claimedAt: now() } : each,
            ),
          }));
        }
        return { id: app.id, name: app.name };
      }
      return failed();
    },
    async proofOf(id) {
      return (await secretOf(id))?.proof ?? null;
    },
    async enabled() {
      return (await file.read()).enabled;
    },
    async setEnabled(enabled) {
      await file.update((current) =>
        current.enabled === enabled ? undefined : { ...current, enabled },
      );
    },
    async port() {
      return (await file.read()).port;
    },
    async setPort(port) {
      await file.update((current) => (current.port === port ? undefined : { ...current, port }));
    },
  };
}
