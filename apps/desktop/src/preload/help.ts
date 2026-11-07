import { contextBridge, ipcRenderer } from "electron";
import { createCall } from "./api/call.js";
import { helpWindowApi } from "./api/help.js";

// The Help window's preload (5.4b): only its own small API, never ipcRenderer itself, and none of
// the editor's. Main refuses the editor's channels from this window too (`main/help-window.ts`).
contextBridge.exposeInMainWorld(
  "webforgeHelp",
  helpWindowApi(
    createCall((channel, ...args) => ipcRenderer.invoke(channel, ...args)),
    (channel, listener) => {
      // Never hand the IpcRendererEvent (and its `sender`) to the renderer.
      const forward = (_event: unknown, ...args: unknown[]) => listener(...args);
      ipcRenderer.on(channel, forward);
      return () => {
        ipcRenderer.removeListener(channel, forward);
      };
    },
  ),
);
