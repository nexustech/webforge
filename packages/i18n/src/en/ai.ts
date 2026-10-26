/** AI apps (F-AI-1, 4.8): what their changes are called in Undo History, and what they ask. */
export const ai = {
  // "AI (Claude): Added Hero": every change an AI app makes is one undo step, named after it.
  "ai.history": "AI ({app}): {action}",
  "ai.history.theme": "Changed the theme",
  // Several fields of one element at once: "AI (Claude): Edited Hero".
  "ai.history.fields": "Edited {item}",
  // The D7 question an AI app's change to more than one page waits for; the dialog then says how
  // many pages change ("This changes 3 pages.").
  "ai.confirm.theme": "Allow {app} to change the theme?",
  "ai.confirm.layout": "Allow {app} to change the {part}?",
  "ai.confirm.shared": "Allow {app} to change the shared section {name}?",
  "ai.confirm.allow": "Allow",
  "ai.part.header": "Header",
  "ai.part.footer": "Footer",
} as const;
