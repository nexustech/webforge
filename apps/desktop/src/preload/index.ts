import { contextBridge, ipcRenderer, webUtils } from "electron";
import { createWebforgeApi } from "./api.js";

// Expose only the typed API, never ipcRenderer itself.
contextBridge.exposeInMainWorld(
  "webforge",
  createWebforgeApi(
    (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    (channel, listener) => {
      // Never hand the IpcRendererEvent (and its `sender`) to the renderer.
      const forward = (_event: unknown, ...args: unknown[]) => listener(...args);
      ipcRenderer.on(channel, forward);
      return () => {
        ipcRenderer.removeListener(channel, forward);
      };
    },
    // A dropped file's path goes to the main process, never to the renderer (R13b).
    (file) => webUtils.getPathForFile(file),
  ),
);
