/** Undo step labels (D2): verb + item name (stream C). */
export const history = {
  "history.added": "Added {item}",
  "history.moved": "Moved {item}",
  "history.deleted": "Deleted {item}",
  "history.duplicated": "Duplicated {item}",
  "history.editedText": "Edited {item} text",
  // For components with several text fields: "Edited Hero button text".
  "history.editedField": "Edited {item} {field}",
  "history.changed": "Changed {item} {field}",
  "history.changedPage": "Changed page settings",
  "history.editedPage": "Edited page",
  // An element the user named in Layers, used as {item} above.
  "history.namedItem": "'{name}'",
} as const;
