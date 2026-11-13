/** The assistant's panel (`apps/desktop/src/renderer/assistant/`, 6.9c, AIA-5…AIA-8, ADR 0026). */
export const assistant = {
  "assistant.conversation": "Conversation with the assistant",
  "assistant.you": "You",
  "assistant.name": "Assistant",
  "assistant.empty":
    "Ask the assistant to change your site, for example “Make the Hero's title shorter”.",
  "assistant.replying": "Replying…",
  // A link in a reply (product/14 §6.4): its address is always shown, and it opens only when clicked.
  "assistant.link.open": "Open {address} in your browser",
  "assistant.image": "Image not shown: {alt}",
  // What a reply did, besides its text.
  "assistant.tool.running": "Working on your site…",
  "assistant.tool.read.one": "Looked at 1 part of your site",
  "assistant.tool.read.other": "Looked at {count} parts of your site",
  "assistant.tool.refused": "A change wasn't allowed here.",
  "assistant.tool.declined": "You said no to a change.",
  "assistant.tool.busy": "A change waited while you were editing.",
  "assistant.tool.invalid": "A change didn't fit the site, so it wasn't made.",
  "assistant.tool.failed": "A change couldn't be made.",
  "assistant.steps": "Changes in this reply",
  // Why a reply stopped before it ended by itself (ADR 0026 §5).
  "assistant.stop.stopped": "You stopped this reply.",
  "assistant.stop.tool-cap": "Stopped: a reply can make at most 25 changes or lookups.",
  "assistant.stop.model-call-cap": "Stopped: this reply took too many steps.",
  "assistant.stop.max-tokens": "Stopped: the reply was too long.",
  "assistant.stop.limit-reached": "Stopped: this month's limit is reached.",
  // Why a message wasn't sent, or a reply failed (ADR 0026 §7). Never the provider's own text.
  "assistant.error.consent-needed": "The assistant needs your yes before it can work on this site.",
  "assistant.error.not-signed-in": "Sign in to OpenRouter in Preferences › Assistant first.",
  "assistant.error.no-model": "Choose a model in Preferences › Assistant first.",
  "assistant.error.limit-reached":
    "This month's limit is reached. Raise it in Preferences › Assistant, or wait for next month.",
  "assistant.error.busy": "The assistant is still replying. Wait for it, or stop it.",
  "assistant.error.no-site": "Open a site to use the assistant.",
  "assistant.error.offline": "The assistant couldn't be reached. Check your internet connection.",
  "assistant.error.unauthorized":
    "OpenRouter didn't accept the sign-in. Sign in again in Preferences › Assistant.",
  "assistant.error.no-credit": "Your OpenRouter account has run out of credit.",
  "assistant.error.rate-limited": "Too many messages at once. Try again in a minute.",
  "assistant.error.model-unavailable":
    "The model you chose isn't available now. Try again later, or choose another.",
  "assistant.error.provider-error": "The assistant's provider couldn't answer. Try again.",
  "assistant.error.failed": "Something went wrong. Try again.",
  // Cost, in US dollars as OpenRouter bills (AIA-8).
  "assistant.cost.reply": "This reply cost {cost}",
  "assistant.cost.free": "No cost shown for this reply",
  // This month's spend, in US dollars as OpenRouter bills (AIA-8).
  "assistant.month": "This month: {spent} of {limit}",
  "assistant.month.warning": "This month: {spent} of {limit}, over 80% of your limit",
  "assistant.month.reached": "This month's limit of {limit} is reached",
  // The review card after a reply that changed the site (AIA-5, WF-2).
  "assistant.review.title.one": "This reply made 1 change",
  "assistant.review.title.other": "This reply made {count} changes",
  "assistant.review.show": "Show {change} on the page",
  "assistant.review.links": "Links to other websites",
  "assistant.review.keep": "Keep",
  "assistant.review.undo": "Undo These Changes",
  "assistant.review.undone": "These changes are undone. Redo brings them back.",
  "assistant.review.movedOn":
    "Other changes have been made since. To take back everything the assistant changed, restore the version saved before its changes.",
  "assistant.review.versions": "Open Version History",
  // A key that would go over plain http:// to another computer (ADR 0026 §7, #976).
  "assistant.error.insecure-server":
    "The server's address starts with http://, so your key and your site's text would travel unencrypted. Use an https:// address in Preferences › Assistant, or a server on this computer.",
} as const;
