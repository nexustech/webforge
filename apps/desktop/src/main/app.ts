import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { t } from "@webforge/i18n";
import type { ThemeTokens } from "@webforge/model";
import { readTemplates, type TemplateFolder } from "@webforge/templates/node";
import { type CatalogueFont, FONT_CATALOGUE, fontFacesFor } from "@webforge/themes";
import {
  type ThumbnailJob,
  type ThumbnailOutcome,
  thumbnailOutcomeSchema,
} from "../shared/export-worker-protocol.js";
import { appEvents } from "../shared/ipc/app.js";
import { MEDIA_SCHEME } from "../shared/ipc/media.js";
import { siteEvents } from "../shared/ipc/site.js";
import { openFailureMessage } from "../shared/open-failure.js";
import { exposeForE2eTests, registerAiHandlers } from "./ai-ipc.js";
import { AppLifecycle, closeThenExit } from "./app-lifecycle.js";
import { applicationMenu } from "./app-menu.js";
import { createBackupSchedule } from "./backup-schedule.js";
import { createBackups } from "./backups.js";
import { captureCanvas } from "./canvas-capture.js";
import { createCanvasStyles, registerCanvasHandlers } from "./canvas-css.js";
import { createElementClipboard, systemClipboard } from "./clipboard.js";
import { registerClipboardHandlers } from "./clipboard-ipc.js";
import type { startCrashReports } from "./crash-wiring.js";
import { createNativeDialogs } from "./dialogs.js";
import type { E2eDialog } from "./e2e-dialogs.js";
import { type RunExport, registerExportHandlers } from "./export-ipc.js";
import { createExportRunner } from "./export-worker-client.js";
import { registerFailureLog } from "./failure-ipc.js";
import { createFlushOnClose } from "./flush-on-close.js";
import { createFontLibrary, type FontLibrary, registerFontHandlers } from "./font-library.js";
import {
  catalogueFile,
  createFontReader,
  createFontResponder,
  FONT_SCHEME,
  type FontReader,
} from "./fonts.js";
import { createHandOff } from "./hand-off.js";
import { registerIpcHandler } from "./ipc.js";
import { logFailure } from "./log.js";
import { registerMediaHandlers } from "./media-ipc.js";
import { createMediaResponder } from "./media-protocol.js";
import { createMyThemes } from "./my-themes.js";
import { shippedTemplateReader } from "./new-site.js";
import {
  openPreferencesStore,
  type PreferencesStore,
  registerPreferencesHandlers,
} from "./preferences.js";
import { registerProjectHandlers } from "./project-ipc.js";
import { findProjectArgument, ProjectSession } from "./project-session.js";
import { createRecentSites } from "./recent-sites.js";
import { openOrRecover, type RecoveryDialogs } from "./recovery.js";
import {
  createSecureWebPreferences,
  hardenSession,
  hardenWebContents,
  isAppUrl,
} from "./security.js";
import { createSiteSwitch } from "./site-switch.js";
import {
  installContextMenu,
  registerSpellCheckHandlers,
  spellCheckAvailable,
} from "./spellcheck.js";
import { createStorageWriter, type WriterThread } from "./storage-writer.js";
import { registerTemplatesHandlers } from "./templates-ipc.js";
import { registerThemesHandlers } from "./themes-ipc.js";
import {
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
  const rendererHtml = join(parts.dir, "../renderer/index.html");
  const preloadScript = join(parts.dir, "../preload/index.cjs");
  const exportWorkerScript = join(parts.dir, "export-worker.js");
  const storageWriterScript = join(parts.dir, "storage-writer.js");

  // electron-vite sets ELECTRON_RENDERER_URL to the Vite dev server in development only.
  const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
  const appUrl = devServerUrl ?? pathToFileURL(rendererHtml).href;
  const isTrustedSender = (senderUrl: string) => isAppUrl(senderUrl, appUrl);

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
  protocol.registerSchemesAsPrivileged([
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, corsEnabled: true } },
    { scheme: FONT_SCHEME, privileges: { standard: true, secure: true, corsEnabled: true } },
  ]);

  app.on("web-contents-created", (_event, contents) => {
    hardenWebContents(contents, appUrl);
  });

  const lifecycle = new AppLifecycle(() => BrowserWindow.getAllWindows());

  // Rolling backups of the open site (F-SITE-6), the way back from a damaged file (1.7).
  const backups = createBackups({ root: join(app.getPath("userData"), "backups") });
  const backupSchedule = createBackupSchedule(backups);
  // The start screen's Recent list (F-SITE-2, 1.8).
  const recentSites = createRecentSites({ dir: app.getPath("userData") });
  // My themes (2.23): the person's own themes, for every site on this computer.
  const myThemes = createMyThemes({ dir: app.getPath("userData") });
  const projectSession = new ProjectSession(
    {
      opened: (access, path) => {
        void backupSchedule.opened(access, path);
        const name = projectSession.current()?.name;
        if (name !== undefined) recentSites.opened(path, name);
      },
      committed: () => {
        backupSchedule.committed();
        const path = projectSession.currentPath();
        if (path !== undefined) recentSites.edited(path);
      },
      closed: () => {
        backupSchedule.closed();
        // The export worker goes, and the images it kept in memory with it (R15).
        exports.close();
      },
    },
    // Imports are read, hashed and stored in a thread of their own (R13b, ADR 0013).
    { writer: createStorageWriter(() => parts.startStorageWriter(storageWriterScript)) },
  );

  // Before another site replaces the open one: save it, and capture its canvas for Recent.
  const siteSwitch = createSiteSwitch({
    currentPath: () => projectSession.currentPath(),
    requestFlush: async () => {
      const window = lifecycle.mainWindow();
      if (window !== undefined) await lifecycle.flushOnClose?.requestFlush(window);
    },
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

  const fonts = siteFonts(electron);

  // Copied elements, with their images' bytes kept in the user's data while the clipboard holds
  // them (1.25, R13d).
  const elementClipboard = createElementClipboard(
    systemClipboard(electron),
    join(app.getPath("userData"), "clipboard"),
  );

  // The templates New Site offers (2.14a), outside app.asar: in the packaged app's resources, or
  // where the build copied them while developing. The list is read once, when first shown; New Site
  // reads only the template it makes (2.15c), so a damaged one never stops Blank.
  const templatesDir = app.isPackaged
    ? join(process.resourcesPath, "templates")
    : join(app.getAppPath(), "out", "templates");
  let shippedTemplates: readonly TemplateFolder[] | undefined;
  const templates = () => {
    shippedTemplates ??= readTemplates(templatesDir);
    return shippedTemplates;
  };

  // Each export runs in its own utility process, so building never blocks the window (07). The
  // worker resolves nothing itself: it gets the site's font files, read and checked here, and asks
  // for each image and document as it reaches it, read from the open site (R15). Every worker's
  // crash becomes a local report (R3).
  const forkWorker = (serviceName: string) =>
    crashReports.watchWorker(electron.utilityProcess.fork(exportWorkerScript, [], { serviceName }));
  // One export worker while the site is open, keeping the images it encoded in memory (R15).
  const exports = createExportRunner(() => forkWorker("Webforge export"));
  const runExport: RunExport = async (snapshot, target, { signal, onProgress }) => {
    const families = await fonts.downloadedFamiliesOf(snapshot.theme);
    return exports.run(
      {
        type: "export",
        snapshot,
        ...target,
        fonts: fontFacesFor(snapshot.theme, [...FONT_CATALOGUE, ...families]).flatMap((face) => {
          const data = fonts.reader.read(face);
          return data === undefined ? [] : [{ file: face.file, data }];
        }),
        families,
      },
      { readMedia: (hash) => projectSession.readMedia(hash), signal, onProgress },
    );
  };

  // Media thumbnails are made in a long-lived worker too, started when first needed (1.16).
  const requestThumbnail = createWorkerRequests<ThumbnailOutcome, ThumbnailJob>(
    () => forkWorker("Webforge thumbnails"),
    thumbnailOutcomeSchema,
    60_000,
  );
  const respondWithMedia = createMediaResponder({
    readMedia: (hash) => projectSession.readMedia(hash),
    makeThumbnail: async (data, mimeType) => {
      const outcome = await requestThumbnail({ type: "thumbnail", mimeType, data });
      return outcome?.type === "thumbnail" ? outcome.data : undefined;
    },
  });

  // The canvas compiles its site CSS, and lists the classes the site supports (#276), in one
  // long-lived worker, started when first needed (1.12).
  const canvasStyles = createCanvasStyles(
    () => forkWorker("Webforge canvas styles"),
    undefined,
    fonts.downloadedFamiliesOf,
  );

  function createMainWindow(preferences: PreferencesStore): void {
    const { theme, window: saved } = preferences.get();
    const placement = mainWindowPlacement(
      saved,
      screen.getAllDisplays().map((display) => display.workArea),
    );
    const window = new BrowserWindow({
      title: t("app.name"),
      ...placement.bounds,
      minWidth: MIN_WINDOW_SIZE.width,
      minHeight: MIN_WINDOW_SIZE.height,
      // The renderer draws the title bar (1.2), in the person's theme.
      ...titleBarOptions(process.platform, theme),
      backgroundColor: windowBackground(theme),
      show: false,
      webPreferences: createSecureWebPreferences(
        preloadScript,
        spellCheckAvailable(process.platform),
      ),
    });
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
    const load =
      devServerUrl === undefined ? window.loadFile(rendererHtml) : window.loadURL(devServerUrl);
    // A failed or aborted load (e.g. a reload while loading) is not fatal; the window stays open.
    load.catch((error: unknown) => {
      logFailure("Webforge could not load the editor window", error);
    });
  }

  async function start(): Promise<void> {
    await app.whenReady();
    // No default menu: its zoom and reload keys are the editor's (F-ED-27).
    const menu = applicationMenu(process.platform, devServerUrl !== undefined);
    Menu.setApplicationMenu(menu === null ? null : Menu.buildFromTemplate(menu));
    hardenSession(session.defaultSession);
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
    registerPreferencesHandlers(ipcMain, isTrustedSender, preferences, ({ theme }) => {
      if (theme === windowTheme) {
        return;
      }
      windowTheme = theme;
      // The native window controls follow the theme (macOS's traffic lights need nothing).
      for (const window of BrowserWindow.getAllWindows()) {
        window.setBackgroundColor(windowBackground(theme));
        if (process.platform !== "darwin") {
          window.setTitleBarOverlay(titleBarOverlay(theme));
        }
      }
    });
    registerIpcHandler(ipcMain, "getAppInfo", isTrustedSender, () => ({
      name: t("app.name"),
      version: app.getVersion(),
    }));
    // On macOS the editor's menus are the menu bar's (LF-13): rebuilt as its commands change.
    registerIpcHandler(ipcMain, "setNativeMenus", isTrustedSender, (menus) => {
      if (process.platform !== "darwin") return null;
      const template = applicationMenu(process.platform, devServerUrl !== undefined, {
        menus,
        run: (id) => lifecycle.mainWindow()?.webContents.send(appEvents.runCommand.channel, id),
      });
      Menu.setApplicationMenu(template === null ? null : Menu.buildFromTemplate(template));
      return null;
    });
    registerProjectHandlers(ipcMain, isTrustedSender, projectSession, dialogs.project, {
      recovery: { backups, dialogs: parts.recoveryDialogs },
      recent: recentSites,
      beforeSwitch: () => siteSwitch.leaveSite(),
      template: shippedTemplateReader(templatesDir),
    });
    registerCanvasHandlers(ipcMain, isTrustedSender, canvasStyles);
    registerFontHandlers(ipcMain, isTrustedSender, fonts.downloaded());
    registerSpellCheckHandlers(
      ipcMain,
      isTrustedSender,
      session.defaultSession,
      process.platform,
      app.getPreferredSystemLanguages(),
    );
    registerMediaHandlers(ipcMain, isTrustedSender, projectSession, dialogs.media);
    registerClipboardHandlers(ipcMain, isTrustedSender, elementClipboard, projectSession);
    crashReports.registerHandlers(ipcMain, isTrustedSender);
    registerFailureLog(ipcMain, isTrustedSender);
    lifecycle.flushOnClose = createFlushOnClose(ipcMain, isTrustedSender, {
      // The flush has just run; capture the canvas for the Recent list before the window goes.
      beforeClose: () => siteSwitch.leaveSite(),
      onClosed: () => {
        if (lifecycle.quitting) app.quit();
      },
    });
    registerExportHandlers(ipcMain, isTrustedSender, {
      dialogs: dialogs.export,
      runExport,
      sendProgress: (progress) =>
        lifecycle.mainWindow()?.webContents.send(siteEvents.exportProgress.channel, progress),
      choices: {
        read: () => projectSession.exportChoices(),
        write: (choices) => projectSession.setExportChoices(choices),
      },
      // Looked up as it's called: the E2E tests replace `shell.openPath`, so no browser opens.
      open: async ({ destination, format }) => {
        if (format === "zip") {
          if (!existsSync(destination)) return "missing";
          electron.shell.showItemInFolder(destination);
          return "opened";
        }
        // An error message, rather than a throw, when the folder was moved or deleted.
        const failed = await electron.shell.openPath(join(destination, "index.html"));
        return failed === "" ? "opened" : "missing";
      },
      currentSite: () => projectSession.currentPath(),
    });
    registerTemplatesHandlers(ipcMain, isTrustedSender, templates);
    // AI apps' requests go to the open site's window (F-AI-1); the MCP server (4.9) asks through it.
    const ai = registerAiHandlers(ipcMain, isTrustedSender, () => lifecycle.mainWindow());
    exposeForE2eTests(ai, app.isPackaged);
    registerThemesHandlers(ipcMain, isTrustedSender, myThemes);
    // A site double-clicked in Explorer arrives as a command-line argument (P1).
    const projectToOpen = lifecycle.projectFromFinder ?? findProjectArgument(process.argv);
    if (projectToOpen !== undefined) {
      await openSite(projectToOpen);
    }
    createMainWindow(preferences);
    void crashReports.noticeAfterLaunch();

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
      // And My themes' last write, if one is under way (2.23).
      close: async () => {
        await projectSession.close();
        await myThemes.idle();
      },
      // The site is saved and closed: a launch from now on opens Webforge itself, rather than
      // handing its site to this one, which on a busy computer can take up to a minute more to
      // end (#413).
      releaseLock: () => {
        if (primaryInstance) app.releaseSingleInstanceLock();
      },
      exit: (code) => app.exit(code),
    });
  });

  // Webforge quits when its window closes, on macOS too (spec/02 §1, #287): it's a one-window
  // app, and one left in the Dock with no window looks broken to the people it's for.
  app.on("window-all-closed", () => {
    app.quit();
  });

  return started;
}

