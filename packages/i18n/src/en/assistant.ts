/** The assistant's panel (`apps/desktop/src/renderer/assistant/`, 6.9c, AIA-5…AIA-8, ADR 0026). */
export const assistant = {
  // A link in a reply (product/14 §6.4): its address is always shown, and it opens only when clicked.
  "assistant.link.open": "Open {address} in your browser",
  "assistant.image": "Image not shown: {alt}",
  // This month's spend, in US dollars as OpenRouter bills (AIA-8).
  "assistant.month": "This month: {spent} of {limit}",
  "assistant.month.warning": "This month: {spent} of {limit}, over 80% of your limit",
  "assistant.month.reached": "This month's limit of {limit} is reached",
  // OpenRouter's sign-in (ADR 0026 §3): the key's label in the person's account, never the
  // computer's name, and the page the browser shows after it.
  "assistant.signIn.keyLabel": "{appName}, {date}",
  "assistant.signIn.doneTitle": "Signed in to OpenRouter",
  "assistant.signIn.done": "You're signed in. You can close this tab and go back to {appName}.",
} as const;
