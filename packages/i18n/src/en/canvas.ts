/** The page canvas (stream C). */
export const canvas = {
  "editor.canvas": "Page",
  // Quick actions on the selected element (1.12).
  "canvas.moveUp": "Move up",
  "canvas.moveDown": "Move down",
  "canvas.duplicate": "Duplicate",
  "canvas.delete": "Delete",
  "canvas.selectPrevious": "Select previous element",
  "canvas.selectNext": "Select next element",
  // The floating + between sections (1.12).
  "canvas.addSection": "Add a section here",

  // The Edit panel (1.14): the selected element's fields.
  "editPanel.title": "Edit",
  "editPanel.tabs": "Edit panel sections",
  "editPanel.content": "Content",
  "editPanel.style": "Style",
  "editPanel.empty": "Select an element to edit it",
  "editPanel.noFields": "Nothing to change here",
  // A value set for one device only (F-ED-4).
  "editPanel.override": "{device} only",
  "editPanel.useDesktop": "Use Desktop value",
  "editPanel.device.desktop": "Desktop",
  "editPanel.device.tablet": "Tablet",
  "editPanel.device.mobile": "Mobile",
  // The site the editor opens with until the start screen creates sites (1.8).
  "starter.notFoundTitle": "Page not found",
} as const;
