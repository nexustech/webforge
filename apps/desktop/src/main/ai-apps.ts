import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { type CredentialStore, mcpCredentialKey } from "./credential-store.js";
import type { JsonStore } from "./json-store.js";
import type { McpApp } from "./mcp-server.js";

/** How long a new key stays valid without being used: then it's revoked (ADR 0021). */
export const UNCLAIMED_KEY_MS = 5 * 60_000;

/** Failed attempts in a minute before the server backs off. */
const FAILURES_BEFORE_BACK_OFF = 3;
/** The first back-off, doubling with each further failure, up to {@link MAX_BACK_OFF_MS}. */
const FIRST_BACK_OFF_MS = 1_000;
const MAX_BACK_OFF_MS = 60_000;
const FAILURE_WINDOW_MS = 60_000;

/** The longest app name, as the AI contract takes it ("AI (‹app›): …"). */
const NAME_MAX = 80;

/** A paired AI app, as Preferences › AI apps lists it: never its key. */
export type PairedApp = {
  readonly id: string;
  /** The name the person gave it, cleaned. */
  readonly name: string;
  readonly pairedAt: number;
  /** When it first connected with its key; `null` while the key waits to be used. */
  readonly claimedAt: number | null;
};

const pairedAppSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(NAME_MAX),
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

/** The paired AI apps (4.9, ADR 0021). */
export type AiApps = {
  /** The paired apps, those whose key waited too long left out (and removed). */
  list(): Promise<readonly PairedApp[]>;
  /** Pairs an app named `name` (the person's name for it, cleaned), with a new key and proof. */
  add(name: string): Promise<NewPairing>;
  remove(id: string): Promise<void>;
  /**
   * The app `key` belongs to, if any: compared by hash, in constant time. Its first use claims
   * it; a key not used within {@link UNCLAIMED_KEY_MS} is revoked. After a few failures in a
   * minute, every attempt fails for a while, doubling (back-off).
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

/** The paired apps in `file`, their secrets in `credentials`. */
export function createAiApps(
  file: JsonStore<AiAppsFile>,
  credentials: CredentialStore,
  now: () => number = Date.now,
): AiApps {
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

  let failures: number[] = [];
  let backOffUntil = 0;
  let backOffMs = FIRST_BACK_OFF_MS;
  const failed = () => {
    const at = now();
    failures = [...failures.filter((time) => at - time < FAILURE_WINDOW_MS), at];
    if (failures.length >= FAILURES_BEFORE_BACK_OFF) {
      backOffUntil = at + backOffMs;
      backOffMs = Math.min(backOffMs * 2, MAX_BACK_OFF_MS);
    }
    return undefined;
  };

  return {
    list,
    async add(name) {
      const cleaned = cleanAppName(name);
      if (cleaned === "") throw new Error("An AI app needs a name");
      const app: PairedApp = { id: randomUUID(), name: cleaned, pairedAt: now(), claimedAt: null };
      const pairing = { app, key: secret(), proof: secret() };
      const stored = { keyHash: hashOf(pairing.key).toString("base64url"), proof: pairing.proof };
      await credentials.set(mcpCredentialKey(app.id), JSON.stringify(stored));
      secrets.set(app.id, stored);
      await file.update((current) => ({ ...current, apps: [...current.apps, app] }));
      return pairing;
    },
    remove,
    async authenticate(key) {
      if (now() < backOffUntil) return undefined;
      const hash = hashOf(key);
      for (const app of await list()) {
        const stored = await secretOf(app.id);
        const known = stored === null ? null : Buffer.from(stored.keyHash, "base64url");
        if (known === null || known.length !== hash.length || !timingSafeEqual(known, hash)) {
          continue;
        }
        failures = [];
        backOffMs = FIRST_BACK_OFF_MS;
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
