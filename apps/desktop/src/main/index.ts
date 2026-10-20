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
  type SaveDialogOptions,
  session,
  utilityProcess,
} from "electron";
import { createCanvasCssCompiler, registerCanvasHandlers } from "./canvas-css.js";
import { type ExportDialogs, registerExportHandlers } from "./export-ipc.js";
import { runExportInWorker } from "./export-worker-client.js";
import { registerIpcHandler } from "./ipc.js";
import { type ProjectDialogs, registerProjectHandlers } from "./project-ipc.js";
import { findProjectArgument, PROJECT_EXTENSION, ProjectSession } from "./project-session.js";
import {
  createSecureWebPreferences,
  hardenSession,
  hardenWebContents,
  isAppUrl,
} from "./security.js";
import { titleBarOptions, windowBackground } from "./window-options.js";

// Process wiring only; the logic lives in tested modules and E2E tests cover this file.

const rendererHtml = join(import.meta.dirname, "../renderer/index.html");
const preloadScript = join(import.meta.dirname, "../preload/index.cjs");
const exportWorkerScript = join(import.meta.dirname, "export-worker.js");

// electron-vite sets ELECTRON_RENDERER_URL to the Vite dev server in development only.
const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
const appUrl = devServerUrl ?? pathToFileURL(rendererHtml).href;

// Sandbox every renderer, including any created later by dependencies.
app.enableSandbox();

app.on("web-contents-created", (_event, contents) => {
  hardenWebContents(contents, appUrl);
});

const projectSession = new ProjectSession();
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

function createMainWindow(): void {
  const window = new BrowserWindow({
    title: t("app.name"),
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    // The renderer draws the title bar (1.2). Dark until the theme preference arrives.
    ...titleBarOptions(process.platform, "dark"),
    backgroundColor: windowBackground("dark"),
    show: false,
    webPreferences: createSecureWebPreferences(preloadScript),
  });
  window.once("ready-to-show", () => {
    window.show();
  });
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
  );
  registerCanvasHandlers(ipcMain, (senderUrl) => isAppUrl(senderUrl, appUrl), compileCanvasCss);
  registerExportHandlers(
    ipcMain,
    (senderUrl) => isAppUrl(senderUrl, appUrl),
    exportDialogs,
    runExport,
  );
  // A site double-clicked in Explorer arrives as a command-line argument (P1).
  const projectToOpen = projectFromFinder ?? findProjectArgument(process.argv);
  if (projectToOpen !== undefined) {
    projectSession.open(projectToOpen);
  }
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

// macOS delivers a site double-clicked in Finder (P1) as an event, possibly before "ready".
let projectFromFinder: string | undefined;
app.on("open-file", (event, path) => {
  event.preventDefault();
  if (app.isReady()) {
    projectSession.open(path);
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
