/** Exporting the site to a folder. */
export const exportSite = {
  "export.dialogTitle": "Choose a folder for your site",
  "export.working": "Exporting…",
  "export.done": "Site exported to “{folder}” ({files} files).",
  "export.failed.folderNotEmpty":
    "That folder already contains other files. Choose an empty folder or a previous export.",
  "export.failed.buildFailed": "Your site could not be built. Nothing was changed on disk.",
  "export.failed.writeFailed": "Your site could not be saved to that folder.",
  "export.failed.reservedName":
    "The page “{page}” can't be exported: Windows keeps its name, or its folder's, for itself. Rename it in the Pages panel and export again.",
} as const;
