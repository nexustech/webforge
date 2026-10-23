/** The window shell: title bar, menus and commands (stream A). */
export const shell = {
  "editor.undo": "Undo",
  "editor.redo": "Redo",
  // The arrow beside Undo (UX-16).
  "shell.undoSteps": "Undo several steps",
  "shell.undoSteps.title": "Undo back to…",
  "shell.undoSteps.hint": "Undoes the step you choose and every later one.",
  "shell.undoSteps.one": "Undo this step",
  "shell.undoSteps.many": "Undoes {count} steps",
  "ui.close": "Close",
  // The picker dialog for images, icons and fonts (UX-15).
  "ui.picker.search": "Search",
  "ui.picker.categories": "Categories",
  "ui.picker.all": "All",
  "ui.picker.noMatch": "Nothing matches '{query}'.",
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
  "shell.export": "Export",
  "shell.publish": "Publish",
  "shell.actions": "Site actions",

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
  "command.publish": "Publish…",
  "command.commandBox": "Search Commands…",
  "command.about": "About Webforge",
  "command.toggleLeftPanels": "Show or Hide Left Panels",
  "command.toggleRightPanels": "Show or Hide Right Panels",
  "command.toggleDrawer": "Show or Hide Bottom Panel",
  "command.resetPanels": "Reset Panels",
  "command.lightTheme": "Use Light Theme",
  "command.darkTheme": "Use Dark Theme",
  "command.designMode": "Switch to Design Mode",
  "command.contentMode": "Switch to Content Mode",
  "command.advancedMode": "Use Advanced Mode",
  "command.simpleMode": "Use Simple Mode",

  // The text context menu: spelling (F-ED-19) and editing.
  "spellcheck.noSuggestions": "No Suggestions",
  "spellcheck.addToDictionary": "Add to Dictionary",
  "edit.cut": "Cut",
  "edit.copy": "Copy",
  "edit.paste": "Paste",
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
  // The canvas frame's edges, dragged to set its width (1.33, F-ED-25).
  "canvasResize.left": "Canvas width, left edge",
  "canvasResize.right": "Canvas width, right edge",
  "canvasResize.readout": "{width} px",
  "canvasResize.readoutDevice": "{width} px · {device}",
  "canvasToolbar.sizeButton": "Page size {size}: choose a device",
  "canvasToolbar.deviceSize": "{name} ({width} × {height})",
  "canvasToolbar.deviceWidth": "{name} ({width})",
  "canvasToolbar.addDevice": "Add device…",
  "canvasToolbar.addDevice.title": "Add a device",
  "canvasToolbar.addDevice.description":
    "Its width and height show in the device list, for you only, on every site.",
  "canvasToolbar.addDevice.name": "Name",
  "canvasToolbar.addDevice.width": "Width in pixels",
  "canvasToolbar.addDevice.height": "Height in pixels",
  "canvasToolbar.addDevice.range": "Between {min} and {max} pixels.",
  "canvasToolbar.addDevice.confirm": "Add Device",
  "canvasToolbar.addDevice.cancel": "Cancel",

  // Design | Content (M3): Design changes the layout, Content edits text and images only.
  "shell.mode": "Editing mode",
  "shell.mode.design": "Design",
  "shell.mode.content": "Content",
  // Site-wide confirmations (D7, F-ED-14): actions that change more than the page shown.
  "confirm.siteWide.affectsOne": "This changes 1 page. You can undo it afterwards.",
  "confirm.siteWide.affectsMany": "This changes {count} pages. You can undo it afterwards.",
  "confirm.siteWide.cancel": "Cancel",
} as const;
