/** The page canvas (stream C). */
export const canvas = {
  "editor.canvas": "Page",
  // The canvas ran into an error (R3): it shows this instead, and the panels keep working.
  "canvas.error.message": "Something went wrong showing this page. Your work is saved.",
  "canvas.error.reload": "Reload page",
  // Quick actions on the selected element (1.12).
  "canvas.moveUp": "Move up",
  "canvas.moveDown": "Move down",
  "canvas.duplicate": "Duplicate",
  "canvas.delete": "Delete",
  "canvas.selectPrevious": "Select previous element",
  "canvas.selectNext": "Select next element",
  // Keyboard navigation and the selection chip (1.30, F-ED-25, F-ED-27).
  "canvas.selectParent": "Select parent",
  "canvas.selectChild": "Select first element inside",
  "canvas.selectPreviousSibling": "Select previous sibling",
  "canvas.selectNextSibling": "Select next sibling",
  "canvas.editText": "Edit text",
  "canvas.clearText": "Clear text and edit",
  "canvas.edit": "Edit",
  // A hovered element's name chip with its size, while spacing on hover shows (SP-2).
  "canvas.chipSize": "{name} · {size}",
  "canvas.hide": "Hide",
  "canvas.show": "Show",
  "canvas.toggleHidden": "Hide or show",
  // The floating + between sections (1.12).
  "canvas.addSection": "Add a section here",
  "canvas.spacing.handle": "Drag to change the {field} ({side})",
  "canvas.spacing.readout": "{field} {side}: {size}",
  // The width handles on a selected Image's edges (2.17): their tooltip, and the readout while one
  // is dragged ("Width: Medium").
  "canvas.width.handle": "Drag to change the {field}",
  "canvas.width.readout": "{field}: {size}",
  // The rich-text toolbar's links (1.23, F-ED-3).
  "canvas.richText.link": "Link…",
  "canvas.richText.removeLink": "Remove link",
  // Alt + Enter in rich text (F-ED-27): the element splits in two at the caret.
  "canvas.splitText.notHere":
    "Only the page's own text can be split. The shared Header and Footer, and shared sections, are shown on other pages too.",
  "canvas.splitText.locked": "Splitting text adds an element. Switch to Design mode to split it.",
  // While an element of the shared Header or Footer is selected (1.20, F-ED-7, D7).
  // The breadcrumb bar under the canvas toolbar (1.30): the selected element's place on the page.
  "canvas.breadcrumbs": "Where the selection is",
  "canvas.breadcrumbs.page": "Page",
  // F2 on the canvas (1.30): asks for the selected element's name, as the element menu does.
  "canvas.rename": "Rename…",
  // Selects every element of the page like the selected one (1.35, the element menu).
  "canvas.selectSimilar": "Select similar",
  "canvas.sharedRegion.header": "Header",
  "canvas.sharedRegion.footer": "Footer",
  // Asked before an element of the shared Header or Footer goes from every page (D7).
  "canvas.sharedDelete.title": "Delete {item} from the shared {region}?",
  "canvas.sharedCut.title": "Cut {item} from the shared {region}?",
  // Asked before an element of a shared section goes from every copy of it (1.29, D7, F-ED-23).
  "canvas.sharedSectionDelete.title": "Delete {item} from the shared section {name}?",
  "canvas.sharedSectionCut.title": "Cut {item} from the shared section {name}?",
  "canvas.sharedSectionChange.one": "The section's 1 copy shows the change.",
  "canvas.sharedSectionChange.many": "All {copies} copies of the section show the change.",
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
  // Names are unique (1.29): {name} is quoted, "'Opening hours'".
  "canvas.sharedSectionNameTaken": "A shared section called {name} already exists",
  "canvas.renameSharedSection": "Rename shared section…",
  "canvas.renameSharedSection.title": "Rename shared section",
  "canvas.renameSharedSection.confirm": "Rename",
  "canvas.deleteSharedSection": "Delete shared section…",
  // D7's question before deleting a shared section: {name} is quoted.
  "canvas.deleteSharedSection.title": "Delete shared section {name}?",
  "canvas.deleteSharedSection.description":
    "Its copies stay on their pages as normal sections, so no content is lost.",
  "canvas.deleteSharedSection.confirm": "Delete Shared Section",

  // The Edit panel (1.14): the selected element's fields.
  "editPanel.title": "Edit",
  "editPanel.tabs": "Edit panel sections",
  "editPanel.content": "Content",
  "editPanel.style": "Style",
  "editPanel.empty": "Select an element to edit it",
  // While several elements are selected (1.31).
  "editPanel.several": "{count} elements selected",
  // Why several selected elements can't be changed at once (1.31).
  "bulk.shared":
    "Elements of the shared Header or Footer, or of a shared section, are changed one at a time.",
  "bulk.first": "{item} is already first: nothing moved.",
  "bulk.full": "There's no room for another there: a Columns holds at most four columns.",
  // A copy of something that already holds a Columns of five or more, from an old file (#384).
  "bulk.overfull":
    "What you're copying holds a Columns with more than four columns. Remove one first, then copy it.",
  "bulk.last": "{item} is already last: nothing moved.",
  "editPanel.noFields": "Nothing to change here",
  // The Edit panel's search field (UX-13): the fields whose name has the text are shown.
  "editPanel.search": "Search options",
  "editPanel.searchPlaceholder": "Search options",
  "editPanel.noMatches": "No options match your search.",
  // Back to the element's defaults (UX-13, UX-18): a field's right-click menu, and Ctrl/Cmd + Esc.
  "editPanel.resetField": "Reset to Default",
  "editPanel.resetGroup": "Reset Group to Defaults",
  // An option group's header, on hover (SP-7): "Copy Spacing", "Paste Spacing", "Reset Spacing".
  "editPanel.group.copy": "Copy {group}",
  "editPanel.group.paste": "Paste {group}",
  "editPanel.group.reset": "Reset {group}",
  // The Edit panel's groups (UX-13): Ctrl/Cmd + Enter on a group's title opens or closes them all.
  "editPanel.expandAll": "Expand All",
  "editPanel.collapseAll": "Collapse All",
  "editPanel.optionGroup.text": "Text",
  "editPanel.optionGroup.image": "Image",
  "editPanel.optionGroup.link": "Link",
  "editPanel.optionGroup.items": "Items",
  "editPanel.optionGroup.spacing": "Spacing",
  "editPanel.optionGroup.colours": "Colours",
  "editPanel.optionGroup.appearance": "Appearance",
  "editPanel.optionGroup.options": "Options",
  "editPanel.optionGroup.advanced": "Advanced",
  // Apply Look to Every… (2.27, ST-4), asked before it changes other pages (D7).
  "look.confirm.title.page": "Give every {item} on this page this look?",
  "look.confirm.title.site": "Give every {item} on the site this look?",
  "look.confirm.elements.one": "This gives 1 other {item} the same look.",
  "look.confirm.elements.other": "This gives {count} other {item} elements the same look.",
  "look.confirm.sections.one": "This gives 1 other {item} the same look.",
  "look.confirm.sections.other": "This gives {count} other {item} sections the same look.",
  "look.confirm.hidden.one": "1 of them is hidden in Layers.",
  "look.confirm.hidden.other": "{count} of them are hidden in Layers.",
  // On this page, a shared part it changes takes other pages with it.
  "look.confirm.reach.region": "The {region} is on other pages too.",
  "look.confirm.reach.shared": "Shared section {name} is on other pages too.",
  "look.confirm.apply": "Apply Look",
  "look.same.page": "Every {item} on this page has this look already.",
  "look.same.site": "Every {item} on the site has this look already.",
  // A value set for one device only (F-ED-4).
  // A field's per-device dot (UX-19): grey inherits Desktop's value, the accent colour has its own.
  "editPanel.dot.inherits": "{field}: same as Desktop on {device}",
  "editPanel.dot.set": "{field}: set for {device} only",
  "editPanel.dot.clear": "{field}: set for {device} only. Use the Desktop value instead",
  // A field that may differ per device (SP-5): its rows, one per device.
  "editPanel.devices.show": "{field} on each device",
  // After the device's name, for screen readers: "Tablet, its own value".
  "editPanel.devices.own": "its own value",
  "editPanel.devices.inEffect": "In effect on the device shown",
  "editPanel.box.default": "Default",
  "editPanel.box.same": "Same on every side",
  // The Advanced tab (Advanced mode, F-ED-11): technical words are fine here, clearly labelled.
  "editPanel.advanced": "Advanced",
  "editPanel.advanced.className": "CSS classes",
  "editPanel.advanced.classNamePlaceholder": "e.g. shadow-lg rounded-box",
  "editPanel.advanced.classNameInvalid": "Use class names separated by spaces",
  // The CSS classes field's suggestions, browser and warning (#276).
  "editPanel.classes.suggestions": "Suggested classes",
  "editPanel.classes.browse": "Browse classes…",
  "editPanel.classes.browseTitle": "Browse classes",
  "editPanel.classes.browseDescription":
    "Double-click a class, or press Enter, to add it to this element.",
  "editPanel.classes.none": "No class matches.",
  "editPanel.classes.previewLoading": "Getting its CSS…",
  "editPanel.classes.previewNone": "This class makes no style.",
  "editPanel.classes.unknown": "No style called {name}. Did you mean {suggestion}?",
  "editPanel.classes.unknownNoSuggestion":
    "No style called {name}: it does nothing unless your own code uses it.",
  "editPanel.classes.category.components": "daisyUI components",
  "editPanel.classes.category.colours": "Colours",
  "editPanel.classes.category.borders": "Borders and corners",
  "editPanel.classes.category.spacing": "Spacing",
  "editPanel.classes.category.size": "Size",
  "editPanel.classes.category.layout": "Layout",
  "editPanel.classes.category.typography": "Typography",
  "editPanel.classes.category.effects": "Effects",
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
