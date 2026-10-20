import {
  type IpcName,
  type IpcRequest,
  type IpcResponse,
  ipcContract,
} from "../../shared/ipc-contract.js";

/** Sends one IPC request to the main process (`ipcRenderer.invoke` in the preload script). */
export type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>;

/** Calls the contract entry `name` and validates the response against its schema. */
export type Call = <N extends IpcName>(name: N, ...args: IpcRequest<N>) => Promise<IpcResponse<N>>;

/** Builds a {@link Call} on top of an IPC `invoke` function. */
export function createCall(invoke: Invoke): Call {
  return async (name, ...args) => {
    const entry = ipcContract[name];
    // TypeScript can't narrow the schema union by N; the parse result matches IpcResponse<N>.
    return entry.response.parse(await invoke(entry.channel, ...args)) as IpcResponse<typeof name>;
  };
}
