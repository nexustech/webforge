import { networkInterfaces } from "node:os";
import { dirname, join, resolve } from "node:path";
import { t } from "@webforge/i18n";
import type { SiteSnapshot } from "@webforge/model";
import {
  type ThumbnailJob,
  type ThumbnailOutcome,
  thumbnailOutcomeSchema,
} from "../shared/export-worker-protocol.js";
import { appEvents } from "../shared/ipc/app.js";
import { MEDIA_SCHEME } from "../shared/ipc/media.js";
import { DEFAULT_PREFERENCES } from "../shared/ipc/prefs.js";
import { previewEvents } from "../shared/ipc/preview.js";
import { publishEvents } from "../shared/ipc/publish.js";
import { siteEvents } from "../shared/ipc/site.js";
import { updatesEvents } from "../shared/ipc/updates.js";
import { openFailureMessage } from "../shared/open-failure.js";
import { updateChannelFor } from "../shared/update-channel.js";
import { aiAppsFileSchema, createAiApps, NO_AI_APPS } from "./ai-apps.js";
import { exposeForE2eTests, registerAiHandlers } from "./ai-ipc.js";
import type { AppFeature } from "./app-feature.js";
import { AppLifecycle, closeThenExit } from "./app-lifecycle.js";
import { applicationMenu, runMenuCommand } from "./app-menu.js";
import { APP_SCHEME, APP_SCHEME_PRIVILEGES, appPageUrl, createAppResponder } from "./app-scheme.js";
import { registerAssistantHandlers, unbuiltAssistant } from "./assistant-ipc.js";
import { createBackupSchedule } from "./backup-schedule.js";
import { createBackups } from "./backups.js";
import { bundleNetworkFor, resolveHost } from "./bundle-download.js";
import { registerBundleHandlers } from "./bundle-ipc.js";
import { electronBundleFetch } from "./bundle-net.js";
import { captureCanvas } from "./canvas-capture.js";
import { createCanvasStyles, registerCanvasHandlers } from "./canvas-css.js";
import { createClaudeExtensions } from "./claude-extension.js";
import { createElementClipboard, systemClipboard } from "./clipboard.js";
import { registerClipboardHandlers } from "./clipboard-ipc.js";
import { createCodeTrust, withTrustedCode } from "./code-trust.js";
import type { startCrashReports } from "./crash-wiring.js";
import { createCredentialStore } from "./credential-store.js";
import { createNativeDialogs } from "./dialogs.js";
import { announceClosedForE2eTests } from "./e2e-closed.js";
import type { E2eDialog } from "./e2e-dialogs.js";
import { netlifyApiFor } from "./e2e-netlify.js";
import { createExportFeature } from "./export-feature.js";
import { registerFailureLog } from "./failure-ipc.js";
import { createFlushOnClose } from "./flush-on-close.js";
import { FONT_SCHEME } from "./fonts.js";
import { registerGuideHandlers } from "./guides.js";
import { createHandOff } from "./hand-off.js";
import { registerHelpHandlers } from "./help-ipc.js";
import { createHelpWindows } from "./help-window.js";
import { applyInterfaceZoom, fitWindowToZoom } from "./interface-zoom.js";
import { registerIpcHandler } from "./ipc.js";
import { createJsonStore } from "./json-store.js";
import { licenceFiles, registerLicenceHandlers } from "./licences.js";
import { logFailure } from "./log.js";
import { registerMcpHandlers } from "./mcp-ipc.js";
import { createMcpService, type McpService } from "./mcp-service.js";
import { registerMediaHandlers } from "./media-ipc.js";
import { createMediaResponder } from "./media-protocol.js";
import { createMyThemes } from "./my-themes.js";
import { createNetlifySignIns } from "./netlify-auth.js";
import { registerNetlifyHandlers } from "./netlify-ipc.js";
import { hasAddress, phoneAddressFor } from "./network-address.js";
import { filePostsParts, registerPostsHandlers } from "./posts-ipc.js";
import {
  openPreferencesStore,
  type PreferencesStore,
  registerPreferencesHandlers,
} from "./preferences.js";
import { createPreviewBuilder } from "./preview-builder.js";
import { createPreview, previewFeature } from "./preview-ipc.js";
import { createPreviewServer } from "./preview-server.js";
import { registerProjectHandlers } from "./project-ipc.js";
import { ProjectSession } from "./project-session.js";
import { publishDestinationsFeature } from "./publish-destinations-ipc.js";
import { createKeyFiles, registerPublishHandlers, testSignIn } from "./publish-ipc.js";
import { publishRunFeature } from "./publish-run.js";
import { createPublishSecrets } from "./publish-secrets.js";
import { createRecentSites, recentSitesFeature } from "./recent-sites.js";
import { openOrRecover, type RecoveryDialogs } from "./recovery.js";
import { createSecretClipboard, electronSecretClipboard } from "./secret-clipboard.js";
import {
  createSecureWebPreferences,
  hardenSession,
  hardenWebContents,
  isAppUrl,
} from "./security.js";
import { createSiteBriefs } from "./site-brief.js";
import { siteFontsOf } from "./site-fonts.js";
import { findProjectArgument } from "./site-paths.js";
import { createSiteSwitch } from "./site-switch.js";
import {
  installContextMenu,
  registerSpellCheckHandlers,
  spellCheckAvailable,
} from "./spellcheck.js";
import { logStartupTimes, markStartup } from "./startup-timing.js";
import { createStorageWriter, type WriterThread } from "./storage-writer.js";
import { createTemplatesFeature } from "./templates-ipc.js";
import { myThemesFeature } from "./themes-ipc.js";
import { codeTrustFeature } from "./trust-ipc.js";
import {
  createUpdateService,
  type Updater,
  type UpdateService,
  updatesSupported,
} from "./updates.js";
import { updatesFeature } from "./updates-ipc.js";
import { registerVersionsHandlers } from "./versions-ipc.js";
import {
  editorPageAddress,
  MIN_WINDOW_SIZE,
  mainWindowPlacement,
  titleBarOptions,
  titleBarOverlay,
  windowBackground,
} from "./window-options.js";
import { rememberWindowState } from "./window-state.js";
import { createWorkerRequests } from "./worker-requests.js";

