import { join, resolve } from "node:path";
import { t } from "@webforge/i18n";
import { MEDIA_SCHEME } from "../shared/ipc/media.js";
import { DEFAULT_PREFERENCES } from "../shared/ipc/prefs.js";
import { updatesEvents } from "../shared/ipc/updates.js";
import { openFailureMessage } from "../shared/open-failure.js";
import { updateChannelFor } from "../shared/update-channel.js";
import { aiAppsFeature } from "./ai-apps-feature.js";
import { appCallsFeature } from "./app-calls.js";
import type { AppFeature } from "./app-feature.js";
import { AppLifecycle, closeThenExit } from "./app-lifecycle.js";
import { applicationMenu } from "./app-menu.js";
import { type AppElectron, type AppParts, testDialogAnswer } from "./app-parts.js";
import { APP_SCHEME, APP_SCHEME_PRIVILEGES, appPageUrl, createAppResponder } from "./app-scheme.js";
import { assistantFeature } from "./assistant-feature.js";
import { createBackupSchedule } from "./backup-schedule.js";
import { createBackups } from "./backups.js";
import { captureCanvas } from "./canvas-capture.js";
import { canvasStylesFeature, createCanvasStyles } from "./canvas-css.js";
import { createElementClipboard, systemClipboard } from "./clipboard.js";
import { createCodeTrust } from "./code-trust.js";
import { createCredentialStore } from "./credential-store.js";
import { createNativeDialogs } from "./dialogs.js";
import { announceClosedForE2eTests } from "./e2e-closed.js";
import { createFlushOnClose } from "./flush-on-close.js";
import { FONT_SCHEME } from "./fonts.js";
import { createHandOff } from "./hand-off.js";
import { createHelpWindows } from "./help-window.js";
import { logFailure } from "./log.js";
import { createMainWindows } from "./main-window.js";
import { mediaFeature } from "./media-feature.js";
import { createMyThemes } from "./my-themes.js";
import { openPreferencesStore, registerPreferencesHandlers } from "./preferences.js";
import { ProjectSession } from "./project-session.js";
import { createRecentSites, recentSitesFeature } from "./recent-sites.js";
import { openOrRecover } from "./recovery.js";
import { createSecretClipboard, electronSecretClipboard } from "./secret-clipboard.js";
import { hardenSession, hardenWebContents, isAppUrl } from "./security.js";
import { siteCallsFeature } from "./site-calls.js";
import { siteFontsOf } from "./site-fonts.js";
import { siteOutput } from "./site-output.js";
import { findProjectArgument } from "./site-paths.js";
import { createSiteSwitch } from "./site-switch.js";
import { logStartupTimes, markStartup } from "./startup-timing.js";
import { createStorageWriter } from "./storage-writer.js";
import { createTemplatesFeature } from "./templates-ipc.js";
import { myThemesFeature } from "./themes-ipc.js";
import { codeTrustFeature } from "./trust-ipc.js";
import { updatesSupported } from "./updates.js";
import { createUpdates } from "./updates-ipc.js";
import { versionsFeature } from "./versions-ipc.js";
import { windowBackground } from "./window-options.js";

// The app's wiring (R13c): Electron comes in as a parameter, so app.test.ts runs all of it against
// a fake one, and the E2E tests against the real one. The logic lives in the modules it wires.

/**
 * Starts Webforge: everything before "ready" at once, then the window once Electron is ready.
 * Settles once the window is created; a second instance hands its site over and never starts.
 */
