/** The assistant's panel (`apps/desktop/src/renderer/assistant/`, 6.9c, AIA-5…AIA-8, ADR 0026). */
export const assistant = {
  // A link in a reply (product/14 §6.4): its address is always shown, and it opens only when clicked.
  "assistant.link.open": "Open {address} in your browser",
  "assistant.image": "Image not shown: {alt}",
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
} as const;
