/** The window shell: title bar, menus and commands (stream A). */
export const shell = {
  "editor.undo": "Undo",
  "editor.redo": "Redo",
  // Why a command is disabled (#1010): under it in menus and the command box, in its tooltip.
  "editor.undo.none": "Nothing to undo.",
  "editor.redo.none": "Nothing to redo.",
  // Their title-bar buttons' tooltips, naming the step (#1011): "Undo Edited Heading text".
  "editor.undo.step": "Undo {step}",
  "editor.redo.step": "Redo {step}",
  // Content mode's lock (M3) on a command that changes the layout.
  "shell.disabled.layoutLocked": "Switch to Design mode to change the layout.",
  // A control that acts on the selected element, with nothing selected.
  "shell.disabled.noSelection": "Select an element first.",
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
  // A form's fields most people can leave as they are, folded under a button (#1172).
  "ui.form.moreOptions": "More Options",
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
  // Webforge's own colour picker (5.26, OL-19).
  "ui.colourPicker.label": "Colour picker",
  "ui.colourPicker.area": "Saturation and brightness",
  "ui.colourPicker.areaValue": "Saturation {saturation}%, brightness {brightness}%",
  "ui.colourPicker.hue": "Hue",
  "ui.colourPicker.hueValue": "{degrees} degrees",
  "ui.colourPicker.hex": "Hex code",
  "ui.colourPicker.hexRefused": "A hex code is 6 digits and letters from a to f, such as #1a7f5a",
  "ui.colourPicker.pick": "Pick a Colour from the Screen",
  "ui.colourPicker.used": "Colours on this site",
  // Makes the colour shown one of the person's colours (TC-3, #1221).
  "ui.colourPicker.addToColours": "Add to Your Colours…",
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
  // Edit's submenus (#1016), their items named without the submenu's own word.
  "shell.menu.edit.style": "Style",
  "shell.menu.edit.select": "Select",
  "shell.menu.edit.sharedSection": "Shared Section",
  "shell.menu.edit.sharedSection.rename": "Rename…",
  "shell.menu.edit.sharedSection.delete": "Delete…",
  "shell.menu.edit.sharedSection.detach": "Detach",
  "shell.menu.view": "View",
  // The site's settings, theme and stylesheet (#1016).
  "shell.menu.site": "Site",
  "shell.menu.help": "Help",
  // The panel buttons as one menu, while the title bar is narrow (#1195).
  "shell.panelsMenu": "Show or hide panels",
  "shell.panelsMenu.left": "Left Panels",
  "shell.panelsMenu.bottom": "Bottom Panel",
  "shell.panelsMenu.right": "Right Panels",
  // The menus' titles folded into one button, while the title bar is narrow (#1166).
  "shell.menu.folded": "Menu",
  "shell.menu.folded.tooltip": "File, Edit, View, Site and Help",

  // Title-bar buttons: short labels; the command's full label is in its tooltip.
  "shell.preview": "Preview",
  // The preview server's answers in the browser (3.2): a page it doesn't have, and one asked for
  // before the first build was ready.
  "preview.notFound":
    "This page isn't in the preview. Go back to the home page, or open Preview again from {appName}.",
  "preview.notReady": "The preview isn't ready yet. Reload this page in a moment.",
  // Preview and Preview on Phone (3.2, F-PV-1).
  "preview.opened": "Opened in your browser",
  "preview.failed": "{appName} couldn't open the preview. Try again in a moment.",
  // Save Page as Image… and Save Page as PDF… (5.22, OL-9).
  "preview.save.imageTitle": "Save Page as Image",
  "preview.save.pdfTitle": "Save Page as PDF",
  "preview.save.imageType": "PNG image",
  "preview.save.pdfType": "PDF document",
  "preview.save.untitled": "Page",
  "preview.save.saved": "Saved {name}",
  "preview.save.savedDescription": "The page as Preview shows it, {width} pixels wide.",
  "preview.save.cut":
    "The page is longer than one picture can hold, so it stops short of the end. Save it as a PDF to have all of it.",
  "preview.save.drawFailed": "{appName} couldn't draw the page. Try again in a moment.",
  "preview.save.notAllowed": "{appName} isn't allowed to save there. Choose another folder.",
  "preview.save.diskFull": "There isn't enough space on the disk to save the page.",
  "preview.save.writeFailed": "{appName} couldn't save the file there. Try another folder.",
  "preview.phone.title": "Preview on Your Phone",
  "preview.phone.description":
    "Point your phone's camera at this code. Your phone needs to be on the same Wi-Fi as this computer.",
  "preview.phone.starting": "Starting the preview…",
  "preview.phone.qrLabel": "QR code of the preview's address",
  "preview.phone.address": "Or type this address in your phone's browser:",
  "preview.phone.privacy":
    "Anyone on this Wi-Fi who has this address can see the preview while {appName} is open.",
  "preview.phone.offline":
    "A phone can open the preview only on a home or office network. Connect this computer to your Wi-Fi and try again.",
  // The title bar's cue while a phone can open the preview, with a button that stops it (3.2).
  "preview.phone.on": "Phone preview on",
  "preview.phone.onDescription":
    "Anyone on this Wi-Fi who has the address can see the preview. Stop it when you're done.",
  // Main stopped the phone's preview by itself (S9): unused for 10 minutes, or off the Wi-Fi.
  "preview.phone.stopped":
    "Phone preview stopped: no phone used it for 10 minutes, or this computer left its Wi-Fi. Choose Preview on Phone again for a new address.",
  "preview.phone.failed":
    "{appName} couldn't start the preview for your phone. Try again in a moment.",
  "shell.export": "Export",
  "shell.publish": "Publish",
  "shell.actions": "Site actions",
  // A title-bar button's caret (LF-13), named by the button: "More Export options".
  "shell.moreOptions": "More {name} options",
  // A title-bar button that shows how things stand, named for a screen reader (#1009).
  "shell.withStatus": "{name}: {status}",

  // Settings (LF-12): one dialog for the app and the open site.
  "settings.command": "Settings…",
  "settings.title": "Settings",
  "settings.description": "How {appName} works for you, and the open site's details.",
  "settings.save": "Save",
  "settings.sections": "Settings sections",
  "settings.heading.app": "App",
  "settings.heading.site": "This site",
  "settings.interface": "Interface",
  // The editor's own look, never the site's Theme (#452, glossary: Appearance).
  // The editor's own look, not a site's theme (#1169): its name says so.
  "settings.interface.appearance": "{appName}'s appearance",
  "settings.interface.system": "Same as my computer",
  "settings.interface.dark": "Dark",
  "settings.interface.light": "Light",
  "settings.interface.level": "Editing",
  "settings.interface.simple": "Simple mode",
  "settings.interface.advanced": "Advanced mode",
  "settings.interface.levelHelp":
    "Advanced mode adds the Edit panel's Advanced tab and Custom Code.",
  // The interface zoom (View › Zoom In Interface), named for what people want from it (#1015).
  "settings.interface.textSize": "Text size",
  "settings.interface.textSizeHelp":
    "Makes all of {appName} bigger or smaller: its text, buttons and panels. Your website stays as it is.",
  "settings.interface.textSizeLevel": "{percent}%",
  "settings.interface.textSizeStandard": "{percent}% (standard)",
  "settings.devices": "Devices",
  "settings.devices.label": "Your devices",
  "settings.devices.item": "Device",
  "settings.devices.add": "Add a Device",
  "settings.devices.remove": "Remove this device",
  // Where updates come from (5.2): Stable, or Beta, which gets each new version first.
  "settings.updates": "Updates",
  "settings.updates.channel": "Get updates from",
  "settings.updates.stable": "Stable",
  "settings.updates.beta": "Beta",
  "settings.updates.channelHelp":
    "Beta gets each new version of {appName} first, before Stable, to try it out.",
  // A line that opens AI apps (#752), which act at once, so has its own dialog (F-AI-1).
  "settings.aiApps": "AI apps",
  "settings.aiApps.label": "AI apps on this computer",
  "settings.aiApps.help":
    "Let AI apps such as Claude work on your site. What you change there happens at once.",
  "settings.aiApps.open": "Open AI Apps…",

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
  "shell.commandBox.help": "Help",

  // Commands (menus and the command box).
  "command.newSite": "New Site…",
  "command.quickStart": "Start a Site…",
  "command.openSite": "Open Site…",
  // File › Open Recent (3.18): the latest sites, by name, with the folder when two share one.
  "command.openRecent": "Open Recent",
  "command.openRecent.inFolder": "{name} ({folder})",
  // A recent site in the command box, named by the menu it's in.
  "command.openRecent.palette": "Open Recent: {name}",
  "command.noRecent": "No Recent Sites",
  "command.clearRecent": "Clear Recent",
  // A copy of the whole site as a ZIP, and a site opened from one (4.7): not Export's website.
  "command.saveSiteZip": "Save a Copy as ZIP…",
  // File › Close Site (#1016): back to the start screen, the site saved.
  "command.closeSite": "Close Site",
  "command.openSiteZip": "Open Site from ZIP…",
  "command.exportSite": "Export Site…",
  "command.preview": "Preview",
  "command.previewOnPhone": "Preview on Phone…",
  "command.stopPhonePreview": "Stop Phone Preview",
  // A page as Preview draws it, saved as a picture or a PDF to show someone (5.22, OL-9).
  "command.savePageImage": "Save Page as Image…",
  "command.savePagePdf": "Save Page as PDF…",
  "command.publish": "Publish…",
  "command.commandBox": "Search Commands…",
  "command.nextRegion": "Next Part of the Window",
  "command.previousRegion": "Previous Part of the Window",
  "command.about": "About {appName}",
  // Help › Report a Problem (5.23, OL-10).
  "command.reportProblem": "Report a Problem…",
  // Help › Diagnostics… (5.41, BD-2).
  "command.diagnostics": "Diagnostics…",
  "command.licences": "Open-Source Licences",
  // Help → Open-Source Licences (5.3): every package the app ships, with its licence.
  "licences.title": "Open-Source Licences",
  "licences.description":
    "{appName} is made with the open-source software below, each used under its own licence. Open one to read its licence.",
  "licences.loading": "Finding the licences…",
  "licences.failed": "{appName} couldn't read its list of licences.",
  "licences.search": "Find a package or licence",
  "licences.count": "Showing {shown} of {total}",
  "licences.list": "Open-source software",
  "licences.noText": "This package is under the {licence} licence, but includes no copy of it.",
  "licences.chromium": "Chromium's Licences",
  "licences.chromiumFailed": "{appName} couldn't open Chromium's licences.",
  "licences.close": "Close",
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
  "command.interfaceZoomIn": "Zoom In Interface",
  "command.interfaceZoomOut": "Zoom Out Interface",
  "command.interfaceZoomReset": "Reset Interface Zoom",
  "command.showOutlines": "Show Outlines",
  "command.hideOutlines": "Hide Outlines",
  "command.showElementNames": "Show Element Names",
  "command.hideElementNames": "Hide Element Names",
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
  "shortcuts.layersLinkedCopy": "Place a linked copy of a shared section: hold while dragging",
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
  "edit.pasteStyleOnto": "Paste Style (onto Another {item})",
  "edit.pasteStyle.nothingCopied": "Copy a style first.",
  "edit.pasteStyle.selectKind": "Select another {item} to paste its style onto.",
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
  "canvasToolbar.view.outlines": "Show Outlines",
  "canvasToolbar.view.spacing": "Show Spacing on Hover",
  "canvasToolbar.view.names": "Show Element Names",
  "canvasToolbar.view.extraSpace": "Extra Space at the Bottom",
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
  "canvasToolbar.desktopFills": "Desktop (Fills the Canvas)",
  "canvasToolbar.addDevice": "Add Device…",
  "canvasToolbar.addDevice.title": "Add a Device",
  "canvasToolbar.addDevice.description":
    "Its width and height show in the device list, for you only, on every site.",
  "canvasToolbar.addDevice.name": "Name",
  "canvasToolbar.addDevice.width": "Width in pixels",
  "canvasToolbar.addDevice.height": "Height in pixels",
  "canvasToolbar.addDevice.range": "Between {min} and {max} pixels.",
  "canvasToolbar.addDevice.confirm": "Add Device",
  // The width box, from the View menu once the toolbar is too narrow for it (#1008).
  "canvasToolbar.widthItem": "Canvas Width…",
  "canvasToolbar.widthDialog.title": "Canvas Width",
  "canvasToolbar.widthDialog.description":
    "Shows the page at a width of your own, without adding a device.",
  "canvasToolbar.widthDialog.confirm": "Show Width",

  // Design | Content (M3): Design changes the layout, Content edits text and images only.
  "shell.mode": "Editing mode",
  "shell.mode.design": "Design",
  "shell.mode.content": "Content",
  // Site-wide confirmations (D7, F-ED-14): actions that change more than the page shown.
  "confirm.siteWide.affectsOne": "1 page of your site will change. You can undo it afterwards.",
  "confirm.siteWide.affectsMany":
    "{count} pages of your site will change. You can undo it afterwards.",
  "confirm.siteWide.cancel": "Cancel",
} as const;
