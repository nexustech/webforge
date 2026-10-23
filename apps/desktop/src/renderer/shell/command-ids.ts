/**
 * Ids of the commands the shell itself refers to (title-bar buttons, the command box, About).
 * The area that implements a command registers it under its id here; the title bar finds it by
 * the same constant, so a rename can't silently disconnect a button.
 */
export const COMMAND_IDS = {
  newSite: "site.new",
  openSite: "site.open",
  undo: "edit.undo",
  redo: "edit.redo",
  preview: "site.preview",
  exportSite: "site.export",
  siteSettings: "site.settings",
  publish: "site.publish",
  saveVersion: "site.saveVersion",
  pasteLinked: "edit.pasteLinked",
  toggleGroups: "edit.toggleGroups",
  resetOption: "edit.resetOption",
  commandBox: "view.commandBox",
  zoomIn: "view.zoomIn",
  zoomOut: "view.zoomOut",
  zoomActual: "view.zoomActual",
  zoomFit: "view.zoomFit",
  desktopView: "view.desktop",
  tabletView: "view.tablet",
  mobileView: "view.mobile",
  toggleLeftPanels: "view.toggleLeftPanels",
  toggleRightPanels: "view.toggleRightPanels",
  toggleDrawer: "view.toggleDrawer",
  resetPanels: "view.resetPanels",
  theme: "view.theme",
  editorMode: "view.editorMode",
  editorLevel: "view.editorLevel",
  shortcuts: "help.shortcuts",
  about: "help.about",
} as const;
