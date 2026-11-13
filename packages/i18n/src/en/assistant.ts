/**
 * The assistant (6.9a–c, ADR 0026): what main's codes say to the person. The panel (6.9c) adds its
 * own strings here.
 */
export const assistant = {
  // Why a message wasn't sent, or a reply stopped early (ADR 0026 §7, `AssistantErrorCode`).
  "assistant.error.consent-needed":
    "The assistant needs your go-ahead first, for {appName} and for this site.",
  "assistant.error.not-signed-in": "Sign in to OpenRouter in Settings › Assistant first.",
  "assistant.error.no-model": "Choose a model in Settings › Assistant first.",
  "assistant.error.limit-reached":
    "You've reached this month's limit for the assistant. Raise it in Settings › Assistant, or wait for next month.",
  "assistant.error.busy": "The assistant is still answering your last message.",
  "assistant.error.no-site": "Open a site to use the assistant.",
  "assistant.error.offline":
    "The assistant couldn't reach its server. Check your internet connection, then try again.",
  "assistant.error.unauthorized":
    "OpenRouter didn't accept {appName}'s key. Sign in again in Settings › Assistant.",
  "assistant.error.no-credit":
    "Your OpenRouter account has run out of credit. Add some in your account, then try again.",
  "assistant.error.rate-limited":
    "The model is busy with too many requests. Wait a minute, then try again.",
  "assistant.error.model-unavailable":
    "The model you chose isn't available now. Choose another in Settings › Assistant.",
  "assistant.error.provider-error": "The model's server couldn't answer. Try again.",
  "assistant.error.failed": "The assistant couldn't answer. Try again.",
  // Why a reply ended before it was finished (`ReplyStop`).
  "assistant.stop.stopped": "Stopped.",
  "assistant.stop.tool-cap":
    "The assistant stopped after 25 changes and lookups in one reply. Ask it to carry on if there's more to do.",
  "assistant.stop.model-call-cap":
    "The assistant stopped, as this reply was taking many steps. Ask it to carry on if there's more to do.",
  "assistant.stop.max-tokens": "The reply was cut short, as it was too long.",
  "assistant.stop.limit-reached":
    "The assistant stopped, as this month's limit is reached. Raise it in Settings › Assistant, or wait for next month.",
  // OpenRouter's sign-in (§3): the key's label in the person's account, and the page the browser
  // shows after it. Never the computer's name.
  "assistant.signIn.keyLabel": "{appName}, {date}",
  "assistant.signIn.doneTitle": "Signed in to OpenRouter",
  "assistant.signIn.done": "You're signed in. You can close this tab and go back to {appName}.",
  // The month's spend (§5).
  "assistant.limit.warning": "You've used {spent} of this month's {limit} for the assistant.",
  "assistant.limit.reached":
    "You've used this month's {limit} for the assistant. It stops until next month, or until you raise the limit in Settings › Assistant.",
} as const;
