import { claudeCode } from "./claude-code.js";
import { claudeDesktop } from "./claude-desktop.js";
import { otherApp } from "./other.js";
import type { AiClient } from "./types.js";
import { vsCode } from "./vscode.js";

export type { AiClient } from "./types.js";

/**
 * The kinds of AI app the person can pair, in *Which app?*'s order (#980). Adding one is a module
 * in this folder and its entry here, with its strings under `aiApps.client.*`; and, if main
 * installs it, its install in `main/ai-clients/` (`docs/extending.md`).
 */
export const AI_CLIENTS: readonly AiClient<AiClientId>[] = [
  claudeDesktop,
  claudeCode,
  vsCode,
  otherApp,
];

/** Every kind's id, as a paired app stores it. */
export const AI_CLIENT_IDS = [claudeDesktop.id, claudeCode.id, vsCode.id, otherApp.id] as const;

/** One of {@link AI_CLIENT_IDS}. */
export type AiClientId = (typeof AI_CLIENT_IDS)[number];

/** The kind an app pairs as unless the person picks another. */
export const DEFAULT_CLIENT: AiClientId = claudeDesktop.id;

/** The kind with id `id`; an app paired before kinds were kept is the generic one (#794). */
export const clientOf = (id: AiClientId | undefined): AiClient =>
  AI_CLIENTS.find((client) => client.id === id) ?? otherApp;
