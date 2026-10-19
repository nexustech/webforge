import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { registerIpcHandler } from "./ipc.js";

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

    await expect(invoke("app:get-info", "https://example.com/")).rejects.toThrow(/untrusted frame/);
    expect(impl).not.toHaveBeenCalled();
  });

  it("rejects requests that do not match the contract", async () => {
    const { ipc, invoke } = fakeIpcMain();
    registerIpcHandler(ipc, "getAppInfo", isTrusted, () => appInfo);

    await expect(invoke("app:get-info", "http://localhost:5173/", "unexpected")).rejects.toThrow();
  });

  it("rejects responses that do not match the contract", async () => {
    const { ipc, invoke } = fakeIpcMain();
    registerIpcHandler(ipc, "getAppInfo", isTrusted, () => ({ name: "", version: "1.0.0" }));

    await expect(invoke("app:get-info", "http://localhost:5173/")).rejects.toThrow();
  });
});
