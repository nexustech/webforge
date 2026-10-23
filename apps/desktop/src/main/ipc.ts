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
 * The only message a call that failed in the main process rejects with (R4): never the error's
 * own, which Electron would pass to the renderer and which can hold a path (`EACCES … mkdir
 * '/home/…'`) or other data. The renderer shows its own `t()` message for a failed call.
 */
export const IPC_FAILED = "ipc-failed";

/** The failed answers a contract may have for an unexpected error, most specific first. */
const FAILED_ANSWERS = [{ status: "failed", reason: "unknown" }, { status: "failed" }] as const;

/** The error's kind and code, which logs may hold; never its message, which may hold a path. */
function errorKind(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? `${error.name} ${code}` : error.name;
}

/**
 * Registers the main-process implementation of one IPC contract entry.
 * Requests from frames other than the app's own page are rejected, and both the request arguments
 * and the response are validated against the contract's zod schemas. When the implementation
 * throws, or answers outside the contract, only the error's kind is logged, and the renderer gets
 * the contract's failed answer where it has one (`{ status: "failed", reason: "unknown" }`), else
 * a rejection with {@link IPC_FAILED}.
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
    // The renderer's own request: its validation errors name only what the renderer sent.
    const args = entry.request.parse(rawArgs) as IpcRequest<N>;
    try {
      return entry.response.parse(await impl(...args));
    } catch (error) {
      console.error(`Webforge IPC call "${entry.channel}" failed (${errorKind(error)})`);
      for (const answer of FAILED_ANSWERS) {
        const failed = entry.response.safeParse(answer);
        if (failed.success) return failed.data;
      }
      throw new Error(IPC_FAILED);
    }
  });
}
