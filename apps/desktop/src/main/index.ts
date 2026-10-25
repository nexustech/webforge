import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { t } from "@webforge/i18n";
import { DOCUMENT_EXTENSIONS, type SiteSnapshot, type ThemeTokens } from "@webforge/model";
import { readTemplates, type TemplateFolder } from "@webforge/templates/node";
import { type CatalogueFont, FONT_CATALOGUE, fontFacesFor } from "@webforge/themes";
import {
  app,
  BrowserWindow,
  ClipboardItem,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  net,
  type OpenDialogOptions,
  protocol,
  type Rectangle,
  type SaveDialogOptions,
  screen,
  session,
  utilityProcess,
  type WebContents,
} from "electron";
import { z } from "zod";
import { thumbnailOutcomeSchema } from "../shared/export-worker-protocol.js";
import { appEvents } from "../shared/ipc/app.js";
import { MEDIA_SCHEME } from "../shared/ipc/media.js";
import { openFailureMessage } from "../shared/open-failure.js";
import { applicationMenu } from "./app-menu.js";
import { createBackupSchedule } from "./backup-schedule.js";
import { createBackups } from "./backups.js";
import { createCanvasStyles, registerCanvasHandlers } from "./canvas-css.js";
import { createElementClipboard, systemClipboard } from "./clipboard.js";
import { registerClipboardHandlers } from "./clipboard-ipc.js";
import { startCrashReports } from "./crash-wiring.js";
import type { E2eDialog } from "./e2e-dialogs.js";
import { type ExportDialogs, registerExportHandlers } from "./export-ipc.js";
import { runExportInWorker } from "./export-worker-client.js";
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
import { logFailure, setLogSink } from "./log.js";
import { fileLogSink } from "./log-file.js";
import { type MediaDialogs, registerMediaHandlers } from "./media-ipc.js";
import { createMediaResponder } from "./media-protocol.js";
import {
  openPreferencesStore,
  type PreferencesStore,
  registerPreferencesHandlers,
} from "./preferences.js";
import { type ProjectDialogs, registerProjectHandlers } from "./project-ipc.js";
import { findProjectArgument, PROJECT_EXTENSION, ProjectSession } from "./project-session.js";
import { createRecentSites } from "./recent-sites.js";
import { openOrRecover } from "./recovery.js";
import { recoveryDialogs } from "./recovery-dialogs.js";
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
import { registerTemplatesHandlers } from "./templates-ipc.js";
import {
  MIN_WINDOW_SIZE,
  mainWindowPlacement,
  titleBarOptions,
  titleBarOverlay,
  windowBackground,
} from "./window-options.js";
import { createWorkerRequests } from "./worker-requests.js";

// Process wiring only; the logic lives in tested modules and E2E tests cover this file.

// From the first moment, logs go to the app's log file (standards §4): codes only, never content.
setLogSink(fileLogSink(app.isPackaged));

const rendererHtml = join(import.meta.dirname, "../renderer/index.html");
const preloadScript = join(import.meta.dirname, "../preload/index.cjs");
const exportWorkerScript = join(import.meta.dirname, "export-worker.js");

// electron-vite sets ELECTRON_RENDERER_URL to the Vite dev server in development only.
const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
const appUrl = devServerUrl ?? pathToFileURL(rendererHtml).href;

// One Webforge at a time (1.8): a second launch, e.g. a .wforge double-clicked in Explorer while
// Webforge is open, hands its command line to this one ("second-instance") and quits.
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) {
  app.quit();
}

// Local crash reports first, so even a failing start-up leaves one (F-SITE-7).
const crashReports = startCrashReports(primaryInstance);

// Sandbox every renderer, including any created later by dependencies.
app.enableSandbox();

// Media images (1.16) and the site's fonts (2.2) reach the editor through schemes of their own,
// which must be known before "ready". Fonts load in CORS mode.
protocol.registerSchemesAsPrivileged([
  { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true } },
  { scheme: FONT_SCHEME, privileges: { standard: true, secure: true, corsEnabled: true } },
]);

app.on("web-contents-created", (_event, contents) => {
  hardenWebContents(contents, appUrl);
});

