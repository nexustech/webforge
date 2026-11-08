import type { Session, WebContents, WebPreferences } from "electron";

/**
 * Web preferences for every window that shows editor UI. The renderer is sandboxed and isolated
 * from Node and Electron; it reaches the main process only through the preload API.
 */
export function createSecureWebPreferences(
  preloadPath: string,
  /** Spell check in text fields (F-ED-19); only where the system's own checker is used. */
  spellcheck = false,
): WebPreferences {
  return {
    preload: preloadPath,
    spellcheck,
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
 * Whether a renderer may navigate to `url`. Only the app's own pages are allowed: the same
 * protocol and host (with its port) as the app's, `webforge-app://editor` in production and the
 * dev server in development, and for a `file:` page the same file, on the same host (S7). The
 * protocol and host are compared, never `origin`: Node gives every custom scheme's URL the origin
 * `"null"`, so any two would match.
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
  if (target.protocol !== app.protocol || target.host !== app.host) return false;
  return app.protocol !== "file:" || target.pathname === app.pathname;
}

/** A navigation of the window or of a frame in it, as Electron describes it. */
type Navigation = {
  readonly url: string;
  readonly isMainFrame: boolean;
  readonly isSameDocument: boolean;
};

/**
 * Whether a frame may go where `navigation` leads: the app's own page, a move within the document
 * it shows (a link to a section), or, for a frame inside the page, a document the page writes
 * itself: the canvas's iframe starts as `about:blank` or `about:srcdoc`. Nothing else, so no frame
 * ever shows another site or a file of the computer's (R13d).
 */
export function mayNavigate(navigation: Navigation, appUrl: string): boolean {
  if (navigation.isSameDocument || isAppUrl(navigation.url, appUrl)) {
    return true;
  }
  return !navigation.isMainFrame && LOCAL_FRAME_DOCUMENTS.has(navigation.url);
}

/** The documents a frame's page writes itself, which a frame inside it may show. */
const LOCAL_FRAME_DOCUMENTS = new Set(["about:blank", "about:srcdoc"]);

type HardenableWebContents = Pick<WebContents, "setWindowOpenHandler" | "on">;

/**
 * Blocks pop-up windows, `<webview>` tags and navigation away from the app for one web contents:
 * of the window, of any frame in it (`will-frame-navigate`), and redirects on the way
 * (`will-redirect`). Links to the web open in the user's browser through a validated IPC call.
 */
export function hardenWebContents(contents: HardenableWebContents, appUrl: string): void {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url, appUrl)) {
      event.preventDefault();
    }
  });
  contents.on("will-frame-navigate", (event) => {
    if (!mayNavigate(event, appUrl)) {
      event.preventDefault();
    }
  });
  contents.on("will-redirect", (event) => {
    if (!mayNavigate(event, appUrl)) {
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
