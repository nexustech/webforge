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
  // A value set for one device only (F-ED-4): "Changed Section padding on Mobile".
  "history.changedOn": "Changed {item} {field} on {device}",
  // The device's own value dropped, so it uses Desktop's again.
  "history.resetOn": "Reset {item} {field} on {device}",
  "history.changedPage": "Changed page settings",
  // The Advanced tab's fields, as {field} names them: "Changed Heading CSS classes".
  "history.field.className": "CSS classes",
  "history.field.anchorId": "anchor ID",
  "history.field.attributes": "attributes",
  "history.editedPage": "Edited page",
  // An element of the shared Header or Footer, used as {item} above (F-ED-7).
  "history.sharedItem": "shared {item}",
  // An edit inside a linked copy of a shared section (1.29, F-ED-23).
  "history.editedSharedSection": "Edited shared section {name}",
  "history.addedSharedCopy": "Added a copy of {name}",
  "history.savedSharedSection": "Saved {name} as a shared section",
  "history.detachedSharedSection": "Detached {name}",
  // An element the user named in Layers, used as {item} above.
  "history.namedItem": "'{name}'",
} as const;
