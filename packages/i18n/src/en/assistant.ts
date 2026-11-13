/** The assistant's panel (`apps/desktop/src/renderer/assistant/`, 6.9c, AIA-5…AIA-8, ADR 0026). */
export const assistant = {
  // A link in a reply (product/14 §6.4): its address is always shown, and it opens only when clicked.
  "assistant.link.open": "Open {address} in your browser",
  "assistant.image": "Image not shown: {alt}",
  // This month's spend, in US dollars as OpenRouter bills (AIA-8).
  "assistant.month": "This month: {spent} of {limit}",
  "assistant.month.warning": "This month: {spent} of {limit}, over 80% of your limit",
  "assistant.month.reached": "This month's limit of {limit} is reached",
  // A key that would go over plain http:// to another computer (ADR 0026 §7, #976).
  "assistant.error.insecure-server":
    "The server's address starts with http://, so your key and your site's text would travel unencrypted. Use an https:// address in Preferences › Assistant, or a server on this computer.",
} as const;
