import { t } from "@webforge/i18n";
import type { App, Menu, Protocol, Session } from "electron";
import { shownTheme } from "../shared/editor-theme.js";
import { MEDIA_SCHEME } from "../shared/ipc/media.js";
import { DEFAULT_PREFERENCES } from "../shared/ipc/prefs.js";
import { applicationMenu } from "./app-menu.js";
import { APP_SCHEME, APP_SCHEME_PRIVILEGES, appPageUrl, createAppResponder } from "./app-scheme.js";
import { FONT_SCHEME } from "./fonts.js";
import { createHelpWindows, type HelpWindowOptions, type HelpWindows } from "./help-window.js";
import { logFailure } from "./log.js";
import type { PreferencesStore } from "./preferences.js";
import { hardenSession, hardenWebContents } from "./security.js";
import type { SiteFonts } from "./site-fonts.js";
import { windowBackground } from "./window-options.js";

/**
 * One Webforge at a time (1.8): whether this launch is the one that runs. A second launch, e.g. a
 * .wforge double-clicked in Explorer while Webforge is open, hands its command line to the running
 * one ("second-instance") and exits at once.
 */
export function claimInstance(
  app: Pick<
    App,
    "isPackaged" | "getPath" | "setName" | "setPath" | "requestSingleInstanceLock" | "exit"
  >,
): boolean {
  // In development the running bundle is Electron's own, named after the package: the app's name
  // for the About panel and menus, as the packaged app has it from its bundle (#450). Its user data
  // folder stays the one it had, named after the package (or `--user-data-dir`'s): named after the
  // app, it would be the installed app's, sharing its single-instance lock below, its backups,
  // recent sites, own themes and preferences.
  if (!app.isPackaged) {
    const userData = app.getPath("userData");
    app.setName(t("app.name"));
    app.setPath("userData", userData);
  }
  const primaryInstance = app.requestSingleInstanceLock();
  // The running Webforge has the command line once the lock is refused, and this launch has
  // nothing to save or close: it exits now. Quitting instead waits for Electron to be ready
  // before it ends, which on a busy computer took 10 to 60 seconds after the hand-over (#1084).
  if (!primaryInstance) app.exit(0);
  return primaryInstance;
}

/**
 * The Help window (5.4b, HP-10): its own page and preload, beside the editor's, in the person's
 * theme and at their interface zoom once the preferences are read.
 */
export function helpWindowsFor(
  create: HelpWindowOptions["create"],
  /** The dev server, which serves the Help page beside the editor's; none when packaged. */
  devServerUrl: string | undefined,
  preload: string,
  preferences: () => Pick<PreferencesStore, "get"> | undefined,
  /** Whether the computer is set to dark, for a person who follows it (#1169). */
  computerDark: () => boolean = () => false,
): HelpWindows {
  return createHelpWindows({
    create,
    pageUrl:
      devServerUrl === undefined
        ? appPageUrl("help.html")
        : new URL("help.html", devServerUrl).href,
    preload,
    title: t("help.window.title"),
    theme: () =>
      shownTheme(preferences()?.get().theme ?? DEFAULT_PREFERENCES.theme, computerDark()),
    background: windowBackground,
    zoom: () => preferences()?.get().interfaceZoom ?? DEFAULT_PREFERENCES.interfaceZoom,
    onLoadFailed: (error) => logFailure("Webforge could not load the Help window", error),
  });
}

/** Before "ready": every renderer sandboxed and kept on the app's own page, and the app's schemes. */
export function prepareRenderers(
  app: Pick<App, "enableSandbox" | "on">,
  protocol: Pick<Protocol, "registerSchemesAsPrivileged">,
  appUrl: string,
): void {
  // Sandbox every renderer, including any created later by dependencies.
  app.enableSandbox();
  // Media images (1.16) and the site's fonts (2.2) reach the editor through schemes of their own,
  // which must be known before "ready". Fonts load in CORS mode; so can images, whose pixels Theme
  // Studio reads for a palette from an image (2.3b, PG-2).
  // The app's own pages have theirs too (#652).
  protocol.registerSchemesAsPrivileged([
    APP_SCHEME_PRIVILEGES,
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, corsEnabled: true } },
    { scheme: FONT_SCHEME, privileges: { standard: true, secure: true, corsEnabled: true } },
  ]);
  app.on("web-contents-created", (_event, contents) => {
    hardenWebContents(contents, appUrl);
  });
}

/** What {@link prepareSession} sets up, once Electron is ready. */
export type SessionSetUp = {
  readonly menu: Pick<typeof Menu, "setApplicationMenu" | "buildFromTemplate">;
  readonly platform: NodeJS.Platform;
  /** The renderer comes from the dev server, which serves the app's pages itself. */
  readonly development: boolean;
  readonly session: Session;
  /** The built renderer's folder, which the app's scheme serves. */
  readonly rendererDir: string;
  readonly fonts: Pick<SiteFonts, "respondWithFont">;
};

/** Once Electron is ready: the menu, the default session's limits, and the app's schemes served. */
export function prepareSession(setUp: SessionSetUp): void {
  const { menu, session } = setUp;
  // No default menu: its zoom and reload keys are the editor's (F-ED-27).
  const template = applicationMenu(setUp.platform, setUp.development);
  menu.setApplicationMenu(template === null ? null : menu.buildFromTemplate(template));
  hardenSession(session);
  if (!setUp.development) {
    session.protocol.handle(APP_SCHEME, createAppResponder(setUp.rendererDir));
  }
  session.protocol.handle(FONT_SCHEME, (request) => setUp.fonts.respondWithFont(request.url));
}
