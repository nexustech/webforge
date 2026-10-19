import { contextBridge, ipcRenderer } from "electron";
import { createWebforgeApi } from "./api.js";

// Expose only the typed API, never ipcRenderer itself.
contextBridge.exposeInMainWorld(
  "webforge",
  createWebforgeApi((channel, ...args) => ipcRenderer.invoke(channel, ...args)),
);