// Rolling backups of the open site (F-SITE-6), the way back from a damaged file (1.7).
const backups = createBackups({ root: join(app.getPath("userData"), "backups") });
const backupSchedule = createBackupSchedule(backups);
// The start screen's Recent list (F-SITE-2, 1.8).
const recentSites = createRecentSites({ dir: app.getPath("userData") });
const projectSession = new ProjectSession({
  opened: (store, path) => {
    void backupSchedule.opened(store, path);
    recentSites.opened(path, store.info.name);
  },
  committed: () => {
    backupSchedule.committed();
    const path = projectSession.currentPath();
    if (path !== undefined) recentSites.edited(path);
  },
  closed: () => backupSchedule.closed(),
});
const canvasAreaSchema = z.object({
  x: z.number().transform(Math.round),
  y: z.number().transform(Math.round),
  width: z.number().positive().transform(Math.round),
  height: z.number().positive().transform(Math.round),
});

/** Where the canvas is in the window, so the Recent thumbnail shows the page, not the panels. */
async function canvasArea(contents: WebContents): Promise<Rectangle | undefined> {
  const area: unknown = await contents
    .executeJavaScript(
      `(() => { const r = document.querySelector(".editor__canvas iframe")?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; })()`,
    )
    .catch(() => null);
  const parsed = canvasAreaSchema.safeParse(area);
  return parsed.success ? parsed.data : undefined;
}

// Before another site replaces the open one: save it, and capture its canvas for Recent.
const siteSwitch = createSiteSwitch({
  currentPath: () => projectSession.currentPath(),
  requestFlush: async () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window !== undefined) await flushOnClose?.requestFlush(window);
  },
  capture: async () => {
    const window = BrowserWindow.getAllWindows()[0];
    // A crashed renderer has no canvas to show.
    if (window === undefined || window.isDestroyed() || window.webContents.isCrashed()) {
      return undefined;
    }
    const image = await window.webContents.capturePage(await canvasArea(window.webContents));
    return image.isEmpty() ? undefined : image.resize({ width: 480 }).toJPEG(75);
  },
  recent: recentSites,
});
const openSite = (path: string) => openOrRecover(projectSession, path, backups, recoveryDialogs);

// The preferences, once start() has read them; a window can't be created before.
let preferencesStore: PreferencesStore | undefined;

/** Brings the window to the front; `undefined` if there is none (macOS, after closing it). */
function focusMainWindow(): BrowserWindow | undefined {
  const window = BrowserWindow.getAllWindows()[0];
  if (window !== undefined) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
  return window;
}

// Sites handed over while Webforge runs: saved, then replaced in the same window (1.8).
const handOff = createHandOff({
  currentPath: () => projectSession.currentPath(),
  leaveSite: () => siteSwitch.leaveSite(),
  open: openSite,
  focus: () => {
    focusMainWindow();
  },
  show: (reload) => {
    // A hand-off that finishes while the app quits must not bring a window back.
    if (quitting) return;
    const window = focusMainWindow();
    if (window === undefined) {
      // A new window loads the site that is open now.
      if (preferencesStore !== undefined) createMainWindow(preferencesStore);
    } else if (reload) {
      window.webContents.reload();
    }
  },
  failed: async (reason) => {
    const options = { type: "warning" as const, message: openFailureMessage(reason) };
    const parent = BrowserWindow.getAllWindows()[0];
    await (parent === undefined
      ? dialog.showMessageBox(options)
      : dialog.showMessageBox(parent, options));
  },
});

// Set once the user quits, so a window that held its close back for a last save quits the app
// afterwards (macOS keeps the app running when its last window closes).
let quitting = false;
app.on("before-quit", () => {
  quitting = true;
});
let flushOnClose: ReturnType<typeof createFlushOnClose> | undefined;
const projectFilters = [{ name: t("site.fileType"), extensions: [PROJECT_EXTENSION.slice(1)] }];

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

// Dialogs are modal to the focused window. E2E tests replace dialog.showSaveDialog and
// dialog.showOpenDialog, so look them up on the module at call time.
const projectDialogs: ProjectDialogs = {
  chooseNewProjectPath: async () => {
    const answer = await testDialogAnswer("save");
    if (answer !== undefined) return answer.path;
    const options: SaveDialogOptions = {
      title: t("site.newDialogTitle"),
      defaultPath: `${t("site.untitledName")}${PROJECT_EXTENSION}`,
      filters: projectFilters,
    };
    const parent = BrowserWindow.getFocusedWindow();
    const result = await (parent === null
      ? dialog.showSaveDialog(options)
      : dialog.showSaveDialog(parent, options));
    return result.canceled || result.filePath === "" ? undefined : result.filePath;
  },
  chooseProjectToOpen: async () => {
    const answer = await testDialogAnswer("open");
    if (answer !== undefined) return answer.path;
    const options: OpenDialogOptions = {
      title: t("site.openDialogTitle"),
      filters: projectFilters,
      properties: ["openFile"],
    };
    const parent = BrowserWindow.getFocusedWindow();
    const result = await (parent === null
      ? dialog.showOpenDialog(options)
      : dialog.showOpenDialog(parent, options));
    return result.canceled ? undefined : result.filePaths[0];
  },
};

