import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { Updater, UpdateService } from "./updates.js";
import { createUpdates, updatesFeature } from "./updates-ipc.js";

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

describe("createUpdates (0.5a, #985)", () => {
  /** An updater that finds nothing. */
  const updater = (): Updater =>
    ({
      check: vi.fn(async () => undefined),
      onAvailable: vi.fn(),
      onDownloaded: vi.fn(),
      onError: vi.fn(),
      install: vi.fn(),
      setChannel: vi.fn(),
    }) as unknown as Updater;
  const deps = (over: Partial<Parameters<typeof createUpdates>[0]> = {}) => ({
    supported: true,
    load: vi.fn(async () => updater()),
    channel: () => "stable" as const,
    onStatus: vi.fn(),
    quitting: () => false,
    ...over,
  });

  it("starts its service once the window has opened, in a build that updates itself", async () => {
    const given = deps();
    const updates = createUpdates(given);
    expect(updates.service()).toBeUndefined();

    updates.started?.();

    await vi.waitFor(() => expect(updates.service()).toBeDefined());
    expect(given.load).toHaveBeenCalledOnce();
    updates.service()?.stop();
  });

  it("loads nothing in a build that doesn't update itself, or once quitting has begun", async () => {
    const unsupported = deps({ supported: false });
    createUpdates(unsupported).started?.();
    expect(unsupported.load).not.toHaveBeenCalled();

    const quitting = createUpdates(deps({ quitting: () => true }));
    quitting.started?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(quitting.service()).toBeUndefined();
  });

  it("logs an updater it couldn't load, by its code, and stays idle", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const updates = createUpdates(deps({ load: async () => Promise.reject(new Error("gone")) }));

    updates.started?.();

    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/^Webforge could not start its updates/),
      ),
    );
    expect(updates.service()).toBeUndefined();
    error.mockRestore();
  });
});