export function startApp(electron: AppElectron, parts: AppParts): Promise<void> {
  const { app, BrowserWindow, dialog, ipcMain, Menu, protocol, session } = electron;
  const rendererDir = join(parts.dir, "../renderer");
  const preloadScript = join(parts.dir, "../preload/index.cjs");
  const exportWorkerScript = join(parts.dir, "export-worker.js");
  const storageWriterScript = join(parts.dir, "storage-writer.js");

  // electron-vite sets ELECTRON_RENDERER_URL to the Vite dev server in development only.
  const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
  // The packaged app's pages come from its own scheme, never `file://` (#652, S5, ADR 0023).
  const appUrl = devServerUrl ?? appPageUrl("index.html");
  // The Help window (5.4b, HP-10): its own page and preload, beside the editor's.
  const helpWindows = createHelpWindows({
    create: (options) => new BrowserWindow(options),
    pageUrl:
      devServerUrl === undefined
        ? appPageUrl("help.html")
        : new URL("help.html", devServerUrl).href,
    preload: join(parts.dir, "../preload/help.cjs"),
    title: t("help.window.title"),
    theme: () => lifecycle.preferences?.get().theme ?? DEFAULT_PREFERENCES.theme,
    background: windowBackground,
    zoom: () => lifecycle.preferences?.get().interfaceZoom ?? DEFAULT_PREFERENCES.interfaceZoom,
    onLoadFailed: (error) => logFailure("Webforge could not load the Help window", error),
  });
  // The editor's page only: on the dev server the Help page has the same origin, and it may make
  // only its own calls (`help-ipc.ts`).
  const isTrustedSender = (senderUrl: string) =>
    isAppUrl(senderUrl, appUrl) && !helpWindows.isHelpPage(senderUrl);

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

  // One Webforge at a time (1.8): a second launch, e.g. a .wforge double-clicked in Explorer while
  // Webforge is open, hands its command line to this one ("second-instance") and quits.
  const primaryInstance = app.requestSingleInstanceLock();
  if (!primaryInstance) {
    app.quit();
  }

  // Local crash reports first, so even a failing start-up leaves one (F-SITE-7).
  const crashReports = parts.startCrashReports(primaryInstance);

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

  // The editor's window: never the Help window.
  const lifecycle = new AppLifecycle(() =>
    BrowserWindow.getAllWindows().filter((window) => !helpWindows.is(window)),
  );

  // Rolling backups of the open site (F-SITE-6), the way back from a damaged file (1.7).
  const backups = createBackups({ root: join(app.getPath("userData"), "backups") });
  const backupSchedule = createBackupSchedule(backups);
  // The start screen's Recent list (F-SITE-2, 1.8).
  const recentSites = createRecentSites({ dir: app.getPath("userData") });
  // My themes (2.23): the person's own themes, for every site on this computer.
  const myThemes = createMyThemes({ dir: app.getPath("userData") });
  // The code each site's owner trusts (#649): only that goes into a build.
  const codeTrust = createCodeTrust({ dir: app.getPath("userData") });
  /** How many of Webforge's own versions each site keeps: the person's choice (P3). */
  const versionsKept = () =>
    lifecycle.preferences?.get().versionsKept ?? DEFAULT_PREFERENCES.versionsKept;
  // Publish passwords, keys and tokens (#666, 4.4a), encrypted with the OS's keychain (Windows
  // DPAPI, macOS Keychain): never in a site file. safeStorage is asked as each one is used.
  const credentials = createCredentialStore(join(app.getPath("userData"), "credentials.json"), {
    isEncryptionAvailable: () => electron.safeStorage.isAsyncEncryptionAvailable(),
    encryptString: (text) => electron.safeStorage.encryptStringAsync(text),
    decryptString: (encrypted) => electron.safeStorage.decryptStringAsync(encrypted),
  });
  const projectSession = new ProjectSession(
    {},
    {
      // Imports are read, hashed and stored in a thread of their own (R13b, ADR 0013), whose
      // crash becomes a local report (R3).
      writer: createStorageWriter(
        () => parts.startStorageWriter(storageWriterScript),
        (crash) => crashReports.reportThread("storage-writer", crash),
      ),
      // The site as it was before each day's first change, in Version History (F-SITE-4, 4.6).
      dailyVersion: { kept: versionsKept },
    },
  );

  // Before another site replaces the open one: save it, and capture its canvas for Recent.
  /** The renderer saves its last changes (`app:flush`). */
  const requestFlush = async () => {
    const window = lifecycle.mainWindow();
    if (window !== undefined) await lifecycle.flushOnClose?.requestFlush(window);
  };
  const siteSwitch = createSiteSwitch({
    currentPath: () => projectSession.currentPath(),
    requestFlush,
    capture: () => captureCanvas(lifecycle.mainWindow()),
    recent: recentSites,
  });
  const openSite = (path: string) =>
    openOrRecover(projectSession, path, backups, parts.recoveryDialogs);

  // Sites handed over while Webforge runs: saved, then replaced in the same window (1.8).
  const handOff = createHandOff({
    currentPath: () => projectSession.currentPath(),
    leaveSite: () => siteSwitch.leaveSite(),
    open: openSite,
    focus: () => {
      lifecycle.focusMainWindow();
    },
    show: (reload) => {
      // A hand-off that finishes while the app quits must not bring a window back.
      if (lifecycle.quitting) return;
      const window = lifecycle.focusMainWindow();
      if (window === undefined) {
        // A new window loads the site that is open now.
        if (lifecycle.preferences !== undefined) mainWindows.open(lifecycle.preferences);
      } else if (reload) {
        window.webContents.reload();
      }
    },
    failed: async (reason) => {
      const options = { type: "warning" as const, message: openFailureMessage(reason) };
      const parent = lifecycle.mainWindow();
      await (parent === undefined
        ? dialog.showMessageBox(options)
        : dialog.showMessageBox(parent, options));
    },
  });

  app.on("before-quit", () => {
    lifecycle.quitting = true;
  });

  // Dialogs are modal to the focused window.
  const dialogs = createNativeDialogs({
    dialog,
    focusedWindow: () => BrowserWindow.getFocusedWindow(),
    testAnswer: testDialogAnswer,
  });

  const fonts = siteFontsOf(app, electron.net);

  // Copied elements, with their images' bytes kept in the user's data while the clipboard holds
  // them (1.25, R13d).
  const elementClipboard = createElementClipboard(
    systemClipboard(electron),
    join(app.getPath("userData"), "clipboard"),
  );
  // The editor's window (#985).
  const mainWindows = createMainWindows({
    electron,
    platform: process.platform,
    preload: preloadScript,
    appUrl,
    helpWindows,
    installFlush: (window) => lifecycle.flushOnClose?.install(window),
    // Something copied in another app replaces the copied elements: their images go (R13d).
    onFocus: () => void elementClipboard.forgetIfReplaced(),
  });
  // An AI app's key, copied out of clipboard history and cleared in a minute (4.9).
  const secretClipboard = createSecretClipboard(
    electronSecretClipboard(electron, process.platform),
  );

  // The templates New Site offers (2.14a), outside app.asar.
  const templates = createTemplatesFeature(
    app.isPackaged
      ? join(process.resourcesPath, "templates")
      : join(app.getAppPath(), "out", "templates"),
  );

  // Every worker's crash becomes a local report (R3).
  const forkWorker = (serviceName: string) =>
    crashReports.watchWorker(electron.utilityProcess.fork(exportWorkerScript, [], { serviceName }));
  // The site's preview, export and publishing (#985).
  const output = siteOutput({
    session: projectSession,
    codeTrust,
    fonts,
    dialogs,
    credentials,
    forkWorker,
    shell: electron.shell,
    packaged: app.isPackaged,
    mainWindow: () => lifecycle.mainWindow(),
    versionsKept,
    flush: requestFlush,
  });
  // The canvas compiles its site CSS, and lists the classes the site supports (#276), in one
  // long-lived worker (1.12), started when first needed, or as the window opens with a site (#894).
  const canvasStyles = createCanvasStyles(
    () => forkWorker("Webforge canvas styles"),
    undefined,
    fonts.downloadedFamiliesOf,
  );
  // Webforge's own updates (0.5a), started once the window has opened, in a build that has them.
  const updates = createUpdates({
    supported: updatesSupported(app.isPackaged, process.platform),
    load: parts.updater,
    channel: () => updateChannelFor(lifecycle.preferences?.get().updateChannel, app.getVersion()),
    onStatus: (status) =>
      lifecycle.mainWindow()?.webContents.send(updatesEvents.status.channel, status),
    quitting: () => lifecycle.quitting,
  });
  // Version History (4.6): its calls, and the versions main saves before AI apps' changes.
  const versions = versionsFeature({
    session: projectSession,
    dialogs: dialogs.project,
    captureCanvas: () => captureCanvas(lifecycle.mainWindow()),
    versionsKept: async () => versionsKept(),
    beforeSwitch: () => siteSwitch.leaveSite(),
    // Before main saves a version itself (`saveVersionBefore`, which 4.9's AI apps use).
    flush: requestFlush,
  });
  // AI apps on this computer (4.8, 4.9, ADR 0021): their requests go to the open site's window.
  const aiApps = aiAppsFeature({
    userData: app.getPath("userData"),
    packaged: app.isPackaged,
    bridgeFile: app.isPackaged
      ? join(process.resourcesPath, "bridge", "webforge-bridge.mjs")
      : join(app.getAppPath(), "out", "bridge", "webforge-bridge.mjs"),
    info: { name: t("app.name"), version: app.getVersion() },
    window: () => lifecycle.mainWindow(),
    site: projectSession,
    credentials,
    templates: () => templates.briefTemplates(),
    versions,
    shell: () => electron.shell,
  });
  /**
   * The app's features (A12): each is told as sites open, are saved and close (a hand-off's
   * included), registered once Electron is ready, and given its last work before Webforge exits.
   */
  const features: readonly AppFeature[] = [
    // Rolling backups of the open site: as it opens, then every 30 minutes it was edited.
    { site: backupSchedule },
    recentSitesFeature(recentSites, projectSession),
    myThemesFeature(myThemes),
    fonts,
    templates,
    output.export,
    output.preview,
    codeTrustFeature(codeTrust, projectSession),
    output.destinations,
    output.publish,
    // Media's images and imports (1.16).
    mediaFeature({
      startWorker: () => forkWorker("Webforge thumbnails"),
      readMedia: (hash) => projectSession.readOpenMedia(hash),
      session: projectSession,
      dialogs: dialogs.media,
      protocol: () => session.defaultSession.protocol,
    }),
    canvasStylesFeature(canvasStyles, () => projectSession.current() !== null),
    // Webforge's own updates (0.5a): their state for the window. Quitting installs one, last.
    updates,
    versions,
    aiApps,
    // The assistant (6.9a, ADR 0026), on AI apps' tools.
    assistantFeature({
      userData: app.getPath("userData"),
      credentials,
      electron: () => electron,
      window: () => lifecycle.mainWindow(),
      site: projectSession,
      tools: aiApps,
      versions,
    }),
    // Its name and version, the macOS menu bar, spell check, failures, guides, Help and licences.
    appCallsFeature({
      app,
      menu: Menu,
      focusedWindow: () => BrowserWindow.getFocusedWindow(),
      session: () => session.defaultSession,
      shell: () => electron.shell,
      platform: process.platform,
      development: devServerUrl !== undefined,
      helpWindows,
      mainWindow: () => lifecycle.mainWindow(),
      crashReports,
    }),
    // Opening and closing sites, the Recent list, copy and paste, bundled files, imported posts.
    siteCallsFeature({
      session: projectSession,
      dialogs: dialogs.project,
      options: {
        recovery: { backups, dialogs: parts.recoveryDialogs },
        recent: recentSites,
        beforeSwitch: () => siteSwitch.leaveSite(),
        template: templates.template,
        flush: requestFlush,
      },
      net: electron.net,
      packaged: app.isPackaged,
      clipboard: elementClipboard,
      writeText: (text) => electron.clipboard.writeText(text),
      copySecret: (secret) => secretClipboard.copy(secret),
      choosePostFiles: dialogs.posts.choosePostFiles,
    }),
    output.publishCalls,
    output.netlify,
  ];
  for (const feature of features) {
    if (feature.site !== undefined) projectSession.listen(feature.site);
  }

  async function start(): Promise<void> {
    await app.whenReady();
    markStartup("ready");
    // No default menu: its zoom and reload keys are the editor's (F-ED-27).
    const menu = applicationMenu(process.platform, devServerUrl !== undefined);
    Menu.setApplicationMenu(menu === null ? null : Menu.buildFromTemplate(menu));
    hardenSession(session.defaultSession);
    if (devServerUrl === undefined) {
      session.defaultSession.protocol.handle(APP_SCHEME, createAppResponder(rendererDir));
    }
    session.defaultSession.protocol.handle(FONT_SCHEME, (request) =>
      fonts.respondWithFont(request.url),
    );
    const preferences = await openPreferencesStore(
      join(app.getPath("userData"), "preferences.json"),
    );
    lifecycle.preferences = preferences;
    const followWindows = mainWindows.follow(preferences.get());
    registerPreferencesHandlers(ipcMain, isTrustedSender, preferences, (next) => {
      // The person chose an update channel in Settings (5.2).
      updates.service()?.setChannel(updateChannelFor(next.updateChannel, app.getVersion()));
      followWindows(next);
    });
    lifecycle.flushOnClose = createFlushOnClose(ipcMain, isTrustedSender, {
      // The flush has just run; capture the canvas for the Recent list before the window goes.
      beforeClose: () => siteSwitch.leaveSite(),
      onClosed: () => {
        if (lifecycle.quitting) app.quit();
      },
    });
    for (const feature of features) feature.register?.(ipcMain, isTrustedSender);
    markStartup("ipc-registered");
    // A site double-clicked in Explorer arrives as a command-line argument (P1).
    const projectToOpen = lifecycle.projectFromFinder ?? findProjectArgument(process.argv);
    if (projectToOpen !== undefined) {
      await openSite(projectToOpen);
      markStartup("site-opened");
    }
    mainWindows.open(preferences);
    // The start-up's stages, in a perf build (#891).
    logStartupTimes(import.meta.env.MODE);
    void crashReports.noticeAfterLaunch();
    // What waited for the window: the canvas's styles with a site open, a check for an update.
    for (const feature of features) feature.started?.();

    // macOS: a click on the Dock icon while no window is open. Webforge quits when its window
    // closes (spec/02 §1), so that is only between the last window closing and the app quitting.
    app.on("activate", () => {
      if (lifecycle.mainWindow() === undefined) mainWindows.open(preferences);
    });
  }

  // No top-level await in the entry point: Electron emits "ready" only after the ESM entry module
  // has finished evaluating. A second instance never starts: it is quitting.
  const started = primaryInstance ? start() : new Promise<void>(() => undefined);
  started.catch((error: unknown) => {
    logFailure("Webforge failed to start", error);
    app.exit(1);
  });

  // macOS delivers a site double-clicked in Finder (P1) as an event, possibly before "ready";
  // once Webforge runs, it is handed over like a second launch's.
  app.on("open-file", (event, path) => {
    event.preventDefault();
    if (app.isReady()) {
      void started.then(() => handOff.open(path));
    } else {
      lifecycle.projectFromFinder = path;
    }
  });

  app.on("second-instance", (_event, argv, workingDirectory) => {
    const path = findProjectArgument(argv);
    // A path typed in a terminal is relative to where that launch ran, not to this process.
    void started.then(() =>
      handOff.open(path === undefined ? undefined : resolve(workingDirectory, path)),
    );
  });

  // Closing the site waits for work on its file (at most a few seconds, R13b), so quitting waits
  // for that, then exits. Not `app.quit()` again: once "will-quit" was held back, Electron ignores
  // it, and every window is closed by now anyway.
  app.on("will-quit", (event) => {
    event.preventDefault();
    if (lifecycle.exiting) return;
    lifecycle.exiting = true;
    // No site's images stay on disk outside it once Webforge has quit (R13d). Not a second launch's
    // quit: the images are the running Webforge's, in the same user data.
    if (primaryInstance) elementClipboard.forgetKept();
    void closeThenExit({
      // The MCP server first: no AI app's request reaches a site that is closing.
      close: async () => {
        // No AI app's key stays on the clipboard after Webforge has quit (4.9).
        await secretClipboard
          .clearIfHeld()
          .catch((error: unknown) => logFailure("secret clipboard clear", error));
        await aiApps.close();
        await projectSession.close();
      },
      // Then each feature's last work, such as My themes' and the Recent list's last writes, and
      // the preferences' last writes: a panel resized just before quitting keeps its size (#740).
      features: [...features, { quit: async () => await lifecycle.preferences?.idle() }],
      // Last, once all of that has finished: a downloaded update's installer (0.5a), which ends a
      // Webforge still running.
      install: () => updates.service()?.installOnQuit(),
      // The site is saved and closed: a launch from now on opens Webforge itself, rather than
      // handing its site to this one, which on a busy computer can take up to a minute more to
      // end (#413).
      releaseLock: () => {
        if (primaryInstance) app.releaseSingleInstanceLock();
      },
      exit: (code) => {
        // Closed: what's left is Electron's teardown, which the E2E tests needn't wait for (#534).
        announceClosedForE2eTests(app.isPackaged);
        app.exit(code);
      },
    });
  });

  // Webforge quits when its window closes, on macOS too (spec/02 §1, #287): it's a one-window
  // app, and one left in the Dock with no window looks broken to the people it's for.
  app.on("window-all-closed", () => {
    app.quit();
  });

  return started;
}