const exportDialogs: ExportDialogs = {
  chooseExportFolder: async () => {
    const answer = await testDialogAnswer("folder");
    if (answer !== undefined) return answer.path;
    const options: OpenDialogOptions = {
      title: t("export.dialogTitle"),
      properties: ["openDirectory", "createDirectory", "promptToCreate"],
    };
    const parent = BrowserWindow.getFocusedWindow();
    const result = await (parent === null
      ? dialog.showOpenDialog(options)
      : dialog.showOpenDialog(parent, options));
    return result.canceled ? undefined : result.filePaths[0];
  },
};

// The templates New Site offers (2.14a), outside app.asar: in the packaged app's resources, or
// where the build copied them while developing. Read once, when first listed or used.
const templatesDir = app.isPackaged
  ? join(process.resourcesPath, "templates")
  : join(app.getAppPath(), "out", "templates");
let shippedTemplates: readonly TemplateFolder[] | undefined;
const templates = () => {
  shippedTemplates ??= readTemplates(templatesDir);
  return shippedTemplates;
};

// The installer's fonts, outside app.asar (2.2): in the packaged app's resources, or where the
// build copied them while developing.
const bundledFonts = createFontReader(
  app.isPackaged ? join(process.resourcesPath, "fonts") : join(app.getAppPath(), "out", "fonts"),
);

let fontLibrary: FontLibrary | undefined;
/** The fonts downloaded on demand (2.2), in the user's data; made when first needed, once ready. */
const downloadedFonts = (): FontLibrary => {
  fontLibrary ??= createFontLibrary({
    dir: join(app.getPath("userData"), "fonts"),
    // Looked up at call time, so the E2E tests can stand in for Fontsource, or cut it off.
    fetch: (url, init) => net.fetch(url, init),
  });
  return fontLibrary;
};

// Every font file is checked before it's used: the installer's against the catalogue, a
// downloaded one against what its download measured.
const fonts: FontReader = {
  read: (face) =>
    catalogueFile(face.file) === undefined
      ? downloadedFonts().reader.read(face)
      : bundledFonts.read(face),
};
const respondWithFont = createFontResponder(
  fonts,
  (name) => catalogueFile(name) ?? downloadedFonts().file(name),
);

/** The downloaded families `theme` sets its headings or text in: the canvas and an export need them. */
async function downloadedFamiliesOf(theme: ThemeTokens): Promise<CatalogueFont[]> {
  const used = [theme.fonts.heading.family, theme.fonts.body.family];
  return (await downloadedFonts().downloaded()).filter((family) => used.includes(family.family));
}

// Each export runs in its own utility process, so building never blocks the window (07). The
// worker resolves nothing itself: it gets the site's font files, read and checked here. Every
// worker's crash becomes a local report (R3).
const runExport = async (snapshot: SiteSnapshot, destination: string) => {
  const families = await downloadedFamiliesOf(snapshot.theme);
  return runExportInWorker(
    () =>
      crashReports.watchWorker(
        utilityProcess.fork(exportWorkerScript, [], { serviceName: "Webforge export" }),
      ),
    {
      type: "export",
      snapshot,
      destination,
      fonts: fontFacesFor(snapshot.theme, [...FONT_CATALOGUE, ...families]).flatMap((face) => {
        const data = fonts.read(face);
        return data === undefined ? [] : [{ file: face.file, data }];
      }),
      families,
    },
  );
};

