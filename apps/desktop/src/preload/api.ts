import { type IpcName, type IpcResponse, ipcContract } from "../shared/ipc-contract.js";
import type { WebforgeApi } from "../shared/webforge-api.js";

/** Sends one IPC request to the main process (`ipcRenderer.invoke` in the preload script). */
export type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>;

async function call<N extends IpcName>(invoke: Invoke, name: N): Promise<IpcResponse<N>> {
  const entry = ipcContract[name];
  // TypeScript can't narrow the schema union by N; the parse result matches IpcResponse<N>.
  return entry.response.parse(await invoke(entry.channel)) as IpcResponse<N>;
}

/** Builds the `window.webforge` API on top of an IPC `invoke` function. */
export function createWebforgeApi(invoke: Invoke): WebforgeApi {
  return {
    app: {
      getInfo: () => call(invoke, "getAppInfo"),
    },
    project: {
      create: () => call(invoke, "createProject"),
      open: () => call(invoke, "openProject"),
      getCurrent: () => call(invoke, "getCurrentProject"),
    },
  };
}
