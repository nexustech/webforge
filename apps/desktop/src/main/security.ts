import type { Session, WebContents, WebPreferences } from "electron";

/**
 * Web preferences for every window that shows editor UI. The renderer is sandboxed and isolated
 * from Node and Electron; it reaches the main process only through the preload API.
 */
export function createSecureWebPreferences(preloadPath: string): WebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    navigateOnDragDrop: false,
  };
}

/**
 * Whether a renderer may navigate to `url`. Only the app's own page is allowed: the same
 * origin as the dev server in development, the same file in production.
 */
export function isAppUrl(url: string, appUrl: string): boolean {
  let target: URL;
  let app: URL;
  try {
    target = new URL(url);
    app = new URL(appUrl);
  } catch {
    return false;
  }
  if (app.protocol === "file:") {
    return target.protocol === "file:" && target.pathname === app.pathname;
  }
  return target.origin === app.origin;
}

type HardenableWebContents = Pick<WebContents, "setWindowOpenHandler" | "on">;

/**
 * Blocks pop-up windows, `<webview>` tags and navigation away from the app for one web contents.
 * Links to the web will later open in the user's browser through a validated IPC call.
 */
export function hardenWebContents(contents: HardenableWebContents, appUrl: string): void {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url, appUrl)) {
      event.preventDefault();
    }
  });
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

type HardenableSession = Pick<Session, "setPermissionRequestHandler" | "setPermissionCheckHandler">;

/** Denies every web permission (camera, notifications, geolocation…); the editor needs none. */
export function hardenSession(session: HardenableSession): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.setPermissionCheckHandler(() => false);
}
