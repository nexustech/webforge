/** Undo step labels (D2): verb + item name (stream C). */
export const history = {
  "history.added": "Added {item}",
  "history.moved": "Moved {item}",
  "history.deleted": "Deleted {item}",
  "history.duplicated": "Duplicated {item}",
  "history.splitText": "Split {item}",
  // Several selected elements at once (1.31).
  "history.deletedMany": "Deleted {count} elements",
  "history.duplicatedMany": "Duplicated {count} elements",
  "history.movedMany": "Moved {count} elements",
  "history.hidMany": "Hid {count} elements",
  "history.showedMany": "Showed {count} elements",
  "history.editedText": "Edited {item} text",
  // For components with several text fields: "Edited Hero button text".
  "history.editedField": "Edited {item} {field}",
  "history.changed": "Changed {item} {field}",
  "history.pastedStyle": "Pasted style on {item}",
  // An option group's values, copied from another element (SP-7): "Pasted Spacing on Heading".
  "history.pastedGroup": "Pasted {group} on {item}",
  // Apply Look to Every… (2.27, ST-4): "Applied the Button look to 12 others".
  "history.appliedLook.one": "Applied the {item} look to 1 other",
  "history.appliedLook.other": "Applied the {item} look to {count} others",
  // A value set for one device only (F-ED-4): "Changed Section padding on Mobile".
  "history.changedOn": "Changed {item} {field} on {device}",
  // The device's own value dropped, so it uses Desktop's again.
  "history.resetOn": "Reset {item} {field} on {device}",
  // Back to the component's default (UX-13): "Reset Heading size", "Reset Section spacing".
  "history.reset": "Reset {item} {field}",
  // An option group's changed fields (UX-13): "Reset Spacing on Heading".
  "history.resetGroup": "Reset {group} on {item}",
  // On Tablet or Mobile, the group's values for that device (F-ED-4): "Reset Section spacing on
  // Mobile".
  "history.resetGroupOn": "Reset {item} {group} on {device}",
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
  "history.renamedSharedSection": "Renamed {name} to {newName}",
  "history.deletedSharedSection": "Deleted shared section {name}",
  // An element the user named in Layers, used as {item} above.
  "history.namedItem": "'{name}'",
} as const;