// The app's wiring (R13c): Electron comes in as a parameter, so app.test.ts runs all of it against
// a fake one, and the E2E tests against the real one. The logic lives in the modules it wires.

/** The parts of Electron the app uses; a fake in tests. */
export type AppElectron = Pick<
  typeof import("electron"),
  | "app"
  | "BrowserWindow"
  | "ClipboardItem"
  | "clipboard"
  | "dialog"
  | "ipcMain"
  | "Menu"
  | "net"
  | "protocol"
  | "safeStorage"
  | "screen"
  | "session"
  | "shell"
  | "utilityProcess"
>;

/** What the entry point hands the app besides Electron: the modules that use Electron directly. */
export type AppParts = {
  /** The built main process's folder, beside the preload, the editor and the workers. */
  readonly dir: string;
  /** Local crash reports (crash-wiring.ts), started first, so even a failing start leaves one. */
  readonly startCrashReports: typeof startCrashReports;
  /** The native dialogs of the damaged-site recovery (recovery-dialogs.ts). */
  readonly recoveryDialogs: RecoveryDialogs;
  /** Starts the storage writer's thread from its script (R13b, ADR 0013). */
  readonly startStorageWriter: (script: string) => WriterThread;
  /** Loads electron-updater (0.5a), only in a build that updates itself (`updatesSupported`). */
  readonly updater: () => Promise<Updater>;
};

/**
 * A test's answer for a native file dialog, in `--mode e2e` builds only (see e2e-dialogs.ts):
 * the packaged E2E tests can't replace `dialog` as the unpacked ones do. Other builds drop the
 * branch, and the module with it.
 */
async function testDialogAnswer(
  kind: E2eDialog,
): Promise<{ path: string | undefined } | undefined> {
  if (import.meta.env.MODE !== "e2e") {
    return undefined;
  }
  const { e2eDialogAnswer } = await import("./e2e-dialogs.js");
  return e2eDialogAnswer(kind);
}

