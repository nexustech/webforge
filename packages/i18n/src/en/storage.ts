/** Saving, backups and recovery (stream B). */
export const storage = {
  "storage.saved": "Saved",
  "storage.saving": "Saving…",
  "storage.saveFailed": "Not saved. {appName} will try again.",
  "storage.recovery.title": "Site File Damaged",
  "storage.recovery.message": "This site file is damaged and can't be opened.",
  "storage.recovery.detail":
    "{appName} keeps backups of your site. The latest is from {when}. Restoring it keeps the damaged file next to it, so nothing is deleted.",
  "storage.recovery.restoreLatest": "Restore Latest Backup",
  "storage.recovery.chooseBackup": "Choose a Backup…",
  "storage.recovery.cancel": "Cancel",
  "storage.recovery.chooseTitle": "Choose a Backup",
  "storage.recovery.noBackups":
    "This site file is damaged and can't be opened, and there is no backup of it yet.",
  "storage.crash.title": "{appName} Closed Unexpectedly",
  "storage.crash.message": "{appName} closed unexpectedly. Your work was saved.",
  "storage.crash.detail":
    "A crash report was saved on this computer. It contains no site content or personal details, and nothing was sent anywhere.",
  "storage.crash.openFolder": "Open Crash Reports Folder",
  "storage.crash.ok": "OK",
  "storage.command.openCrashReports": "Open Crash Reports Folder",
} as const;
