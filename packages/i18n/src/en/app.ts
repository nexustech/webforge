/** App-wide strings: the app's name and version. */
export const app = {
  "app.name": "Webforge",
  "app.version": "Version {version}",
  // The start-up screen (index.html, filled in at build time), and what replaces it if starting
  // fails.
  "app.starting": "Starting {appName}…",
  "app.startFailed.message": "Something went wrong starting {appName}. Your work is saved.",
  "app.startFailed.reload": "Try again",
  // The native menu bar (macOS), and development's own menu.
  "app.menu.view": "View",
  "app.menu.developer": "Developer",
} as const;
