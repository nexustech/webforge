import { mkdirSync, truncateSync, writeFileSync } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { BlobWriter, ProjectStore } from "@webforge/storage";
import { tempDirFactory } from "@webforge/test-utils";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { MAX_MEDIA_BYTES } from "../shared/ipc/media.js";
import { readAtMost, storeImport } from "../worker/store-import.js";
import { registerMediaHandlers } from "./media-ipc.js";
import { type ImportFileResult, type ImportSource, ProjectSession } from "./project-session.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";
const SESSION = "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d";
const tempDir = tempDirFactory("webforge-media-ipc-");
const pdf = new TextEncoder().encode("%PDF-1.7\nprice list");

function setUp(chosen: readonly string[] | undefined, open = true) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const session = {
    current: vi.fn(() => (open ? { name: "Bakery" } : null)),
    staleReason: vi.fn((sessionId: string) =>
      !open ? "no-site" : sessionId === SESSION ? undefined : "stale-session",
    ),
    // Reads and checks as the storage writer does, storing nowhere.
    importFile: vi.fn(
      (_mediaId: string, fileName: string, source: ImportSource): Promise<ImportFileResult> =>
        storeImport({ sitePath: "site.wforge", fileName, source }, () => ({
          put: () => "a".repeat(64),
          close: () => undefined,
        })) as Promise<ImportFileResult>,
    ),
  };
  // As the real session's, without a hand-off: the same site.
  const withSession = {
    ...session,
    forSession: vi.fn(() => session),
  } as unknown as Pick<ProjectSession, "staleReason" | "forSession">;
  const chooseMediaFiles = vi.fn(async () => chosen);
  registerMediaHandlers(ipc, (url) => url === APP_URL, withSession, { chooseMediaFiles });
  const invoke = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)?.({ senderFrame: { url: APP_URL } } as IpcMainInvokeEvent, ...args);
  return { invoke, session, chooseMediaFiles };
}

