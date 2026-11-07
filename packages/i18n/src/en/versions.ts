/** Version History (F-SITE-4, 4.6; `apps/desktop/src/renderer/versions/`). */
export const versions = {
  "versionHistory.panelTitle": "Version History",
  "versionHistory.save": "Save Version…",
  "versionHistory.loading": "Finding this site's versions…",
  "versionHistory.loadFailed": "{appName} couldn't list this site's versions.",
  "versionHistory.empty":
    "No versions yet. Save one before a big change, and {appName} saves one each day you edit.",
  "versionHistory.space": "Versions use {size}",
  "versionHistory.list": "Versions",
  // Clean up (P3).
  "versionHistory.cleanUp": "Clean Up",
  "versionHistory.cleanUpHelp":
    "Removes what nothing in the site, its versions or Undo needs, and gives the space back to your disk.",
  "versionHistory.cleaningUp": "Cleaning up the site's file… Changes are saved once it's done.",
  "versionHistory.cleanedUp": "Cleaned up: {size} given back to your disk.",
  "versionHistory.nothingToCleanUp": "Cleaned up: there was nothing more to give back.",
  "versionHistory.cleanUpFailed": "{appName} couldn't clean up the site's file.",
  "versionHistory.actions": "More for “{name}”",
  "versionHistory.picture": "The site as it was then",
  // What a version Webforge saved is called, by why it was saved.
  "versionHistory.reason.manual": "Untitled version",
  "versionHistory.reason.daily": "Start of the day",
  "versionHistory.reason.beforeRestore": "Before a restore",
  "versionHistory.reason.beforeSiteWide": "Before a change to every page",
  "versionHistory.reason.onPublish": "Published",
  "versionHistory.automatic": "Saved by {appName}",
  "versionHistory.beforeAction": "Before: {action}",
  "versionHistory.beforeThemeChanges": "Before theme changes",
  // Save version (Ctrl/Cmd+Alt+S).
  "versionHistory.saveDialog.title": "Save Version",
  "versionHistory.saveDialog.description":
    "A copy of the whole site as it is now, which you can go back to at any time.",
  "versionHistory.saveDialog.name": "Version name",
  "versionHistory.saveDialog.confirm": "Save Version",
  "versionHistory.saved": "Saved version “{name}”.",
  "versionHistory.saveFailed": "{appName} couldn't save the version.",
  "versionHistory.readOnly":
    "This site was made with a newer {appName}, so versions can't be saved in it here.",
  // Restore.
  "versionHistory.restore": "Restore…",
  "versionHistory.restore.title": "Restore “{name}”?",
  "versionHistory.restore.description":
    "Every page goes back to how it was on {date}. {appName} saves a version of the site as it is now first, and you can undo the restore.",
  "versionHistory.restore.confirm": "Restore Version",
  "versionHistory.restored": "Restored “{name}”. Undo puts the site back as it was.",
  "versionHistory.history.restored": "Restored version “{name}”",
  "versionHistory.restore.gone": "That version is no longer in this site.",
  "versionHistory.restore.newer":
    "That version was saved by a newer {appName}, so it can't be restored here.",
  "versionHistory.restore.invalid": "That version can't be read, so it can't be restored.",
  "versionHistory.restore.notSaved":
    "{appName} couldn't save a version of the site as it is now, so nothing was restored.",
  // Open as new site.
  "versionHistory.openAsNewSite": "Open as New Site…",
  "versionHistory.newSiteName": "{site} ({version})",
  "versionHistory.openFailed.gone":
    "That version is no longer in this site, so it can't be opened.",
  // Delete.
  "versionHistory.delete": "Delete…",
  "versionHistory.delete.title": "Delete “{name}”?",
  "versionHistory.delete.description":
    "The version saved on {date} is deleted. This can't be undone; the site itself doesn't change.",
  "versionHistory.delete.confirm": "Delete Version",
  "versionHistory.deleted": "Deleted version “{name}”.",
  "versionHistory.deleteFailed": "{appName} couldn't delete the version.",
  "versionHistory.cancel": "Cancel",
  // App settings.
  "settings.versions": "Version History",
  "settings.versions.kept": "Versions kept",
  "settings.versions.keptHelp":
    "How many of the versions {appName} saves itself to keep for each site, from {min} to {max}. Versions you save are always kept.",
} as const;
