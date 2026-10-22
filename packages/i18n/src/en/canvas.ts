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
  // The rich-text toolbar's links (1.23, F-ED-3).
  "canvas.richText.link": "Link…",
  "canvas.richText.removeLink": "Remove link",
  // While an element of the shared Header or Footer is selected (1.20, F-ED-7, D7).
  "canvas.sharedRegion.header": "Header",
  "canvas.sharedRegion.footer": "Footer",
  // Asked before an element of the shared Header or Footer goes from every page (D7).
  "canvas.sharedDelete.title": "Delete {item} from the shared {region}?",
  "canvas.sharedCut.title": "Cut {item} from the shared {region}?",
  "canvas.sharedBanner.all": "Editing shared {region}: changes apply to all {count} pages",
  "canvas.sharedBanner.some": "Editing shared {region}: changes apply to {count} pages",
  "canvas.sharedBanner.one": "Editing shared {region}: changes apply to 1 page",
  // An element of a linked copy of a shared section selected (1.29, F-ED-23).
  "canvas.sharedSectionBanner.one":
    "Editing shared section {name}: changes apply to 1 copy on 1 page",
  "canvas.sharedSectionBanner.onePage":
    "Editing shared section {name}: changes apply to {copies} copies on 1 page",
  "canvas.sharedSectionBanner.pages":
    "Editing shared section {name}: changes apply to {copies} copies on {pages} pages",
  "canvas.saveSharedSection": "Save as shared section…",
  "canvas.detachSharedSection": "Detach from shared section",
  "canvas.saveSharedSection.title": "Save as shared section",
  "canvas.saveSharedSection.description":
    "A shared section is stored once. Place copies of it on any page; editing one copy changes them all.",
  "canvas.saveSharedSection.name": "Name",
  "canvas.saveSharedSection.confirm": "Save",

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
  // The Advanced tab (Advanced mode, F-ED-11): technical words are fine here, clearly labelled.
  "editPanel.advanced": "Advanced",
  "editPanel.advanced.className": "CSS classes",
  "editPanel.advanced.classNamePlaceholder": "e.g. shadow-lg rounded-box",
  "editPanel.advanced.classNameInvalid": "Use class names separated by spaces",
  "editPanel.advanced.anchorId": "Anchor ID",
  "editPanel.advanced.anchorIdPlaceholder": "e.g. opening-times",
  "editPanel.advanced.anchorIdInvalid":
    "Use lowercase letters, digits and single hyphens, starting with a letter",
  "editPanel.advanced.anchorIdTaken": "Another element on this page already uses this anchor",
  "editPanel.advanced.attributes": "Attributes",
  "editPanel.advanced.attribute": "Attribute",
  "editPanel.advanced.attributeName": "Name",
  "editPanel.advanced.attributeValue": "Value",
  "editPanel.advanced.attributeNameInvalid":
    "Use data-…, aria-…, role, title, lang, dir, translate or tabindex",
  "editPanel.advanced.attributeNameTaken": "This element already has this attribute",
  "editPanel.advanced.attributeValueTooLong": "Use at most 1000 characters",
  // A repeating list in the Edit panel (F-ED-6); {item} is what one item is called.
  "editPanel.list.add": "Add {item}",
  "editPanel.list.moveUp": "Move {item} up",
  "editPanel.list.moveDown": "Move {item} down",
  "editPanel.list.delete": "Delete {item}",
  "editPanel.list.untitled": "{item} {number}",
  "editPanel.list.empty": "Nothing in this list yet",
  // Device views of the canvas (glossary: Desktop · Tablet · Mobile).
  "device.desktop": "Desktop",
  "device.tablet": "Tablet",
  "device.mobile": "Mobile",
  // The site the editor opens with until the start screen creates sites (1.8).
  "starter.notFoundTitle": "Page not found",
} as const;
