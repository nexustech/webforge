/**
 * English UI strings. Wording follows the glossary in `research/product/01-terminology.md`.
 * Keys are dotted paths (`area.item`); placeholders use `{name}`.
 */
export const en = {
  "app.name": "Webforge",
  "app.version": "Version {version}",

  "editor.canvas": "Page",
  "editor.undo": "Undo",
  "editor.redo": "Redo",
  "editor.undoHistory": "Undo History",
  "editor.historyStart": "Opened page",

  // Undo step labels (D2): verb + item name.
  "history.added": "Added {item}",
  "history.moved": "Moved {item}",
  "history.deleted": "Deleted {item}",
  "history.duplicated": "Duplicated {item}",
  "history.editedText": "Edited {item} text",
  "history.changed": "Changed {item} {field}",
  "history.changedPage": "Changed page settings",
  "history.editedPage": "Edited page",

  "element.heading": "Heading",
  "element.text": "Text",
  "section.section": "Section",
  "field.text": "Text",
  "field.size": "Size",
  "field.content": "Content",
  "field.size.large": "Large",
  "field.size.medium": "Medium",
  "field.size.small": "Small",
  "starter.heading": "Welcome to our business",
  "starter.text": "Tell visitors what you do and why they will love it.",
} as const;
