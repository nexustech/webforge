/** Messages for errors that no area has its own message for (standards §4, `WebforgeError`). */
export const errors = {
  "errors.unexpected": "Something went wrong in {appName}.",
  "errors.readOnly": "This site is read-only, so it can't be changed.",
  "errors.publishFailed": "Your site couldn't be published.",
  "errors.publishCancelled": "Publishing was cancelled.",
  "errors.credentials": "{appName} couldn't keep your sign-in details safely on this computer.",
  "errors.fontDownload": "{appName} couldn't download that font.",
} as const;
