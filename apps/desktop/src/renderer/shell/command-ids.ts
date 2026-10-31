/**
 * Ids of the commands the shell itself refers to (title-bar buttons, the command box, About).
 * The area that implements a command registers it under its id here; the title bar finds it by
 * the same constant, so a rename can't silently disconnect a button.
 */
export const COMMAND_IDS = {
  newSite: "site.new",
  quickStart: "site.quickStart",
  openSite: "site.open",
  // File › Open Recent (3.18): its sites are `site.openRecent.<id>`, then Clear Recent.
  openRecent: "site.openRecent",
  clearRecent: "site.clearRecent",
  noRecent: "site.noRecent",
  // A site's ZIP (4.7): a copy of the open site saved as one, and a site opened from one.
  saveSiteZip: "site.saveZip",
  openSiteZip: "site.openZip",
  undo: "edit.undo",
  redo: "edit.redo",
  preview: "site.preview",
  previewOnPhone: "site.previewOnPhone",
  stopPhonePreview: "site.stopPhonePreview",
  exportSite: "site.export",
  siteSettings: "site.settings",
  pageSettings: "page.settings",
  customCode: "site.customCode",
  settings: "app.settings",
  publish: "site.publish",
  saveVersion: "site.saveVersion",
  pasteLinked: "edit.pasteLinked",
  // Style this ‹kind›… (3.13a): the Style tab's button, the quick actions and the element menu.
  styleThis: "edit.styleThis",
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
  tryExample: "help.tryExample",
  about: "help.about",
} as const;
