import type { AssistantErrorCode } from "../../shared/ipc/assistant.js";
import { assistantCredentialKey, type CredentialStore } from "../credential-store.js";
import { type ChatEndpoint, keySafeAt } from "./chat-client.js";

/**
 * Where the assistant's model calls go, and with what (ADR 0026 §2): one place for the address,
 * the key, OpenRouter's privacy routing and the model, for 6.9b's loop and 6.9d's drafts (#873).
 */

/** OpenRouter's API, up to `/api/v1`. */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Where each provider's key is kept: only ever in the credential store. */
export const OPENROUTER_KEY = assistantCredentialKey("openrouter");
export const SERVER_KEY = assistantCredentialKey("server");

/** What the endpoint depends on, from the assistant's settings: never a key. */
export type EndpointSettings = {
  readonly provider:
    | { readonly kind: "openrouter" }
    | { readonly kind: "ollama" | "lmstudio" | "server"; readonly baseUrl: string };
  readonly model: { readonly id: string } | null;
  readonly allowRetainingModels: boolean;
};

/** An endpoint ready for `streamChat`, and the model to ask; or why there's none. */
export type EndpointResult =
  | { readonly status: "ok"; readonly endpoint: ChatEndpoint; readonly model: string }
  | { readonly status: AssistantErrorCode };

/**
 * The endpoint for `settings`:
 * - OpenRouter with its key, its title header (`title`, the app's name, which carries no content)
 *   and its privacy routing: `zdr` and `data_collection: "deny"` unless *Allow models that may
 *   keep requests* is on;
 * - a local server with no key;
 * - another server with its key, if it has one, never over plain `http:` to another computer
 *   (#976).
 *
 * `not-signed-in` without OpenRouter's key, `no-model` with no model chosen.
 */
export async function endpointFor(
  settings: EndpointSettings,
  credentials: Pick<CredentialStore, "get">,
  title: string,
): Promise<EndpointResult> {
  if (settings.model === null) return { status: "no-model" };
  const model = settings.model.id;
  const { provider } = settings;
  if (provider.kind === "openrouter") {
    const key = await credentials.get(OPENROUTER_KEY);
    if (key === null) return { status: "not-signed-in" };
    return {
      status: "ok",
      model,
      endpoint: {
        baseUrl: OPENROUTER_BASE_URL,
        key,
        openRouter: { title, allowRetaining: settings.allowRetainingModels },
      },
    };
  }
  if (provider.kind !== "server") {
    return { status: "ok", model, endpoint: { baseUrl: provider.baseUrl } };
  }
  const key = await credentials.get(SERVER_KEY);
  if (key === null) return { status: "ok", model, endpoint: { baseUrl: provider.baseUrl } };
  if (!keySafeAt(provider.baseUrl)) return { status: "insecure-server" };
  return { status: "ok", model, endpoint: { baseUrl: provider.baseUrl, key } };
}
