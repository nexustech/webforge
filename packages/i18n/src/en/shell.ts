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
} as const;
