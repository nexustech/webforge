import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { t } from "@webforge/i18n";
import { app, BrowserWindow, ipcMain, session } from "electron";
import { registerIpcHandler } from "./ipc.js";
import {
  createSecureWebPreferences,
  hardenSession,
  hardenWebContents,
  isAppUrl,
} from "./security.js";

// Process wiring only; the logic lives in tested modules and E2E tests cover this file.

const rendererHtml = join(import.meta.dirname, "../renderer/index.html");
const preloadScript = join(import.meta.dirname, "../preload/index.cjs");

// electron-vite sets ELECTRON_RENDERER_URL to the Vite dev server in development only.
const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
const appUrl = devServerUrl ?? pathToFileURL(rendererHtml).href;

// Sandbox every renderer, including any created later by dependencies.
app.enableSandbox();

app.on("web-contents-created", (_event, contents) => {
  hardenWebContents(contents, appUrl);
});

function createMainWindow(): void {
  const window = new BrowserWindow({
    title: t("app.name"),
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
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
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

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
