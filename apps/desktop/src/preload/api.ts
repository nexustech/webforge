import { type IpcName, ipcContract } from "../shared/ipc-contract.js";
import type { WebforgeApi } from "../shared/webforge-api.js";

/** Sends one IPC request to the main process (`ipcRenderer.invoke` in the preload script). */
export type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>;

async function call<N extends IpcName>(invoke: Invoke, name: N) {
  const entry = ipcContract[name];
  return entry.response.parse(await invoke(entry.channel));
}

/** Builds the `window.webforge` API on top of an IPC `invoke` function. */
export function createWebforgeApi(invoke: Invoke): WebforgeApi {
  return {
    app: {
      getInfo: () => call(invoke, "getAppInfo"),
    },
  };
}
