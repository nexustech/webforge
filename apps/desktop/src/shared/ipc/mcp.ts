import { z } from "zod";
import { AI_CLIENT_IDS, type AiClientId } from "../ai-clients/index.js";

/** The longest name the person can give an AI app (the AI contract's limit). */
export const AI_APP_NAME_MAX = 80;

/** A paired AI app, as AI apps lists it: never its key. */
const pairedAppSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(AI_APP_NAME_MAX),
  /** Whether its key has been used: until then, the key waits, and is revoked after 5 minutes. */
  claimed: z.boolean(),
  /** Whether it has a connection now. */
  connected: z.boolean(),
});

/** AI apps as the window shows them (4.9, ADR 0021). */
const statusSchema = z.strictObject({
  /** Whether *AI apps* is on: off, nothing listens. */
  enabled: z.boolean(),
  /** The address AI apps reach Webforge at, while it listens. */
  address: z.string().nullable(),
  /** The remembered address was taken: every app has to be added again at the new one. */
  moved: z.boolean(),
  apps: z.array(pairedAppSchema),
});

/** See {@link mcpChannels}' `mcpStatus`. */
export type McpStatus = z.infer<typeof statusSchema>;

/**
 * What *Add AI app* came to: the app paired, with its key, shown this once, and the address to
 * give with it; or why not.
 */
const addResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("paired"),
    app: pairedAppSchema,
    key: z.string().min(43).max(128),
    address: z.string(),
  }),
  z.strictObject({ status: z.enum(["name-empty", "name-taken", "off", "failed"]) }),
]);

/** See {@link mcpChannels}' `mcpAdd`. */
export type McpAddResult = z.infer<typeof addResultSchema>;

/**
 * What installing a paired app came to (#980): opened in the app, or shown in its folder as
 * nothing opened it (the app isn't installed?); or why not. `unknown`: the app isn't paired any
 * more, or isn't a kind main installs.
 */
const installResultSchema = z.strictObject({
  status: z.enum(["opened", "shown", "off", "unknown", "failed"]),
});

/** See {@link mcpChannels}' `mcpInstall`. */
export type McpInstallResult = z.infer<typeof installResultSchema>;

/** IPC channels of the `mcp` domain (`mcp:*`). Each one's arguments are checked. */
export const mcpChannels = {
  /** AI apps as they are now: on or off, the address, the paired apps and who's connected. */
  mcpStatus: {
    channel: "mcp:status",
    request: z.tuple([]),
    response: statusSchema,
  },
  /** Turns *AI apps* on or off at once: listening, or cutting every app off. */
  mcpSetEnabled: {
    channel: "mcp:set-enabled",
    request: z.tuple([z.boolean()]),
    response: statusSchema,
  },
  /** Pairs an app by the name the person gives it; only while *AI apps* is on. */
  mcpAdd: {
    channel: "mcp:add",
    request: z.tuple([z.string().max(1_000), z.enum(AI_CLIENT_IDS)]),
    response: addResultSchema,
  },
  /** The person has seen that Webforge's address for AI apps changed (S27): stop saying so. */
  mcpSeenMoved: {
    channel: "mcp:seen-moved",
    request: z.tuple([]),
    response: z.null(),
  },
  /**
   * Installs Webforge's server in a paired app, as its kind does (#980): Claude Desktop's
   * extension written and opened (ADR 0021), VS Code's install link opened (5.13). Never with the
   * app's key.
   */
  mcpInstall: {
    channel: "mcp:install",
    request: z.tuple([z.uuid()]),
    response: installResultSchema,
  },
  /** Removes a paired app, cutting it off at once. */
  mcpRemove: {
    channel: "mcp:remove",
    request: z.tuple([z.uuid()]),
    response: statusSchema,
  },
} as const;

/** `window.webforge.mcp`: AI apps (4.9, F-AI-1). */
export interface McpApi {
  status(): Promise<McpStatus>;
  setEnabled(enabled: boolean): Promise<McpStatus>;
  /** Pairs an app of kind `kind` (`AI_CLIENTS`). */
  add(name: string, kind: AiClientId): Promise<McpAddResult>;
  seenMoved(): Promise<void>;
  /** Installs Webforge's server in paired app `id`, as its kind does. */
  install(id: string): Promise<McpInstallResult>;
  remove(id: string): Promise<McpStatus>;
}
