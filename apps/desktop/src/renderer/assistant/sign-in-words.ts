import type { AssistantApi } from "../../shared/ipc/assistant.js";

/** How a sign-in or a key came out (ADR 0026 §7's `SignInResult`). */
export type SignInStatus = Awaited<ReturnType<AssistantApi["signIn"]>>["status"];

/** The sign-in outcomes the panel words; any other reads as *failed*. */
const SIGN_IN = [
  "signed-in",
  "cancelled",
  "timed-out",
  "refused",
  "keychain-unavailable",
  "offline",
  "insecure-server",
  "failed",
] as const;
export const signInKey = (status: string) =>
  `assistant.signIn.${SIGN_IN.find((each) => each === status) ?? "failed"}` as const;