describe("registerMediaHandlers", () => {
  it("imports dropped files from their bytes", async () => {
    const { invoke, session } = setUp(undefined);

    const result = await invoke("media:import", SESSION, [{ fileName: "prices.pdf", data: pdf }]);

    expect(result).toMatchObject({ status: "imported", items: [{ fileName: "prices.pdf" }] });
    expect(session.importFile).toHaveBeenCalledWith(expect.any(String), "prices.pdf", {
      data: pdf,
    });
  });

  it("imports nothing for a renderer loaded for a site another one has replaced (R6)", async () => {
    const { invoke, session } = setUp(undefined);

    await expect(
      invoke("media:import", "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", [
        { fileName: "prices.pdf", data: pdf },
      ]),
    ).resolves.toEqual({ status: "failed", reason: "stale-session" });
    expect(session.importFile).not.toHaveBeenCalled();
  });

  it("refuses a drop with a path for a name or more than 50 MB of bytes", async () => {
    const { invoke } = setUp(undefined);

    await expect(
      invoke("media:import", SESSION, [{ fileName: "../prices.pdf", data: pdf }]),
    ).rejects.toThrow();
    await expect(
      invoke("media:import", SESSION, [
        { fileName: "big.pdf", data: new Uint8Array(MAX_MEDIA_BYTES + 1) },
      ]),
    ).rejects.toThrow();
  });

  it("refuses one request carrying more than 100 MB in all", async () => {
    const { invoke, session } = setUp(undefined);
    const full = new Uint8Array(MAX_MEDIA_BYTES);

    await expect(
      invoke("media:import", SESSION, [
        { fileName: "a.pdf", data: full },
        { fileName: "b.pdf", data: full },
        { fileName: "c.pdf", data: pdf },
      ]),
    ).rejects.toThrow();
    expect(session.importFile).not.toHaveBeenCalled();
  });

  it("stores each chosen file before reading the next, and stops when storing fails", async () => {
    const dir = tempDir();
    const paths = ["One.pdf", "Two.pdf"].map((name) => {
      const path = join(dir, name);
      writeFileSync(path, pdf);
      return path;
    });
    const { invoke, session } = setUp(paths);
    vi.mocked(session.importFile).mockResolvedValueOnce({ status: "failed", reason: "read-only" });

    await expect(invoke("media:choose", SESSION)).resolves.toEqual({
      status: "failed",
      reason: "read-only",
    });
    expect(session.importFile).toHaveBeenCalledTimes(1);
  });

  it("reads the chosen files, and doesn't read one that is too large", async () => {
    const dir = tempDir();
    const prices = join(dir, "Prices.pdf");
    writeFileSync(prices, pdf);
    const big = join(dir, "Big.pdf");
    writeFileSync(big, "");
    truncateSync(big, MAX_MEDIA_BYTES + 1);
    const { invoke } = setUp([prices, big]);

    await expect(invoke("media:choose", SESSION)).resolves.toMatchObject({
      status: "imported",
      items: [{ fileName: "Prices.pdf", kind: "file" }],
      rejected: [{ fileName: "Big.pdf", reason: "too-large" }],
    });
  });

  it("does nothing when the user cancels, or without a site", async () => {
    await expect(setUp(undefined).invoke("media:choose", SESSION)).resolves.toEqual({
      status: "canceled",
    });
    await expect(setUp([]).invoke("media:choose", SESSION)).resolves.toEqual({
      status: "canceled",
    });

    const closed = setUp(["/nowhere.pdf"], false);
    await expect(closed.invoke("media:choose", SESSION)).resolves.toEqual({
      status: "failed",
      reason: "no-site",
    });
    expect(closed.chooseMediaFiles).not.toHaveBeenCalled();
  });

  it("lists a folder or a file that is gone as not taken, importing the rest, logging nothing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dir = tempDir();
    const prices = join(dir, "Prices.pdf");
    writeFileSync(prices, pdf);
    const folder = join(dir, "Photos");
    mkdirSync(folder);

    await expect(
      setUp([folder, join(dir, "Secret plans.pdf"), prices]).invoke("media:choose", SESSION),
    ).resolves.toMatchObject({
      status: "imported",
      items: [{ fileName: "Prices.pdf" }],
      rejected: [
        { fileName: "Photos", reason: "unsupported" },
        { fileName: "Secret plans.pdf", reason: "unsupported" },
      ],
    });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("readAtMost", () => {
  it("reads a file to its end, but never past the limit", async () => {
    const path = join(tempDir(), "ten.bin");
    writeFileSync(path, new Uint8Array(10).fill(7));
    for (const [max, expected] of [
      [10, 10],
      [9, undefined],
    ] as const) {
      const handle = await open(path, "r");
      try {
        expect((await readAtMost(handle, max))?.byteLength).toBe(expected);
      } finally {
        await handle.close();
      }
    }
  });

  it("stops reading a file that keeps growing after its size was checked", async () => {
    // A file that never ends: each read fills the whole chunk.
    const read = vi.fn(async (buffer: Uint8Array) => ({ bytesRead: buffer.length, buffer }));

    expect(await readAtMost({ read } as never, 3 * 1024 * 1024)).toBeUndefined();
    // Three 1 MB chunks, then one more byte: never more than the limit plus one.
    expect(read.mock.calls.reduce((total, [buffer]) => total + buffer.length, 0)).toBe(
      3 * 1024 * 1024 + 1,
    );
  });
});

describe("registerMediaHandlers and a hand-off (R6)", () => {
  it("stores nothing in a site a hand-off opened while the Choose dialog was open", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dir = tempDir();
    const prices = join(dir, "Prices.pdf");
    writeFileSync(prices, pdf);
    const project = new ProjectSession();
    const opened = await project.create(join(dir, "Bakery.wforge"));
    if (opened.status !== "opened") throw new Error("not opened");
    // The dialog answers only once the hand-off below has opened another site.
    let choose: (paths: readonly string[]) => void = () => undefined;
    const chooseMediaFiles = () =>
      new Promise<readonly string[]>((resolve) => {
        choose = resolve;
      });
    const handlers = new Map<string, Handler>();
    const ipc = {
      handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
    } as unknown as Pick<IpcMain, "handle">;
    registerMediaHandlers(ipc, (url) => url === APP_URL, project, { chooseMediaFiles });
    // Nothing reaches the file, whichever way the bytes would be stored.
    const store = vi.spyOn(ProjectStore.prototype, "addAsset");
    const write = vi.spyOn(BlobWriter.prototype, "put");

    const chosen = handlers.get("media:choose")?.(
      { senderFrame: { url: APP_URL } } as IpcMainInvokeEvent,
      opened.project.sessionId,
    );
    await project.create(join(dir, "Florist.wforge"));
    choose([prices]);

    await expect(chosen).resolves.toEqual({ status: "failed", reason: "stale-session" });
    expect(store).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    await project.close();
    vi.restoreAllMocks();
  });
});
