/** Exporting the site to a folder or a ZIP file. */
export const exportSite = {
  "export.dialogTitle": "Choose a folder for your site",
  "export.zipDialogTitle": "Save your site as a ZIP file",
  "export.zipFileType": "ZIP file",
  // The export dialog (3.3).
  "export.dialog.title": "Export Site",
  "export.dialog.description":
    "Save your site as files you can open on this computer or upload to any web host.",
  "export.dialog.confirm": "Export…",
  "export.dialog.format": "Save as",
  "export.dialog.format.folder": "A folder",
  "export.dialog.format.zip": "A ZIP file",
  "export.dialog.format.help": "A ZIP file is a single file: easy to email, or to upload.",
  "export.dialog.minify": "Make the files smaller",
  "export.dialog.minify.help":
    "Leaves out spacing and comments. The files load a little faster but are harder to read.",
  "export.dialog.developerFiles": "Include developer files",
  "export.dialog.developerFiles.help":
    "Adds the stylesheet's source, the theme and a README in a developer folder, for a web developer.",
  // Before the export, while the site has no web address (X3).
  "export.webAddress.title": "Add your site's web address?",
  "export.webAddress.body":
    "It's used for search engines (sitemap) and link previews on social media.",
  "export.webAddress.add": "Add address",
  "export.webAddress.skip": "Export without it",
  "export.webAddress.dontAsk": "Don't ask again for this site",
  "export.working": "Exporting…",
  "export.progress.images": "Preparing image {done} of {total}",
  "export.progress.pages": "Building page {done} of {total}",
  "export.progress.styles": "Building the styles",
  "export.progress.fonts": "Adding the fonts",
  "export.progress.writing": "Saving the files",
  "export.cancel": "Cancel",
  "export.cancelling": "Cancelling…",
  // The export report (07).
  "export.report.title": "Site exported",
  "export.report.folder": "Saved in the folder “{name}”.",
  "export.report.zip": "Saved as “{name}”.",
  "export.report.summary": "Pages: {pages} · Files: {files} · Size: {size}",
  "export.report.allGood": "Every link and image is in place.",
  "export.report.issues": "Worth a look",
  "export.report.brokenLink": "On “{page}”, a link goes to a page or file that isn't there.",
  "export.report.missingImage": "On “{page}”, an image deleted from Media was left out.",
  "export.report.formUnset":
    "On “{page}”, a form has nowhere to send its messages. Choose a form service in Site Settings, or give the Newsletter its form address.",
  "export.report.missingIcon":
    "The site icon was deleted from Media, so pages have no icon in the browser tab. Choose another in Site Settings.",
  "export.report.smallIcon":
    "The site icon is smaller than 16 pixels, so pages have no icon in the browser tab. Choose a larger image in Site Settings.",
  "export.report.notMinified":
    "“{page}” wasn't made smaller: its Custom Code isn't valid HTML. It was saved as it is.",
  "export.report.more": "And {count} more.",
  "export.report.noWebAddress":
    "Your site has no web address, so search engines get no sitemap and link previews may show no image. You can add it in Site Settings.",
  "export.report.openFolder": "Open Site",
  "export.report.showZip": "Show ZIP File",
  "export.report.done": "Done",
  "export.report.missing":
    "The exported site isn't there any more: it was moved or deleted. Export it again to open it.",
  "export.failed.folderNotEmpty":
    "That folder already contains other files. Choose an empty folder or a previous export.",
  "export.failed.buildFailed": "Your site could not be built. Nothing was changed on disk.",
  "export.failed.writeFailed": "Your site could not be saved there.",
  "export.failed.tooLarge": "Your site is too large for a ZIP file. Export it to a folder instead.",
  "export.failed.reservedName":
    "The page “{page}” can't be exported: Windows keeps its name, or its folder's, for itself. Rename it in the Pages panel and export again.",
} as const;
