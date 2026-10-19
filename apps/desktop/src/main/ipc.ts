import type { IpcMain, IpcMainInvokeEvent } from "electron";
import {
  type IpcName,
  type IpcRequest,
  type IpcResponse,
  ipcContract,
} from "../shared/ipc-contract.js";

type IpcHandlerImpl<N extends IpcName> = (
  ...args: IpcRequest<N>
) => IpcResponse<N> | Promise<IpcResponse<N>>;

/**
 * Registers the main-process implementation of one IPC contract entry.
 * Requests from frames other than the app's own page are rejected, and both the request arguments
 * and the response are validated against the contract's zod schemas.
 */
export function registerIpcHandler<N extends IpcName>(
  ipc: Pick<IpcMain, "handle">,
  name: N,
  isTrustedSender: (senderUrl: string) => boolean,
  impl: IpcHandlerImpl<N>,
): void {
  const entry = ipcContract[name];
  ipc.handle(entry.channel, async (event: IpcMainInvokeEvent, ...rawArgs: unknown[]) => {
    const senderUrl = event.senderFrame?.url ?? "";
    if (!isTrustedSender(senderUrl)) {
      throw new Error(`Rejected IPC call "${entry.channel}" from an untrusted frame`);
    }
    const args = entry.request.parse(rawArgs) as IpcRequest<N>;
    const response = await impl(...args);
    return entry.response.parse(response);
  });
}
