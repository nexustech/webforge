/**
 * Ids of the commands the shell itself refers to (title-bar buttons, the command box, About).
 * The area that implements a command registers it under its id here; the title bar finds it by
 * the same constant, so a rename can't silently disconnect a button.
 */
export declare const COMMAND_IDS: {
  readonly newSite: "site.new";
  readonly quickStart: "site.quickStart";
  readonly openSite: "site.open";
  readonly openRecent: "site.openRecent";
  readonly clearRecent: "site.clearRecent";
  readonly noRecent: "site.noRecent";
  readonly saveSiteZip: "site.saveZip";
  readonly openSiteZip: "site.openZip";
  readonly closeSite: "site.close";
  readonly undo: "edit.undo";
  readonly redo: "edit.redo";
  readonly preview: "site.preview";
  readonly previewOnPhone: "site.previewOnPhone";
  readonly stopPhonePreview: "site.stopPhonePreview";
  readonly exportSite: "site.export";
  readonly siteCheck: "site.check";
  readonly versionHistory: "site.versionHistory";
  readonly undoHistory: "view.undoHistory";
  readonly siteSettings: "site.settings";
  readonly pageSettings: "page.settings";
  readonly customCode: "site.customCode";
  readonly stylesheet: "site.stylesheet";
  readonly settings: "app.settings";
  readonly aiApps: "app.aiApps";
  readonly publish: "site.publish";
  readonly saveVersion: "site.saveVersion";
  readonly pasteLinked: "edit.pasteLinked";
  readonly findReplace: "edit.findReplace";
  readonly styleThis: "edit.styleThis";
  readonly note: "edit.note";
  readonly resolveNote: "edit.resolveNote";
  readonly commandBox: "view.commandBox";
  readonly nextRegion: "view.nextRegion";
  readonly previousRegion: "view.previousRegion";
  readonly zoomIn: "view.zoomIn";
  readonly zoomOut: "view.zoomOut";
  readonly zoomActual: "view.zoomActual";
  readonly zoomFit: "view.zoomFit";
  /** The whole interface's zoom, not the canvas's: every window of the app. */
  readonly interfaceZoomIn: "view.interfaceZoomIn";
  readonly interfaceZoomOut: "view.interfaceZoomOut";
  readonly interfaceZoomReset: "view.interfaceZoomReset";
  /** The canvas's View options with a key (#857): its outlines and its element names. */
  readonly showOutlines: "view.showOutlines";
  readonly elementNames: "view.elementNames";
  readonly desktopView: "view.desktop";
  readonly tabletView: "view.tablet";
  readonly mobileView: "view.mobile";
  readonly toggleLeftPanels: "view.toggleLeftPanels";
  readonly toggleRightPanels: "view.toggleRightPanels";
  readonly toggleDrawer: "view.toggleDrawer";
  readonly resetPanels: "view.resetPanels";
  readonly theme: "view.theme";
  readonly editorMode: "view.editorMode";
  readonly editorLevel: "view.editorLevel";
  readonly help: "help.open";
  readonly helpForElement: "help.forElement";
  readonly tour: "help.tour";
  readonly assistantExamples: "help.assistantExamples";
  readonly shortcuts: "help.shortcuts";
  readonly tryExample: "help.tryExample";
  readonly licences: "help.licences";
  readonly reportProblem: "help.reportProblem";
  readonly diagnostics: "help.diagnostics";
  readonly about: "help.about";
};
//# sourceMappingURL=command-ids.d.ts.map
