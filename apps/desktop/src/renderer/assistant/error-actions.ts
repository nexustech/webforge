import {
  ASSISTANT_ERRORS,
  type AssistantErrorCode,
  type AssistantStatus,
} from "../../shared/ipc/assistant.js";

/**
 * What the person can do about each of the assistant's errors (5.20, OL-5), under its message in the
 * panel: send the message again, open *Settings › Assistant*, or add credit on OpenRouter's site.
 */
export type ErrorAction = "retry" | "settings" | "credits";

/** Where the assistant's requests go: OpenRouter, a server on this computer, or another server. */
type ProviderKind = AssistantStatus["provider"]["kind"];

/**
 * Each code's actions. None where the panel already offers the way on: its own consent screen
 * (`consent-needed`), its Stop button (`busy`), or the site's window (`no-site`).
 */
const ACTIONS: Readonly<Record<AssistantErrorCode, readonly ErrorAction[]>> = {
  "consent-needed": [],
  "not-signed-in": ["settings"],
  "no-model": ["settings"],
  "limit-reached": ["settings"],
  busy: [],
  "no-site": [],
  offline: ["retry"],
  unauthorized: ["settings"],
  "no-credit": ["credits"],
  "rate-limited": ["retry"],
  "model-unavailable": ["retry", "settings"],
  "provider-error": ["retry"],
  "insecure-server": ["settings"],
  failed: ["retry"],
};

/** `code` as the panel knows it: any it doesn't (a newer main's) is `failed`. */
const known = (code: string | undefined): AssistantErrorCode =>
  ASSISTANT_ERRORS.find((each) => each === code) ?? "failed";

/**
 * The actions for `code` from `provider`. OpenRouter's page for credit only for OpenRouter's own
 * *out of credit*: another server's account is the person's to see to there.
 */
export function errorActions(
  code: string | undefined,
  provider: ProviderKind | undefined,
): readonly ErrorAction[] {
  const actions = ACTIONS[known(code)];
  return provider === "openrouter" ? actions : actions.filter((each) => each !== "credits");
}

/**
 * The message for `code`. The two that name OpenRouter (*didn't accept the sign-in*, *out of
 * credit*) are worded for the server when `provider` is another.
 */
export function errorKey(code: string | undefined, provider?: ProviderKind) {
  const each = known(code);
  if (provider !== undefined && provider !== "openrouter") {
    if (each === "unauthorized") return "assistant.error.unauthorized-server" as const;
    if (each === "no-credit") return "assistant.error.no-credit-server" as const;
  }
  return `assistant.error.${each}` as const;
}
