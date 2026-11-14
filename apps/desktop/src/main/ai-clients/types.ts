import type { AiClientId } from "../../shared/ai-clients/index.js";

/** What an install for a paired app takes: never its key. */
type InstallRequest = {
  readonly appId: string;
  /** Where Webforge's server is, for the app to connect to. */
  readonly address: string;
  /** The app's server proof, for a client that checks it's Webforge it talks to. */
  readonly proof: string;
  readonly pairedAt: number;
};

/**
 * How main installs Webforge's server in a kind of app (#980): opened in it, or shown in its
 * folder as nothing opened it; and what's removed with a paired app of that kind.
 */
export type ClientInstall = {
  install(request: InstallRequest): Promise<"opened" | "shown">;
  remove?(appId: string): Promise<void>;
};

/** Each kind's install, for the kinds main installs (`AI_CLIENTS`' with an `install`). */
export type ClientInstalls = Partial<Readonly<Record<AiClientId, ClientInstall>>>;
