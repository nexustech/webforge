/** AI apps (F-AI-1, 4.8): what their changes are called in Undo History, and what they ask. */
export const ai = {
  // "AI (Claude): Added Hero": every change an AI app makes is one undo step, named after it.
  "ai.history": "AI ({app}): {action}",
  "ai.history.theme": "Changed the theme",
  // Several fields of one element at once: "AI (Claude): Edited Hero".
  "ai.history.fields": "Edited {item}",
  // The automatic version taken before an AI app's first change in a connection (S20), in Version
  // History.
  "ai.version.before": "Before {app}'s changes",
  // The D7 question an AI app's change to more than one page waits for; the dialog then says how
  // many pages change ("This changes 3 pages.").
  "ai.confirm.theme": "Allow {app} to change the theme?",
  "ai.confirm.addPage": "Allow {app} to add the page {title}, with a menu entry on every page?",
  // Deleting a page, as the person's Delete Page asks (4.11): the dialog then says how many pages
  // change, links to it on other pages included.
  "ai.confirm.removePage": "Allow {app} to delete the page {title}?",
  // Site Settings show on every page (4.11): "Allow Claude to change Site Settings: Contact & hours?"
  "ai.confirm.settings": "Allow {app} to change Site Settings: {sections}?",
  "ai.confirm.layout": "Allow {app} to change the {part}?",
  "ai.confirm.shared": "Allow {app} to change the shared section {name}?",
  "ai.confirm.allow": "Allow",
  // Asked whenever an AI app sets where visitors' money or details go (S18), on one page too:
  // "Allow Claude to change the Buy button's Payment link?", then where it goes now and would go.
  "ai.confirm.destination": "Allow {app} to change the {item}'s {field}?",
  "ai.confirm.destinationFromTo": "{field}: from {from} to {to}.",
  // Where a field with no address sends visitors.
  "ai.confirm.noAddress": "no address",
  "ai.part.header": "Header",
  "ai.part.footer": "Footer",
} as const;
