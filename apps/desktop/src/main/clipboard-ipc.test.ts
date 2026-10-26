import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AssetWriter, ProjectStore } from "@webforge/storage";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createElementClipboard,
  type ElementClipboard,
  type SystemClipboard,
} from "./clipboard.js";
import { registerClipboardHandlers } from "./clipboard-ipc.js";
import { ProjectSession } from "./project-session.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const SESSION = "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d";
const LATE = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
/** A 1×1 PNG, as a copied screenshot would be. */
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

const dirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function handlers(
  clipboard: ElementClipboard,
  session: Parameters<typeof registerClipboardHandlers>[3],
) {
  const registered = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => registered.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  registerClipboardHandlers(ipc, () => true, clipboard, session);
  return (channel: string, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent, ...args);
}

describe("registerClipboardHandlers (1.25)", () => {
  const elements = { nodes: [{ type: "Heading", props: { id: "h" } }], media: [] };
  const site = { current: () => null, readMedia: () => undefined };
  const clipboard = () =>
    ({
      write: vi.fn(async () => ({ status: "copied" }) as const),
      read: vi.fn(async () => ({ status: "empty" }) as const),
    }) as unknown as ElementClipboard;
  const session = {
    staleReason: (sessionId: string) => (sessionId === SESSION ? undefined : "stale-session"),
    forSession: () => site,
  } as unknown as Parameters<typeof registerClipboardHandlers>[3];

  it("copies and pastes for a renderer loaded for the open site, through that session's site", async () => {
    const fake = clipboard();
    const invoke = handlers(fake, session);

    await expect(invoke("clipboard:write", SESSION, elements)).resolves.toEqual({
      status: "copied",
    });
    await expect(invoke("clipboard:read", SESSION)).resolves.toEqual({ status: "empty" });
    expect(fake.write).toHaveBeenCalledWith(site, elements);
    expect(fake.read).toHaveBeenCalledWith(site, expect.any(Object));
  });

  it("refuses a renderer loaded for a site another one has replaced (R6)", async () => {
    const fake = clipboard();
    const invoke = handlers(fake, session);

    await expect(invoke("clipboard:write", LATE, elements)).resolves.toEqual({
      status: "failed",
      reason: "stale-session",
    });
    // A paste can import images into the open site: refused as well.
    await expect(invoke("clipboard:read", LATE)).resolves.toEqual({
      status: "failed",
      reason: "stale-session",
    });
    expect(fake.write).not.toHaveBeenCalled();
    expect(fake.read).not.toHaveBeenCalled();
  });

  it("stores nothing in a site a hand-off opened while the clipboard was being read (R6)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dir = mkdtempSync(join(tmpdir(), "webforge-clipboard-ipc-"));
    dirs.push(dir);
    const project = new ProjectSession();
    const opened = await project.create(join(dir, "Bakery.wforge"));
    if (opened.status !== "opened") throw new Error("not opened");
    // The clipboard answers only once the hand-off below has opened another site.
    let answer: (value: Awaited<ReturnType<SystemClipboard["read"]>>) => void = () => undefined;
    const system: SystemClipboard = {
      writeElements: async () => undefined,
      read: () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
      holdsElements: async () => true,
    };
    const invoke = handlers(createElementClipboard(system, join(dir, "kept")), project);
    // Nothing reaches the file, whichever way the bytes would be stored.
    const store = vi.spyOn(ProjectStore.prototype, "putAsset");
    const write = vi.spyOn(AssetWriter.prototype, "put");

    const pasted = invoke("clipboard:read", opened.project.sessionId);
    await project.create(join(dir, "Florist.wforge"));
    answer({ kind: "image", png: PNG });

    await expect(pasted).resolves.toEqual({ status: "failed", reason: "stale-session" });
    expect(store).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    await project.close();
  });
});