// Media thumbnails are made in a long-lived worker too, started when first needed (1.16).
const requestThumbnail = createWorkerRequests(
  () =>
    crashReports.watchWorker(
      utilityProcess.fork(exportWorkerScript, [], { serviceName: "Webforge thumbnails" }),
    ),
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

const mediaDialogs: MediaDialogs = {
  chooseMediaFiles: async () => {
    const options: OpenDialogOptions = {
      title: t("site.media.chooseTitle"),
      filters: [
        {
          name: t("site.media.fileType"),
          extensions: ["jpg", "jpeg", "png", ...Object.values(DOCUMENT_EXTENSIONS)],
        },
      ],
      properties: ["openFile", "multiSelections"],
    };
    const parent = BrowserWindow.getFocusedWindow();
    const result = await (parent === null
      ? dialog.showOpenDialog(options)
      : dialog.showOpenDialog(parent, options));
    return result.canceled ? undefined : result.filePaths;
  },
};

// The canvas compiles its site CSS, and lists the classes the site supports (#276), in one
// long-lived worker, started when first needed (1.12).
const canvasStyles = createCanvasStyles(
  () =>
    crashReports.watchWorker(
      utilityProcess.fork(exportWorkerScript, [], { serviceName: "Webforge canvas styles" }),
    ),
  undefined,
  downloadedFamiliesOf,
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
  // Maximised the first time, so the canvas gets the room (ADR 0008). Maximising shows the window
  // at once, in the theme's background colour; the editor then lays out at its final size, instead
  // of at 1280 × 800 and again when the window grows.
  if (placement.maximized) {
    window.maximize();
  }
  window.once("ready-to-show", () => {
    window.show();
  });
  rememberWindowState(window, preferences);
  // Autosave writes the last changes before the window closes (P2).
  flushOnClose?.install(window);
  const load =
    devServerUrl === undefined ? window.loadFile(rendererHtml) : window.loadURL(devServerUrl);
  // A failed or aborted load (e.g. a reload while loading) is not fatal; the window stays open.
  load.catch((error: unknown) => {
    logFailure("Webforge could not load the editor window", error);
  });
}

/**
 * Remembers whether the person keeps the window maximised and its size and place when not, as
 * they change it and when it closes, so the next start opens it the same way.
 */
function rememberWindowState(window: BrowserWindow, preferences: PreferencesStore): void {
  let pending: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(pending);
    pending = undefined;
    if (window.isDestroyed() || window.isMinimized()) {
      return;
    }
    const { x, y, width, height } = window.getNormalBounds();
    const bounds = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
    // Full screen (macOS's green button) counts as maximised.
    const state = { maximized: window.isMaximized() || window.isFullScreen(), bounds };
    preferences.set({ window: state }).catch((error: unknown) => {
      logFailure("Webforge could not remember the window size", error);
    });
  };
  // On macOS "moved" fires all through a drag, so moves and resizes are saved once they stop.
  const saveSoon = () => {
    clearTimeout(pending);
    pending = setTimeout(save, 500);
  };
  window.on("maximize", save);
  window.on("unmaximize", save);
  window.on("enter-full-screen", save);
  window.on("leave-full-screen", save);
  window.on("resized", saveSoon);
  window.on("moved", saveSoon);
  window.on("close", save);
}

