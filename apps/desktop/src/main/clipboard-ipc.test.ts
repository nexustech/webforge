import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { ElementClipboard } from "./clipboard.js";
import { registerClipboardHandlers } from "./clipboard-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const SESSION = "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d";
const LATE = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

function setUp() {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const clipboard = {
    write: vi.fn(async () => ({ status: "copied" }) as const),
    read: vi.fn(async () => ({ status: "empty" }) as const),
  } as unknown as ElementClipboard;
  const session = {
    staleReason: (sessionId: string) => (sessionId === SESSION ? undefined : "stale-session"),
  } as const;
  registerClipboardHandlers(ipc, () => true, clipboard, session);
  const invoke = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
  return { invoke, clipboard };
}

describe("registerClipboardHandlers (1.25)", () => {
  const elements = { nodes: [{ type: "Heading", props: { id: "h" } }], media: [] };

  it("copies and pastes for a renderer loaded for the open site", async () => {
    const { invoke, clipboard } = setUp();

    await expect(invoke("clipboard:write", SESSION, elements)).resolves.toEqual({
      status: "copied",
    });
    await expect(invoke("clipboard:read", SESSION)).resolves.toEqual({ status: "empty" });
    expect(clipboard.write).toHaveBeenCalledWith(elements);
  });

  it("refuses a renderer loaded for a site another one has replaced (R6)", async () => {
    const { invoke, clipboard } = setUp();

    await expect(invoke("clipboard:write", LATE, elements)).resolves.toEqual({
      status: "failed",
      reason: "stale-session",
    });
    // A paste can import images into the open site: refused as well.
    await expect(invoke("clipboard:read", LATE)).resolves.toEqual({
      status: "failed",
      reason: "stale-session",
    });
    expect(clipboard.write).not.toHaveBeenCalled();
    expect(clipboard.read).not.toHaveBeenCalled();
  });
});
