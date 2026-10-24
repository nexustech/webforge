import { DEFAULT_THEME } from "@webforge/model";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { IPC_FAILED, registerIpcHandler } from "./ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

function fakeIpcMain() {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    },
  } as unknown as Pick<IpcMain, "handle">;
  const invoke = (channel: string, senderUrl: string, ...args: unknown[]) => {
    const handler = handlers.get(channel);
    if (handler === undefined) {
      throw new Error(`No handler for ${channel}`);
    }
    const event = { senderFrame: { url: senderUrl } } as unknown as IpcMainInvokeEvent;
    return handler(event, ...args);
  };
  return { ipc, invoke };
}

const isTrusted = (url: string) => url === "http://localhost:5173/";
const appInfo = { name: "Webforge", version: "1.0.0" };

describe("registerIpcHandler", () => {
  it("returns the validated response to a trusted sender", async () => {
    const { ipc, invoke } = fakeIpcMain();
    registerIpcHandler(ipc, "getAppInfo", isTrusted, () => appInfo);

    await expect(invoke("app:get-info", "http://localhost:5173/")).resolves.toEqual(appInfo);
  });

  it("rejects calls from untrusted frames without running the handler", async () => {
    const { ipc, invoke } = fakeIpcMain();
    const impl = vi.fn(() => appInfo);
    registerIpcHandler(ipc, "getAppInfo", isTrusted, impl);

    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(invoke("app:get-info", "https://example.com/")).rejects.toThrow(IPC_FAILED);
    expect(log).toHaveBeenCalledWith(
      "Webforge refused an IPC call from an untrusted frame (channel=app:get-info)",
    );
    log.mockRestore();
    expect(impl).not.toHaveBeenCalled();
  });

  it("rejects requests that do not match the contract", async () => {
    const { ipc, invoke } = fakeIpcMain();
    registerIpcHandler(ipc, "getAppInfo", isTrusted, () => appInfo);

    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Zod's message would describe what was sent: only the fixed message crosses (R4).
    const failure = await invoke("app:get-info", "http://localhost:5173/", "/home/rosa/x").catch(
      (error: unknown) => error,
    );
    expect((failure as Error).message).toBe(IPC_FAILED);
    expect(log).toHaveBeenCalledWith(
      "Webforge refused an invalid IPC request (channel=app:get-info)",
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("/home/rosa");
    log.mockRestore();
  });

  it("rejects responses that do not match the contract", async () => {
    const { ipc, invoke } = fakeIpcMain();
    registerIpcHandler(ipc, "getAppInfo", isTrusted, () => ({ name: "", version: "1.0.0" }));

    await expect(invoke("app:get-info", "http://localhost:5173/")).rejects.toThrow(IPC_FAILED);
  });
});

describe("registerIpcHandler's failures (R4, #237)", () => {
  const PATH = "/home/rosa/Sites/Bakery";
  /** A Node fs error, which names the path it failed on. */
  const fsError = () =>
    Object.assign(new Error(`EACCES: permission denied, mkdir '${PATH}/crash-reports'`), {
      code: "EACCES",
      path: PATH,
    });

  it("never passes an error's own message or a path to the renderer, and logs only its kind", async () => {
    const { ipc, invoke } = fakeIpcMain();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    registerIpcHandler(ipc, "getAppInfo", isTrusted, () => {
      throw fsError();
    });

    const failure = await invoke("app:get-info", "http://localhost:5173/").catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(IPC_FAILED);
    expect(String(failure)).not.toContain(PATH);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      "Webforge IPC call failed (channel=app:get-info, code=Error EACCES)",
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(PATH);
    log.mockRestore();
  });

  it("answers with the contract's failed shape where it has one", async () => {
    const { ipc, invoke } = fakeIpcMain();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fail = async () => {
      throw fsError();
    };
    registerIpcHandler(ipc, "readClipboard", isTrusted, fail);
    registerIpcHandler(ipc, "compileCanvasCss", isTrusted, fail);

    await expect(
      invoke("clipboard:read", "http://localhost:5173/", "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d"),
    ).resolves.toEqual({
      status: "failed",
      reason: "unknown",
    });
    // A contract whose failed answer has no reason.
    const request = { theme: DEFAULT_THEME, candidates: [] };
    await expect(invoke("canvas:compile-css", "http://localhost:5173/", request)).resolves.toEqual({
      status: "failed",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(PATH);
    log.mockRestore();
  });

  it("logs a thrown value that isn't an Error by its type only", async () => {
    const { ipc, invoke } = fakeIpcMain();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    registerIpcHandler(ipc, "getAppInfo", isTrusted, () => {
      throw PATH;
    });

    await expect(invoke("app:get-info", "http://localhost:5173/")).rejects.toThrow(IPC_FAILED);
    expect(log).toHaveBeenCalledWith(
      "Webforge IPC call failed (channel=app:get-info, code=string)",
    );
    log.mockRestore();
  });
});
