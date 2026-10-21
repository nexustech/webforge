/** The window shell: title bar, menus and commands (stream A). */
export const shell = {
  "editor.undo": "Undo",
  "editor.redo": "Redo",
  "ui.close": "Close",

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
  "shell.commandBox.placeholder": "Type a command",
  "shell.commandBox.empty": "No matching commands",
  "shell.commandBox.title": "Commands",
  "shell.commandBox.description": "Search for a command and press Enter to run it.",

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

  // Design | Content (M3): Design changes the layout, Content edits text and images only.
  "shell.mode": "Editing mode",
  "shell.mode.design": "Design",
  "shell.mode.content": "Content",
} as const;
