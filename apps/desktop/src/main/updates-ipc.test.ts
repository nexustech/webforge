import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { UpdateService } from "./updates.js";
import { updatesFeature } from "./updates-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/** The feature's `updates:status`, called as from a renderer that `trusted` says it trusts or not. */
function featureWith(service: UpdateService | undefined, trusted = true) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (name: string, handler: Handler) => registered.set(name, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const feature = updatesFeature(() => service);
  feature.register?.(ipc, () => trusted);
  return {
    feature,
    status: () =>
      registered.get("updates:status")?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent),
  };
}

function fakeService(): UpdateService {
  return {
    start: vi.fn(),
    status: () => ({ state: "downloaded", version: "1.2.0" }),
    installOnQuit: vi.fn(),
    stop: vi.fn(),
    setChannel: vi.fn(),
  };
}

describe("updatesFeature (0.5a)", () => {
  it("tells the window the update's state", async () => {
    expect(await featureWith(fakeService()).status()).toEqual({
      state: "downloaded",
      version: "1.2.0",
    });
  });

  it("says idle in a build without updates", async () => {
    expect(await featureWith(undefined).status()).toEqual({ state: "idle" });
  });

  it("leaves installing to quitting's last step, after every feature's quit", () => {
    const { feature } = featureWith(fakeService());
    expect(feature.quit).toBeUndefined();
  });

  it("refuses a renderer it does not trust", async () => {
    await expect(featureWith(fakeService(), false).status()).rejects.toThrow();
  });
});
