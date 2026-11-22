import type { AiClient } from "./types.js";

export type { AiClient } from "./types.js";
/**
 * The kinds of AI app the person can pair, in *Which app?*'s order (#980). Adding one is a module
 * in this folder and its entry here, with its strings under `aiApps.client.*`; and, if main
 * installs it, its install in `main/ai-clients/` (`docs/extending.md`).
 */
export declare const AI_CLIENTS: readonly AiClient<AiClientId>[];
/** Every kind's id, as a paired app stores it. */
export declare const AI_CLIENT_IDS: readonly ["claude", "claudeCode", "vscode", "other"];
/** One of {@link AI_CLIENT_IDS}. */
export type AiClientId = (typeof AI_CLIENT_IDS)[number];
/** The kind an app pairs as unless the person picks another. */
export declare const DEFAULT_CLIENT: AiClientId;
/** The kind with id `id`; an app paired before kinds were kept is the generic one (#794). */
export declare const clientOf: (id: AiClientId | undefined) => AiClient;
//# sourceMappingURL=index.d.ts.map
