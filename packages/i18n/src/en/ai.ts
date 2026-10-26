/** AI apps (F-AI-1, 4.8): what their changes are called in Undo History, and what they ask. */
export const ai = {
  // "AI (Claude): Added Hero": every change an AI app makes is one undo step, named after it.
  "ai.history": "AI ({app}): {action}",
  "ai.history.theme": "Changed the theme",
  // The D7 confirmation an AI app's change to more than one page waits for.
  "ai.confirm.title": "Allow {app} to make this change?",
  "ai.confirm.theme": "{app} wants to change the theme. It changes every page.",
  "ai.confirm.layout": "{app} wants to change the {part}. It is on {count} pages.",
  "ai.confirm.shared": "{app} wants to change the shared section {name}. It is on {count} pages.",
  "ai.confirm.allow": "Allow",
  "ai.confirm.decline": "Don't allow",
  "ai.part.header": "Header",
  "ai.part.footer": "Footer",
} as const;