async function start(): Promise<void> {
  await app.whenReady();
  // No default menu: its zoom and reload keys are the editor's (F-ED-27).
  const menu = applicationMenu(process.platform, devServerUrl !== undefined);
  Menu.setApplicationMenu(menu === null ? null : Menu.buildFromTemplate(menu));
  hardenSession(session.defaultSession);
  session.defaultSession.protocol.handle(MEDIA_SCHEME, (request) => respondWithMedia(request.url));
  session.defaultSession.protocol.handle(FONT_SCHEME, (request) => respondWithFont(request.url));
  const preferences = await openPreferencesStore(join(app.getPath("userData"), "preferences.json"));
  preferencesStore = preferences;
  let windowTheme = preferences.get().theme;
  registerPreferencesHandlers(
    ipcMain,
    (senderUrl) => isAppUrl(senderUrl, appUrl),
    preferences,
    ({ theme }) => {
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
    },
  );
  registerIpcHandler(
    ipcMain,
    "getAppInfo",
    (senderUrl) => isAppUrl(senderUrl, appUrl),
    () => ({ name: t("app.name"), version: app.getVersion() }),
  );
  // On macOS the editor's menus are the menu bar's (LF-13): rebuilt as its commands change.
  registerIpcHandler(
    ipcMain,
    "setNativeMenus",
    (senderUrl) => isAppUrl(senderUrl, appUrl),
    (menus) => {
      if (process.platform !== "darwin") return null;
      const template = applicationMenu(process.platform, devServerUrl !== undefined, {
        menus,
        run: (id) =>
          BrowserWindow.getAllWindows()[0]?.webContents.send(appEvents.runCommand.channel, id),
      });
      Menu.setApplicationMenu(template === null ? null : Menu.buildFromTemplate(template));
      return null;
    },
  );
  registerProjectHandlers(
    ipcMain,
    (senderUrl) => isAppUrl(senderUrl, appUrl),
    projectSession,
    projectDialogs,
    {
      recovery: { backups, dialogs: recoveryDialogs },
      recent: recentSites,
      beforeSwitch: () => siteSwitch.leaveSite(),
    },
  );
  registerCanvasHandlers(ipcMain, (senderUrl) => isAppUrl(senderUrl, appUrl), canvasStyles);
  registerFontHandlers(ipcMain, (senderUrl) => isAppUrl(senderUrl, appUrl), downloadedFonts());
  registerSpellCheckHandlers(
    ipcMain,
    (senderUrl) => isAppUrl(senderUrl, appUrl),
    session.defaultSession,
    process.platform,
    app.getPreferredSystemLanguages(),
  );
  registerMediaHandlers(
    ipcMain,
    (senderUrl) => isAppUrl(senderUrl, appUrl),
    projectSession,
    mediaDialogs,
  );
  registerClipboardHandlers(
    ipcMain,
    (senderUrl) => isAppUrl(senderUrl, appUrl),
    createElementClipboard(
      systemClipboard({ clipboard, ClipboardItem }),
      join(app.getPath("userData"), "clipboard"),
    ),
    projectSession,
  );
  crashReports.registerHandlers(ipcMain, (senderUrl) => isAppUrl(senderUrl, appUrl));
  registerFailureLog(ipcMain, (senderUrl) => isAppUrl(senderUrl, appUrl));
  flushOnClose = createFlushOnClose(ipcMain, (senderUrl) => isAppUrl(senderUrl, appUrl), {
    // The flush has just run; capture the canvas for the Recent list before the window goes.
    beforeClose: () => siteSwitch.leaveSite(),
    onClosed: () => {
      if (quitting) app.quit();
    },
  });
  registerExportHandlers(
    ipcMain,
    (senderUrl) => isAppUrl(senderUrl, appUrl),
    exportDialogs,
    runExport,
    (hash) => projectSession.readMedia(hash),
  );
  registerTemplatesHandlers(ipcMain, (senderUrl) => isAppUrl(senderUrl, appUrl), templates);
  // A site double-clicked in Explorer arrives as a command-line argument (P1).
  const projectToOpen = projectFromFinder ?? findProjectArgument(process.argv);
  if (projectToOpen !== undefined) {
    await openSite(projectToOpen);
  }
  createMainWindow(preferences);
  void crashReports.noticeAfterLaunch();

  // macOS: a click on the Dock icon while no window is open. Webforge quits when its window closes
  // (spec/02 §1), so that is only between the last window closing and the app quitting.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(preferences);
    }
  });
}

// macOS delivers a site double-clicked in Finder (P1) as an event, possibly before "ready"; once
// Webforge runs, it is handed over like a second launch's.
let projectFromFinder: string | undefined;
app.on("open-file", (event, path) => {
  event.preventDefault();
  if (app.isReady()) {
    void started.then(() => handOff.open(path));
  } else {
    projectFromFinder = path;
  }
});

app.on("second-instance", (_event, argv, workingDirectory) => {
  const path = findProjectArgument(argv);
  // A path typed in a terminal is relative to where that launch ran, not to this process.
  void started.then(() =>
    handOff.open(path === undefined ? undefined : resolve(workingDirectory, path)),
  );
});

app.on("will-quit", () => {
  projectSession.close();
  // The site is saved and closed: a launch from now on opens Webforge itself, rather than handing
  // its site to this one, which on a busy computer can take up to a minute more to end (#413).
  if (primaryInstance) app.releaseSingleInstanceLock();
});

// Webforge quits when its window closes, on macOS too (spec/02 §1, #287): it's a one-window app,
// and one left in the Dock with no window looks broken to the people it's for.
app.on("window-all-closed", () => {
  app.quit();
});

// No top-level await: Electron emits "ready" only after the ESM entry module has finished
// evaluating, so awaiting whenReady() at the top level would never resolve. A second instance
// never starts: it is quitting.
const started = primaryInstance ? start() : new Promise<void>(() => undefined);
started.catch((error: unknown) => {
  logFailure("Webforge failed to start", error);
  app.exit(1);
});
