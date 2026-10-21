import { truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { MAX_MEDIA_BYTES } from "../shared/ipc/media.js";
import { registerMediaHandlers } from "./media-ipc.js";
import type { ProjectSession } from "./project-session.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";
const tempDir = tempDirFactory("webforge-media-ipc-");
const pdf = new TextEncoder().encode("%PDF-1.7\nprice list");

function setUp(chosen: readonly string[] | undefined, open = true) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const session = {
    current: vi.fn(() => (open ? { name: "Bakery" } : null)),
    storeAsset: vi.fn(() => ({ status: "stored", hash: "a".repeat(64) })),
  } as unknown as Pick<ProjectSession, "storeAsset" | "current">;
  const chooseMediaFiles = vi.fn(async () => chosen);
  registerMediaHandlers(ipc, (url) => url === APP_URL, session, { chooseMediaFiles });
  const invoke = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)?.({ senderFrame: { url: APP_URL } } as IpcMainInvokeEvent, ...args);
  return { invoke, session, chooseMediaFiles };
}

describe("registerMediaHandlers", () => {
  it("imports dropped files from their bytes", async () => {
    const { invoke, session } = setUp(undefined);

    const result = await invoke("media:import", [{ fileName: "prices.pdf", data: pdf }]);

    expect(result).toMatchObject({ status: "imported", items: [{ fileName: "prices.pdf" }] });
    expect(session.storeAsset).toHaveBeenCalledWith(
      expect.objectContaining({ data: pdf, mime: "application/pdf", originalName: "prices.pdf" }),
    );
  });

  it("refuses a drop with a path for a name or more than 50 MB of bytes", async () => {
    const { invoke } = setUp(undefined);

    await expect(
      invoke("media:import", [{ fileName: "../prices.pdf", data: pdf }]),
    ).rejects.toThrow();
    await expect(
      invoke("media:import", [{ fileName: "big.pdf", data: new Uint8Array(MAX_MEDIA_BYTES + 1) }]),
    ).rejects.toThrow();
  });

  it("reads the chosen files, and doesn't read one that is too large", async () => {
    const dir = tempDir();
    const prices = join(dir, "Prices.pdf");
    writeFileSync(prices, pdf);
    const big = join(dir, "Big.pdf");
    writeFileSync(big, "");
    truncateSync(big, MAX_MEDIA_BYTES + 1);
    const { invoke } = setUp([prices, big]);

    await expect(invoke("media:choose")).resolves.toMatchObject({
      status: "imported",
      items: [{ fileName: "Prices.pdf", kind: "file" }],
      rejected: [{ fileName: "Big.pdf", reason: "too-large" }],
    });
  });

  it("does nothing when the user cancels, or without a site", async () => {
    await expect(setUp(undefined).invoke("media:choose")).resolves.toEqual({ status: "canceled" });
    await expect(setUp([]).invoke("media:choose")).resolves.toEqual({ status: "canceled" });

    const closed = setUp(["/nowhere.pdf"], false);
    await expect(closed.invoke("media:choose")).resolves.toEqual({
      status: "failed",
      reason: "no-site",
    });
    expect(closed.chooseMediaFiles).not.toHaveBeenCalled();
  });

  it("fails without logging the path when a chosen file can't be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const missing = join(tempDir(), "Secret plans.pdf");

    await expect(setUp([missing]).invoke("media:choose")).resolves.toEqual({
      status: "failed",
      reason: "unknown",
    });
    expect(String(error.mock.calls[0])).not.toContain("Secret");
    error.mockRestore();
  });
});