/**
 * Starts Webforge: everything before "ready" at once, then the window once Electron is ready.
 * Settles once the window is created; a second instance hands its site over and never starts.
 */
export function startApp(electron: AppElectron, parts: AppParts): Promise<void> {
  const { app, BrowserWindow, dialog, ipcMain, Menu, protocol, screen, session } = electron;
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
  /** The MCP server for AI apps (4.9), once Electron is ready. */
  let mcp: McpService | undefined;
  // Webforge's own updates (0.5a), once started after the window opens, in a build that has them.
  let updates: UpdateService | undefined;
  const credentials = createCredentialStore(join(app.getPath("userData"), "credentials.json"), {
    isEncryptionAvailable: () => electron.safeStorage.isAsyncEncryptionAvailable(),
    encryptString: (text) => electron.safeStorage.encryptStringAsync(text),
    decryptString: (encrypted) => electron.safeStorage.decryptStringAsync(encrypted),
  });
  // The key files the person chose (4.3), by handle: Test connection and saving read them.
  const keyFiles = createKeyFiles();
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
        if (lifecycle.preferences !== undefined) createMainWindow(lifecycle.preferences);
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
  // Every build gets only the code the open site's owner trusts (#649).
  const trustedOnly = (snapshot: SiteSnapshot) =>
    withTrustedCode(snapshot, projectSession.projectId(), codeTrust);

  // The preview server (3.2): its builds in a worker of their own while a preview is open, so an
  // export never waits behind one; opened in the default browser, which the site's scripts run in,
  // never in an Electron window.
  const preview = createPreview({
    startServer: createPreviewServer,
    // A preview's builds read the Media of the opening it was started for (#663).
    startBuilder: (onBuilt, readMedia) =>
      createPreviewBuilder(() => forkWorker("Webforge preview"), { readMedia, onBuilt }),
    site: (sessionId) => projectSession.forSession(sessionId),
    jobFor: async (sent) => {
      const snapshot = await trustedOnly(sent);
      return { type: "preview", snapshot, ...(await fonts.previewFontsOf(snapshot.theme)) };
    },
    // Only the preview's own address, which this process makes: never one from the renderer.
    openInBrowser: async (url) => {
      try {
        await electron.shell.openExternal(url);
        return true;
      } catch {
        return false;
      }
    },
    networkAddress: phoneAddressFor(app.isPackaged),
    hasAddress: (address) => hasAddress(networkInterfaces(), address),
    phoneStopped: () =>
      lifecycle.mainWindow()?.webContents.send(previewEvents.phoneStopped.channel),
  });

  // The export, whose runner Publish shares (ADR 0018 §1).
  const exportFeature = createExportFeature({
    dialogs: dialogs.export,
    startWorker: () => forkWorker("Webforge export"),
    fontsOf: fonts.fontsOf,
    // Only the code the site's owner trusts (#649).
    snapshotFor: trustedOnly,
    sendProgress: (operationId, progress) =>
      lifecycle
        .mainWindow()
        ?.webContents.send(siteEvents.exportProgress.channel, operationId, progress),
    // The site each export call is for (#663): its Media and its export choices.
    site: (sessionId) => projectSession.forSession(sessionId),
    // Looked up as it's called: the E2E tests replace `shell.openPath`, so no browser opens.
    shell: electron.shell,
  });
  const publishSecrets = createPublishSecrets(credentials);
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
    exportFeature,
    previewFeature(preview),
    codeTrustFeature(codeTrust, projectSession),
    // The open site's publish destinations (4.4a): the list in its file, sign-ins in the keychain.
    publishDestinationsFeature({
      site: (sessionId) => projectSession.site(sessionId),
      secrets: publishSecrets,
      keys: keyFiles,
      test: testSignIn,
    }),
    // Publish (4.5): read, gated, built and sent in the export worker, then saved as a version.
    publishRunFeature({
      site: (sessionId) => ({
        ...projectSession.forSession(sessionId),
        withStore: projectSession.site(sessionId).withStore,
      }),
      secrets: publishSecrets,
      trusted: (projectId) => codeTrust.trusted(projectId),
      fontsOf: fonts.fontsOf,
      runner: exportFeature.runner,
      sendProgress: (operationId, progress) =>
        lifecycle
          .mainWindow()
          ?.webContents.send(publishEvents.progress.channel, operationId, progress),
      versionsKept,
      flush: requestFlush,
      // So Clean up keeps what a publish under way reaches (4.6).
      holdManifest: (manifest) => projectSession.holdManifest(manifest),
      // Looked up as it's called, as the export's shell is.
      openExternal: (url) => electron.shell.openExternal(url),
      // Netlify's own API, or the E2E tests' mock in an unpackaged app (#70).
      netlifyApi: netlifyApiFor(app.isPackaged),
    }),
    // Webforge's own updates (0.5a): their state for the window. Quitting installs one, last.
    updatesFeature(() => updates),
  ];
  for (const feature of features) {
    if (feature.site !== undefined) projectSession.listen(feature.site);
  }

  // Media thumbnails are made in a long-lived worker too, started when first needed (1.16).
  const requestThumbnail = createWorkerRequests<ThumbnailOutcome, ThumbnailJob>(
    () => forkWorker("Webforge thumbnails"),
    thumbnailOutcomeSchema,
    60_000,
  );
  const respondWithMedia = createMediaResponder({
    readMedia: (hash) => projectSession.readOpenMedia(hash),
    makeThumbnail: async (data, mimeType) => {
      const outcome = await requestThumbnail({ type: "thumbnail", mimeType, data });
      return outcome?.type === "thumbnail" ? outcome.data : undefined;
    },
  });

  // The canvas compiles its site CSS, and lists the classes the site supports (#276), in one
  // long-lived worker (1.12), started when first needed, or as the window opens with a site (#894).
  const canvasStyles = createCanvasStyles(
    () => forkWorker("Webforge canvas styles"),
    undefined,
    fonts.downloadedFamiliesOf,
  );

  /**
   * Starts Webforge's own updates (0.5a) in a build that has them, once the window is open:
   * electron-updater is loaded only then, so it never slows the start.
   */
  function startUpdates(): void {
    if (!updatesSupported(app.isPackaged, process.platform)) return;
    parts
      .updater()
      .then((updater) => {
        if (lifecycle.quitting) return;
        updates = createUpdateService({
          updater,
          channel: updateChannelFor(lifecycle.preferences?.get().updateChannel, app.getVersion()),
          onStatus: (status) =>
            lifecycle.mainWindow()?.webContents.send(updatesEvents.status.channel, status),
        });
        updates.start();
      })
      .catch((error: unknown) => logFailure("Webforge could not start its updates", error));
  }

  function createMainWindow(preferences: PreferencesStore): void {
    const { theme, window: saved, interfaceZoom } = preferences.get();
    const placement = mainWindowPlacement(
      saved,
      screen.getAllDisplays().map((display) => display.workArea),
    );
    const window = new BrowserWindow({
      title: t("app.name"),
      ...placement.bounds,
      minWidth: MIN_WINDOW_SIZE.width,
      minHeight: MIN_WINDOW_SIZE.height,
      // The renderer draws the title bar (1.2), in the person's theme, at the interface zoom.
      ...titleBarOptions(process.platform, theme, interfaceZoom),
      backgroundColor: windowBackground(theme),
      show: false,
      webPreferences: {
        ...createSecureWebPreferences(preloadScript, spellCheckAvailable(process.platform)),
        // The interface zoom (View › Zoom In Interface) from the first paint.
        zoomFactor: interfaceZoom,
      },
    });
    // Before its page starts loading (#891); only the first window's is logged.
    markStartup("window-created");
    // Zoomed in, the smallest window grows, capped by the screen the window opens on.
    fitWindowToZoom(window, interfaceZoom, screen.getDisplayMatching(window.getBounds()).workArea);
    // Spelling suggestions, Add to Dictionary, Cut, Copy and Paste on right-clicks (F-ED-19).
    installContextMenu(window, (template) => Menu.buildFromTemplate(template));
    // Maximised the first time, so the canvas gets the room (ADR 0008). Maximising shows the
    // window at once, in the theme's background colour; the editor then lays out at its final
    // size, instead of at 1280 × 800 and again when the window grows.
    if (placement.maximized) {
      window.maximize();
    }
    window.once("ready-to-show", () => {
      window.show();
    });
    rememberWindowState(window, preferences);
    // Something copied in another app replaces the copied elements: their images go (R13d).
    window.on("focus", () => {
      void elementClipboard.forgetIfReplaced();
    });
    // Autosave writes the last changes before the window closes (P2).
    lifecycle.flushOnClose?.install(window);
    // Help goes with the editor, so the app quits with it (5.4b).
    window.on("closed", () => helpWindows.close());
    // In the person's theme from the first paint: the page's start-up screen reads it (#887).
    const load = window.loadURL(editorPageAddress(appUrl, theme));
    // A failed or aborted load (e.g. a reload while loading) is not fatal; the window stays open.
    load.catch((error: unknown) => {
      logFailure("Webforge could not load the editor window", error);
    });
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
    session.defaultSession.protocol.handle(MEDIA_SCHEME, (request) =>
      respondWithMedia(request.url),
    );
    session.defaultSession.protocol.handle(FONT_SCHEME, (request) =>
      fonts.respondWithFont(request.url),
    );
    const preferences = await openPreferencesStore(
      join(app.getPath("userData"), "preferences.json"),
    );
    lifecycle.preferences = preferences;
    let windowTheme = preferences.get().theme;
    let windowZoom = preferences.get().interfaceZoom;
    registerPreferencesHandlers(
      ipcMain,
      isTrustedSender,
      preferences,
      ({ theme, updateChannel, interfaceZoom }) => {
        // The person chose an update channel in Settings (5.2).
        updates?.setChannel(updateChannelFor(updateChannel, app.getVersion()));
        if (interfaceZoom !== windowZoom) {
          windowZoom = interfaceZoom;
          // Every window of the app zooms (View › Zoom In Interface): Help's page only, as it has
          // the system's own title bar.
          for (const window of BrowserWindow.getAllWindows()) {
            if (helpWindows.is(window)) window.webContents.setZoomFactor(interfaceZoom);
            else {
              applyInterfaceZoom(window, interfaceZoom, {
                platform: process.platform,
                theme,
                workArea: screen.getDisplayMatching(window.getBounds()).workArea,
              });
            }
          }
        }
        if (theme === windowTheme) {
          return;
        }
        windowTheme = theme;
        // The native window controls follow the theme (macOS's traffic lights need nothing). The
        // Help window has the system's own title bar, and follows the theme in its page.
        for (const window of BrowserWindow.getAllWindows()) {
          if (helpWindows.is(window)) continue;
          window.setBackgroundColor(windowBackground(theme));
          if (process.platform !== "darwin") {
            window.setTitleBarOverlay(titleBarOverlay(theme, interfaceZoom));
          }
        }
        helpWindows.setTheme(theme);
      },
    );
    registerIpcHandler(ipcMain, "getAppInfo", isTrustedSender, () => ({
      name: t("app.name"),
      version: app.getVersion(),
    }));
    // On macOS the editor's menus are the menu bar's (LF-13): rebuilt as its commands change.
    registerIpcHandler(ipcMain, "setNativeMenus", isTrustedSender, (menus) => {
      if (process.platform !== "darwin") return null;
      const template = applicationMenu(process.platform, devServerUrl !== undefined, {
        menus,
        // Undo and Redo, whose keys the menu bar takes, act on the Help window when it's in front.
        run: (id) =>
          runMenuCommand(id, {
            focused: () => BrowserWindow.getFocusedWindow(),
            isOther: (window) => helpWindows.is(window),
            runInEditor: (command) =>
              lifecycle.mainWindow()?.webContents.send(appEvents.runCommand.channel, command),
          }),
      });
      Menu.setApplicationMenu(template === null ? null : Menu.buildFromTemplate(template));
      return null;
    });
    registerProjectHandlers(ipcMain, isTrustedSender, projectSession, dialogs.project, {
      recovery: { backups, dialogs: parts.recoveryDialogs },
      recent: recentSites,
      beforeSwitch: () => siteSwitch.leaveSite(),
      template: templates.template,
      flush: requestFlush,
    });
    registerCanvasHandlers(ipcMain, isTrustedSender, canvasStyles);
    registerSpellCheckHandlers(
      ipcMain,
      isTrustedSender,
      session.defaultSession,
      process.platform,
      app.getPreferredSystemLanguages(),
    );
    registerMediaHandlers(ipcMain, isTrustedSender, projectSession, dialogs.media);
    // Download and bundle (3.9): the only download besides fonts, on the person's click.
    registerBundleHandlers(
      ipcMain,
      isTrustedSender,
      projectSession,
      bundleNetworkFor(
        { fetch: electronBundleFetch(electron.net), resolve: resolveHost },
        app.isPackaged,
      ),
    );
    registerClipboardHandlers(
      ipcMain,
      isTrustedSender,
      elementClipboard,
      projectSession,
      (text) => electron.clipboard.writeText(text),
      (secret) => secretClipboard.copy(secret),
    );
    crashReports.registerHandlers(ipcMain, isTrustedSender);
    registerFailureLog(ipcMain, isTrustedSender);
    registerGuideHandlers(ipcMain, isTrustedSender, (url) => electron.shell.openExternal(url));
    // Help → Open-Source Licences (5.3): the build's notices, and Chromium's own.
    registerLicenceHandlers(
      ipcMain,
      isTrustedSender,
      licenceFiles({
        packaged: app.isPackaged,
        platform: process.platform,
        appPath: app.getAppPath(),
        resourcesPath: process.resourcesPath,
        execDir: dirname(process.execPath),
      }),
      (path) => electron.shell.openPath(path),
    );
    lifecycle.flushOnClose = createFlushOnClose(ipcMain, isTrustedSender, {
      // The flush has just run; capture the canvas for the Recent list before the window goes.
      beforeClose: () => siteSwitch.leaveSite(),
      onClosed: () => {
        if (lifecycle.quitting) app.quit();
      },
    });
    for (const feature of features) feature.register?.(ipcMain, isTrustedSender);
    // AI apps' requests go to the open site's window (F-AI-1); the MCP server (4.9) asks through it.
    const ai = registerAiHandlers(
      ipcMain,
      isTrustedSender,
      () => lifecycle.mainWindow(),
      projectSession,
    );
    exposeForE2eTests(ai, app.isPackaged);
    // AI apps' briefs (4.12a): main shows them in the window as the quick start, filled in.
    const briefs = createSiteBriefs({
      window: () => lifecycle.mainWindow(),
      templates: () => templates.briefTemplates(),
    });
    briefs.register(ipcMain, isTrustedSender);
    // AI apps on this computer reach it through the MCP server, while *AI apps* is on (4.9, ADR
    // 0021): nothing listens until the person turns it on.
    const service = createMcpService({
      apps: createAiApps(
        createJsonStore(join(app.getPath("userData"), "ai-apps.json"), aiAppsFileSchema, {
          empty: NO_AI_APPS,
          onDamaged: "move-aside",
        }),
        credentials,
      ),
      ask: (request) => ai.ask(request),
      briefs,
      info: { name: t("app.name"), version: app.getVersion() },
      // Version History's, for the site open now: none to save without one.
      saveVersionBefore: async (name) => {
        const open = projectSession.current();
        return open === null ? "failed" : versions.saveVersionBefore(open.sessionId, name);
      },
      opening: () => projectSession.current()?.sessionId,
    });
    mcp = service;
    void service.start().catch((error: unknown) => logFailure("mcp start", error));
    // Claude Desktop's extensions, in the person's own profile, with the bundled bridge.
    const extensions = createClaudeExtensions({
      dir: join(app.getPath("userData"), "ai-apps"),
      bridgeFile: app.isPackaged
        ? join(process.resourcesPath, "bridge", "webforge-bridge.mjs")
        : join(app.getAppPath(), "out", "bridge", "webforge-bridge.mjs"),
      version: app.getVersion(),
      // Looked up as they're called, so the E2E tests can stand in for Claude Desktop.
      open: (path) => electron.shell.openPath(path),
      show: (path) => electron.shell.showItemInFolder(path),
    });
    // Any left when Webforge last quit, with their proofs: they've been opened, or never will be.
    void extensions.sweep().catch((error: unknown) => logFailure("mcp claude extension", error));
    registerMcpHandlers(ipcMain, isTrustedSender, service, extensions);
    registerPublishHandlers(ipcMain, isTrustedSender, dialogs.publish, keyFiles);
    const versions = registerVersionsHandlers(ipcMain, isTrustedSender, {
      session: projectSession,
      dialogs: dialogs.project,
      captureCanvas: () => captureCanvas(lifecycle.mainWindow()),
      versionsKept: async () => versionsKept(),
      beforeSwitch: () => siteSwitch.leaveSite(),
      // Before main saves a version itself (`saveVersionBefore`, which 4.9's AI apps use).
      flush: requestFlush,
    });
    registerHelpHandlers(ipcMain, isTrustedSender, helpWindows, (url) =>
      electron.shell.openExternal(url),
    );
    // Netlify sign-in for publish destinations (4.2): the OAuth client ID is a build setting,
    // empty until Webforge's Netlify app is registered, when only a pasted token works.
    registerNetlifyHandlers(ipcMain, isTrustedSender, {
      signIns: createNetlifySignIns({
        clientId: import.meta.env.MAIN_VITE_NETLIFY_CLIENT_ID,
        // The E2E tests' stand-in for Netlify, in an app run from its build folder only.
        apiBase: netlifyApiFor(app.isPackaged),
        // Looked up as it's called: the E2E tests replace `shell.openExternal`.
        openExternal: (url) => electron.shell.openExternal(url),
      }),
      site: (sessionId) => projectSession.site(sessionId),
      secrets: publishSecrets,
    });
    markStartup("ipc-registered");
    registerPostsHandlers(ipcMain, isTrustedSender, filePostsParts(dialogs.posts.choosePostFiles));
    registerAssistantHandlers(ipcMain, isTrustedSender, unbuiltAssistant);
    // A site double-clicked in Explorer arrives as a command-line argument (P1).
    const projectToOpen = lifecycle.projectFromFinder ?? findProjectArgument(process.argv);
    if (projectToOpen !== undefined) {
      await openSite(projectToOpen);
      markStartup("site-opened");
    }
    createMainWindow(preferences);
    // With a site open, the canvas will want its CSS: its worker starts while the editor loads
    // (#894). Never for the start screen, which may never open a site.
    if (projectSession.current() !== null) canvasStyles.start();
    // The start-up's stages, in a perf build (#891).
    logStartupTimes(import.meta.env.MODE);
    void crashReports.noticeAfterLaunch();
    startUpdates();

    // macOS: a click on the Dock icon while no window is open. Webforge quits when its window
    // closes (spec/02 §1), so that is only between the last window closing and the app quitting.
    app.on("activate", () => {
      if (lifecycle.mainWindow() === undefined) {
        createMainWindow(preferences);
      }
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
        await mcp?.close().catch((error: unknown) => logFailure("mcp close", error));
        await projectSession.close();
      },
      // Then each feature's last work, such as My themes' and the Recent list's last writes, and
      // the preferences' last writes: a panel resized just before quitting keeps its size (#740).
      features: [...features, { quit: async () => await lifecycle.preferences?.idle() }],
      // Last, once all of that has finished: a downloaded update's installer (0.5a), which ends a
      // Webforge still running.
      install: () => updates?.installOnQuit(),
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
