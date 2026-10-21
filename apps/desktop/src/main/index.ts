import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { t } from "@webforge/i18n";
import type { SiteSnapshot } from "@webforge/model";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type OpenDialogOptions,
  type Rectangle,
  type SaveDialogOptions,
  session,
  utilityProcess,
  type WebContents,
} from "electron";
import { z } from "zod";
import { createBackupSchedule } from "./backup-schedule.js";
import { createBackups } from "./backups.js";
import { createCanvasCssCompiler, registerCanvasHandlers } from "./canvas-css.js";
import { startCrashReports } from "./crash-wiring.js";
import { type ExportDialogs, registerExportHandlers } from "./export-ipc.js";
import { runExportInWorker } from "./export-worker-client.js";
import { createFlushOnClose } from "./flush-on-close.js";
import { registerIpcHandler } from "./ipc.js";
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
import { titleBarOptions, titleBarOverlay, windowBackground } from "./window-options.js";

// Process wiring only; the logic lives in tested modules and E2E tests cover this file.

const rendererHtml = join(import.meta.dirname, "../renderer/index.html");
const preloadScript = join(import.meta.dirname, "../preload/index.cjs");
const exportWorkerScript = join(import.meta.dirname, "export-worker.js");

// electron-vite sets ELECTRON_RENDERER_URL to the Vite dev server in development only.
const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
const appUrl = devServerUrl ?? pathToFileURL(rendererHtml).href;

// Local crash reports first, so even a failing start-up leaves one (F-SITE-7).
const crashReports = startCrashReports();

// Sandbox every renderer, including any created later by dependencies.
app.enableSandbox();

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
    if (window === undefined || window.isDestroyed()) return undefined;
    const image = await window.webContents.capturePage(await canvasArea(window.webContents));
    return image.isEmpty() ? undefined : image.resize({ width: 480 }).toJPEG(75);
  },
  recent: recentSites,
});
const openSite = (path: string) => openOrRecover(projectSession, path, backups, recoveryDialogs);

// Set once the user quits, so a window that held its close back for a last save quits the app
// afterwards (macOS keeps the app running when its last window closes).
let quitting = false;
app.on("before-quit", () => {
  quitting = true;
});
let flushOnClose: ReturnType<typeof createFlushOnClose> | undefined;
const projectFilters = [{ name: t("site.fileType"), extensions: [PROJECT_EXTENSION.slice(1)] }];

// Dialogs are modal to the focused window. E2E tests replace dialog.showSaveDialog and
// dialog.showOpenDialog, so look them up on the module at call time.
const projectDialogs: ProjectDialogs = {
  chooseNewProjectPath: async () => {
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

// Each export runs in its own utility process, so building never blocks the window (07).
const runExport = (snapshot: SiteSnapshot, destination: string) =>
  runExportInWorker(
    () => utilityProcess.fork(exportWorkerScript, [], { serviceName: "Webforge export" }),
    { type: "export", snapshot, destination },
  );

// The canvas compiles its site CSS in one long-lived worker, started when first needed (1.12).
const compileCanvasCss = createCanvasCssCompiler(() =>
  utilityProcess.fork(exportWorkerScript, [], { serviceName: "Webforge canvas styles" }),
);

function createMainWindow(preferences: PreferencesStore): void {
  const { theme } = preferences.get();
  const window = new BrowserWindow({
    title: t("app.name"),
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    // The renderer draws the title bar (1.2), in the person's theme.
    ...titleBarOptions(process.platform, theme),
    backgroundColor: windowBackground(theme),
    show: false,
    webPreferences: createSecureWebPreferences(preloadScript),
  });
  window.once("ready-to-show", () => {
    window.show();
  });
  // Autosave writes the last changes before the window closes (P2).
  flushOnClose?.install(window);
  const load =
    devServerUrl === undefined ? window.loadFile(rendererHtml) : window.loadURL(devServerUrl);
  // A failed or aborted load (e.g. a reload while loading) is not fatal; the window stays open.
  load.catch((error: unknown) => {
    console.error("Webforge could not load the editor window", error);
  });
}

async function start(): Promise<void> {
  await app.whenReady();
  hardenSession(session.defaultSession);
  const preferences = await openPreferencesStore(join(app.getPath("userData"), "preferences.json"));
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
  registerCanvasHandlers(ipcMain, (senderUrl) => isAppUrl(senderUrl, appUrl), compileCanvasCss);
  crashReports.registerHandlers(ipcMain, (senderUrl) => isAppUrl(senderUrl, appUrl));
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
  );
  // A site double-clicked in Explorer arrives as a command-line argument (P1).
  const projectToOpen = projectFromFinder ?? findProjectArgument(process.argv);
  if (projectToOpen !== undefined) {
    await openSite(projectToOpen);
  }
  createMainWindow(preferences);
  void crashReports.noticeAfterLaunch();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(preferences);
    }
  });
}

// macOS delivers a site double-clicked in Finder (P1) as an event, possibly before "ready".
let projectFromFinder: string | undefined;
app.on("open-file", (event, path) => {
  event.preventDefault();
  if (app.isReady()) {
    void openSite(path);
  } else {
    projectFromFinder = path;
  }
});

app.on("will-quit", () => {
  projectSession.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// No top-level await: Electron emits "ready" only after the ESM entry module has finished
// evaluating, so awaiting whenReady() at the top level would never resolve.
start().catch((error: unknown) => {
  console.error("Webforge failed to start", error);
  app.exit(1);
});
