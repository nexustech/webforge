/** The window shell: title bar, menus and commands (stream A). */
export const shell = {
  "editor.undo": "Undo",
  "editor.redo": "Redo",
  // The arrow beside Undo (UX-16).
  "shell.undoSteps": "Undo several steps",
  "shell.undoSteps.title": "Undo back to…",
  "shell.undoSteps.hint": "Undoes the step you choose and every later one.",
  "shell.undoSteps.one": "Undoes this step",
  "shell.undoSteps.many": "Undoes {count} steps",
  "ui.close": "Close",
  // A form dialog's button that closes it without saving (2.21).
  "ui.form.cancel": "Cancel",
  "ui.form.fixErrors": "Some values need fixing before they can be saved.",
  // What a form says is wrong with a value, unless its schema says it its own way (2.21).
  "form.error.empty": "Fill this in.",
  "form.error.tooShort": "Use at least {min} characters.",
  "form.error.tooLong": "Use at most {max} characters.",
  "form.error.atLeast": "Use {min} or more.",
  "form.error.atMost": "Use {max} or less.",
  "form.error.number": "Use a whole number.",
  "form.error.email": "Use an email address, such as name@example.com.",
  "form.error.url": "Use a web address that starts with https://.",
  // The picker dialog for images, icons and fonts (UX-15).
  "ui.picker.search": "Search",
  "ui.picker.categories": "Categories",
  "ui.picker.all": "All",
  "ui.picker.noMatch": "Nothing matches '{query}'.",
  // A count: plural("ui.picker.match", n) picks one or other (B10).
  "ui.picker.match.one": "{count} match",
  "ui.picker.match.other": "{count} matches",
  // Under a picker that draws only its first matches (icons).
  "ui.picker.more.one": "{count} more isn't shown. Search to find it.",
  "ui.picker.more.other": "{count} more aren't shown. Search to find them.",
  "ui.picker.choose": "Choose",
  "ui.picker.cancel": "Cancel",

  // App menu (title bar).
  "shell.menu": "App menu",
  "shell.menu.file": "File",
  "shell.menu.edit": "Edit",
  "shell.menu.view": "View",
  "shell.menu.help": "Help",

  // Title-bar buttons: short labels; the command's full label is in its tooltip.
  "shell.new": "New",
  "shell.open": "Open",
  "shell.preview": "Preview",
  // The preview server's answers in the browser (3.2): a page it doesn't have, and one asked for
  // before the first build was ready.
  "preview.notFound":
    "This page isn't in the preview. Go back to the home page, or open Preview again from Webforge.",
  "preview.notReady": "The preview isn't ready yet. Reload this page in a moment.",
  // Preview and Preview on Phone (3.2, F-PV-1).
  "preview.failed": "Webforge couldn't open the preview. Try again in a moment.",
  "preview.phone.title": "Preview on your phone",
  "preview.phone.description":
    "Point your phone's camera at this code. Your phone needs to be on the same Wi-Fi as this computer.",
  "preview.phone.starting": "Starting the preview…",
  "preview.phone.qrLabel": "QR code of the preview's address",
  "preview.phone.address": "Or type this address in your phone's browser:",
  "preview.phone.privacy":
    "Anyone on this Wi-Fi who has this address can see the preview while Webforge is open.",
  "preview.phone.offline":
    "A phone can open the preview only on a home or office network. Connect this computer to your Wi-Fi and try again.",
  // The title bar's cue while a phone can open the preview, with a button that stops it (3.2).
  "preview.phone.on": "Phone preview on",
  "preview.phone.onDescription":
    "Anyone on this Wi-Fi who has the address can see the preview. Stop it when you're done.",
  "preview.phone.failed":
    "Webforge couldn't start the preview for your phone. Try again in a moment.",
  "shell.export": "Export",
  "shell.publish": "Publish",
  "shell.actions": "Site actions",
  // A title-bar button's caret (LF-13), named by the button: "More Export options".
  "shell.moreOptions": "More {name} options",

  // Settings (LF-12): one dialog for the app and the open site.
  "settings.command": "Settings…",
  "settings.title": "Settings",
  "settings.description": "How Webforge works for you, and the open site's details.",
  "settings.save": "Save",
  "settings.sections": "Settings sections",
  "settings.heading.app": "App",
  "settings.heading.site": "This site",
  "settings.interface": "Interface",
  // The editor's own look, never the site's Theme (#452, glossary: Appearance).
  "settings.interface.appearance": "Appearance",
  "settings.interface.dark": "Dark",
  "settings.interface.light": "Light",
  "settings.interface.level": "Editing",
  "settings.interface.simple": "Simple mode",
  "settings.interface.advanced": "Advanced mode",
  "settings.interface.levelHelp":
    "Advanced mode adds the Edit panel's Advanced tab and Custom Code.",
  "settings.devices": "Devices",
  "settings.devices.label": "Your devices",
  "settings.devices.item": "Device",
  "settings.devices.add": "Add a device",
  "settings.devices.remove": "Remove this device",

  // Command box.
  "shell.commandBox.open": "Search commands",
  "shell.commandBox.placeholder": "Type a command, a page or something to add",
  "shell.commandBox.empty": "No matching commands",
  "shell.commandBox.title": "Commands",
  "shell.commandBox.description":
    "Search for a command, a page to go to or something to add, and press Enter.",
  // The palette's groups (1.34, F-ED-26).
  "shell.commandBox.commands": "Commands",
  "shell.commandBox.pages": "Go to page",
  "shell.commandBox.add": "Add",

  // Commands (menus and the command box).
  "command.newSite": "New Site…",
  "command.openSite": "Open Site…",
  "command.exportSite": "Export Site…",
  "command.preview": "Preview",
  "command.previewOnPhone": "Preview on Phone…",
  "command.stopPhonePreview": "Stop Phone Preview",
  "command.publish": "Publish…",
  "command.commandBox": "Search Commands…",
  "command.about": "About Webforge",
  "command.toggleLeftPanels": "Show or Hide Left Panels",
  "command.toggleRightPanels": "Show or Hide Right Panels",
  "command.toggleDrawer": "Show or Hide Bottom Panel",
  "command.resetPanels": "Reset Panels",
  "command.lightAppearance": "Use Light Appearance",
  "command.darkAppearance": "Use Dark Appearance",
  "command.designMode": "Switch to Design Mode",
  "command.contentMode": "Switch to Content Mode",
  "command.advancedMode": "Use Advanced Mode",
  "command.simpleMode": "Use Simple Mode",
  "command.zoomIn": "Zoom In",
  "command.zoomOut": "Zoom Out",
  "command.zoomActual": "Actual Size",
  "command.zoomFit": "Zoom to Fit",
  "command.desktopView": "Desktop View",
  "command.tabletView": "Tablet View",
  "command.mobileView": "Mobile View",
  "command.shortcuts": "Keyboard Shortcuts",
  "command.tryExample": "Try an Example",

  // Key names as Windows and Linux show them (macOS shows symbols: ⌘ ⌥ ⇧ ⌫).
  "keys.ctrl": "Ctrl",
  "keys.alt": "Alt",
  "keys.shift": "Shift",
  "keys.backspace": "Backspace",
  "keys.delete": "Delete",
  "keys.enter": "Enter",
  "keys.escape": "Esc",
  "keys.space": "Space",
  "keys.or": "or",

  // The Keyboard shortcuts sheet (F-ED-27): Help menu and `?`.
  "shortcuts.title": "Keyboard Shortcuts",
  "shortcuts.description": "Keys for the things you do most. Menus show them too.",
  "shortcuts.group.site": "Site",
  "shortcuts.group.edit": "Editing",
  "shortcuts.group.select": "Selecting",
  "shortcuts.group.view": "View",
  "shortcuts.group.text": "While editing text",
  "shortcuts.group.layers": "In Layers",
  "shortcuts.group.editPanel": "In the Edit panel",
  "shortcuts.saveNow": "Save now",
  "shortcuts.cancelDrag": "Cancel a drag",
  "shortcuts.bold": "Bold",
  "shortcuts.italic": "Italic",
  "shortcuts.underline": "Underline",
  "shortcuts.newLine": "New line",
  "shortcuts.link": "Link",
  "shortcuts.splitText": "Split into two elements",
  "shortcuts.nonBreakingSpace": "Non-breaking space",
  "shortcuts.layersFocus": "Previous or next layer",
  "shortcuts.layersOpen": "Open or close a layer",
  "shortcuts.layersParent": "Select the parent",
  "shortcuts.layersChild": "Select the first child",
  "shortcuts.layersSibling": "Select the previous or next sibling",
  "shortcuts.layersMove": "Move up or down",
  "shortcuts.layersCopy": "Copy: hold while dragging",
  "shortcuts.layersLinkedCopy":
    "Place a linked copy of a shared section: hold while dragging, adding Shift once it moves",
  "shortcuts.layersRename": "Rename",
  "shortcuts.layersDelete": "Delete",
  "shortcuts.toggleGroups": "Open or close all option groups",
  "shortcuts.resetOption": "Reset an option or group to its default",

  // The text context menu: spelling (F-ED-19) and editing.
  "spellcheck.noSuggestions": "No Suggestions",
  "spellcheck.addToDictionary": "Add to Dictionary",
  "edit.cut": "Cut",
  "edit.copy": "Copy",
  "edit.paste": "Paste",
  "edit.pasteLinked": "Paste as Linked Copy",
  "edit.copyStyle": "Copy Style",
  "edit.pasteStyle": "Paste Style",
  "edit.pasteStyleOnto": "Paste Style (onto a {item})",
  // Gives every other one of the selected kind its look (2.27, ST-4); "any" while none is selected.
  "edit.applyLook.page": "Apply Look to Every {item} on This Page",
  "edit.applyLook.page.any": "Apply Look to All Like It on This Page",
  "edit.applyLook.site": "Apply Look to Every {item} on the Site",
  "edit.applyLook.site.any": "Apply Look to All Like It on the Site",
  "edit.selectAll": "Select All",

  // The canvas toolbar (F-ED-8): the page shown, the device view and the canvas width.
  "canvasToolbar.label": "Canvas",
  "canvasToolbar.page": "Page shown",
  "canvasToolbar.device": "Device view",
  "canvasToolbar.width": "Canvas width in pixels",
  "canvasToolbar.px": "px",
  "canvasToolbar.zoom": "Zoom",
  "canvasToolbar.zoomFit": "Fit",
  "canvasToolbar.zoomFitAt": "Fit ({zoom}%)",
  "canvasToolbar.zoomLevel": "{zoom}%",
  "canvasToolbar.size": "{width} × {height} @ {zoom}%",
  // The canvas's View menu and devices (1.33, F-ED-25): view state, never an undo step.
  "canvasToolbar.view": "View",
  "canvasToolbar.view.outlines": "Show outlines",
  "canvasToolbar.view.spacing": "Show spacing on hover",
  "canvasToolbar.view.names": "Show element names",
  "canvasToolbar.view.extraSpace": "Extra space at the bottom",
  "canvasToolbar.devices": "Devices",
  "canvasToolbar.rotate": "Rotate",
  // The selected element's toolbar, in the row under the canvas toolbar (SP-4): a Heading's level.
  "elementToolbar.label": "Selected element",
  "headingToolbar.level": "Heading level",
  "headingToolbar.title": "Title",
  "headingToolbar.heading": "Heading",
  "headingToolbar.subheading": "Subheading",
  "listToolbar.addItem": "Add item",
  "listToolbar.before": "Before",
  "listToolbar.after": "After",
  "listToolbar.end": "At the end",
  "listToolbar.beforeName": "Add item before",
  "listToolbar.afterName": "Add item after",
  "listToolbar.endName": "Add item at the end",
  // The selected Header's toolbar in the Mobile view (UX-26): shows its menu open on the canvas only.
  "headerToolbar.label": "Header preview",
  "headerToolbar.showMobileMenu": "Show mobile menu",
  // The selected Columns' toolbar (2.17): its columns, its layout on the device shown, and outlines.
  "columnsToolbar.columns": "Columns",
  "columnsToolbar.addColumn": "Add column",
  "columnsToolbar.removeColumn": "Remove last column",
  // {device} is a device view: "Column widths on Mobile", as the Edit panel calls the field.
  "columnsToolbar.layoutOn": "Column widths on {device}",
  "columnsToolbar.previewLabel": "Columns preview",
  "columnsToolbar.showOutlines": "Show column outlines",
  // The canvas frame's edges, dragged to set its width (1.33, F-ED-25).
  "canvasResize.left": "Canvas width, left edge",
  "canvasResize.right": "Canvas width, right edge",
  "canvasResize.readout": "{width} px",
  "canvasResize.readoutDevice": "{width} px · {device}",
  "canvasToolbar.sizeButton": "Page size {size}: choose a device",
  "canvasToolbar.deviceSize": "{name} ({width} × {height})",
  "canvasToolbar.deviceWidth": "{name} ({width})",
  // Desktop fills the canvas, as a site fills a browser (PH2-18); fixed widths follow it.
  "canvasToolbar.desktopFills": "Desktop (fills the canvas)",
  "canvasToolbar.addDevice": "Add device…",
  "canvasToolbar.addDevice.title": "Add a device",
  "canvasToolbar.addDevice.description":
    "Its width and height show in the device list, for you only, on every site.",
  "canvasToolbar.addDevice.name": "Name",
  "canvasToolbar.addDevice.width": "Width in pixels",
  "canvasToolbar.addDevice.height": "Height in pixels",
  "canvasToolbar.addDevice.range": "Between {min} and {max} pixels.",
  "canvasToolbar.addDevice.confirm": "Add Device",

  // Design | Content (M3): Design changes the layout, Content edits text and images only.
  "shell.mode": "Editing mode",
  "shell.mode.design": "Design",
  "shell.mode.content": "Content",
  // Site-wide confirmations (D7, F-ED-14): actions that change more than the page shown.
  "confirm.siteWide.affectsOne": "This changes 1 page. You can undo it afterwards.",
  "confirm.siteWide.affectsMany": "This changes {count} pages. You can undo it afterwards.",
  "confirm.siteWide.cancel": "Cancel",
} as const;
