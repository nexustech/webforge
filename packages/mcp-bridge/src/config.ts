import { z } from "zod";

/** 256 random bits or more, base64url: a key or a proof (ADR 0021). */
const SECRET = /^[A-Za-z0-9_-]{43,128}$/;

/** What the bridge says to the AI app when a message can't reach Webforge, in the app's language. */
const messagesSchema = z.strictObject({
  /** Nothing answers at the address: Webforge is closed, or AI apps is off. */
  unreachable: z.string().min(1),
  /** Something answers that couldn't prove it's Webforge: the key wasn't sent. */
  notWebforge: z.string().min(1),
  /** Webforge didn't take the key. */
  keyRefused: z.string().min(1),
  /** Webforge answered with an error. */
  failed: z.string().min(1),
});

/** The bridge's settings, from its extension's manifest and Claude Desktop (ADR 0021). */
const bridgeConfigSchema = z.strictObject({
  /** Webforge's MCP address: `http://127.0.0.1:<port>/mcp`, the literal loopback address only. */
  address: z
    .url()
    .refine(
      (value) => /^http:\/\/127\.0\.0\.1:\d{1,5}\/mcp$/.test(value),
      "not Webforge's address",
    ),
  /** The paired app's id, which the server finds the pairing's proof by. */
  app: z.uuid(),
  /** The pairing's server proof, which the bridge checks Webforge's answers by. */
  proof: z.string().regex(SECRET),
  /**
   * The app's key, the extension's one sensitive setting; `null` if it wasn't pasted, or isn't a
   * key: the bridge then answers each request that Webforge didn't take it, and sends nothing.
   */
  key: z.string().regex(SECRET).nullable(),
  messages: messagesSchema,
});

/** See {@link bridgeConfigSchema}. */
export type BridgeConfig = z.infer<typeof bridgeConfigSchema>;

/** The environment variables the extension's manifest sets for the bridge. */
export const BRIDGE_ENV = {
  address: "WEBFORGE_ADDRESS",
  app: "WEBFORGE_APP",
  proof: "WEBFORGE_PROOF",
  key: "WEBFORGE_KEY",
  messages: "WEBFORGE_MESSAGES",
} as const;

/**
 * The bridge's settings from `env`, or `undefined` if any but the key is missing or malformed: the
 * manifest Webforge wrote sets them. Nothing of them is said.
 */
export function configFromEnv(env: Readonly<Record<string, string | undefined>>) {
  let messages: unknown;
  try {
    messages = JSON.parse(env[BRIDGE_ENV.messages] ?? "");
  } catch {
    return undefined;
  }
  // A pasted key often comes with a space or a line break around it.
  const key = (env[BRIDGE_ENV.key] ?? "").trim();
  const parsed = bridgeConfigSchema.safeParse({
    address: env[BRIDGE_ENV.address],
    app: env[BRIDGE_ENV.app],
    proof: env[BRIDGE_ENV.proof],
    key: SECRET.test(key) ? key : null,
    messages,
  });
  return parsed.success ? parsed.data : undefined;
}
