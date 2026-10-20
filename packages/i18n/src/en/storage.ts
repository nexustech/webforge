/** Saving, backups and recovery (stream B). */
export const storage = {
  "storage.saved": "Saved",
  "storage.saving": "Saving…",
  "storage.saveFailed": "Not saved. Webforge will try again.",
  "storage.recovery.title": "Site file damaged",
  "storage.recovery.message": "This site file is damaged and can't be opened.",
  "storage.recovery.detail":
    "Webforge keeps backups of your site. The latest is from {when}. Restoring it keeps the damaged file next to it, so nothing is deleted.",
  "storage.recovery.restoreLatest": "Restore latest backup",
  "storage.recovery.chooseBackup": "Choose a backup…",
  "storage.recovery.cancel": "Cancel",
  "storage.recovery.chooseTitle": "Choose a backup",
  "storage.recovery.noBackups":
    "This site file is damaged and can't be opened, and there is no backup of it yet.",
} as const;