/**
 * The site's fonts (2.2): the installer's, outside app.asar, and those downloaded on demand into
 * the user's data. Every font file is checked before it's used: the installer's against the
 * catalogue, a downloaded one against what its download measured.
 */
function siteFonts({ app, net }: Pick<AppElectron, "app" | "net">) {
  // In the packaged app's resources, or where the build copied them while developing.
  const bundled = createFontReader(
    app.isPackaged ? join(process.resourcesPath, "fonts") : join(app.getAppPath(), "out", "fonts"),
  );
  let library: FontLibrary | undefined;
  /** The fonts downloaded on demand, made when first needed, once Electron is ready. */
  const downloaded = (): FontLibrary => {
    library ??= createFontLibrary({
      dir: join(app.getPath("userData"), "fonts"),
      // Looked up at call time, so the E2E tests can stand in for Fontsource, or cut it off.
      fetch: (url, init) => net.fetch(url, init),
    });
    return library;
  };
  const reader: FontReader = {
    read: (face) =>
      catalogueFile(face.file) === undefined ? downloaded().reader.read(face) : bundled.read(face),
  };
  return {
    downloaded,
    reader,
    respondWithFont: createFontResponder(
      reader,
      (name) => catalogueFile(name) ?? downloaded().file(name),
    ),
    /** The downloaded families `theme` sets its headings or text in: the canvas and an export need them. */
    async downloadedFamiliesOf(theme: ThemeTokens): Promise<CatalogueFont[]> {
      const used = [theme.fonts.heading.family, theme.fonts.body.family];
      return (await downloaded().downloaded()).filter((family) => used.includes(family.family));
    },
  };
}
