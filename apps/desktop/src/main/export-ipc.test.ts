import type { SiteSnapshot } from "@webforge/model";
import { DEFAULT_THEME } from "@webforge/model";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExportOutcome } from "../shared/export-worker-protocol.js";
import {
  type ExportDialogs,
  type RunExport,
  registerExportHandlers,
  toExportResult,
} from "./export-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";
const snapshot: SiteSnapshot = {
  name: "Bakery",
  language: "en",
  theme: { ...DEFAULT_THEME, preset: "light" },
  layout: { header: [], footer: [] },
  pages: [{ id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } }],
  media: [],
};
const PHOTO = "a".repeat(64);
const PDF = "d".repeat(64);
const request = {
  snapshot,
  media: [
    {
      id: "hero",
      name: "hero",
      mimeType: "image/jpeg",
      hash: PHOTO,
      alt: "Our shop",
      crop: { x: 0, y: 0, width: 1, height: 0.5 },
    },
    { id: "gone", name: "gone", mimeType: "image/png", hash: "b".repeat(64), alt: "" },
  ],
} as const;
const exported: ExportOutcome = {
  type: "exported",
  pages: 1,
  files: 5,
  bytes: 1234,
  warnings: 0,
  durationMs: 900,
};

function setUp(dialogs: ExportDialogs, run: RunExport | ExportOutcome = exported) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    },
  } as unknown as Pick<IpcMain, "handle">;
  const runExport = vi.fn<RunExport>(typeof run === "function" ? run : async () => run);
  const sendProgress = vi.fn();
  registerExportHandlers(ipc, (url) => url === APP_URL, dialogs, runExport, sendProgress);
  const call =
    (channel: string) =>
    (...args: unknown[]) => {
      const handler = handlers.get(channel);
      if (handler === undefined) {
        throw new Error(`No handler for ${channel}`);
      }
      return handler({ senderFrame: { url: APP_URL } } as unknown as IpcMainInvokeEvent, ...args);
    };
  return {
    invoke: call("site:export"),
    cancel: call("site:cancel-export"),
    runExport,
    sendProgress,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerExportHandlers", () => {
  it("exports to the folder the user chose and returns only its name", async () => {
    const { invoke, runExport } = setUp({ chooseExportFolder: async () => "/sites/my-site" });

    await expect(invoke({ snapshot, media: [] })).resolves.toEqual({
      status: "exported",
      folderName: "my-site",
      pages: 1,
      files: 5,
      warnings: 0,
    });
    expect(runExport).toHaveBeenCalledWith(
      { ...snapshot, documents: [] },
      "/sites/my-site",
      expect.anything(),
    );
  });

  it("passes the export's progress on to the window, and cancels it when asked (3.1)", async () => {
    const { invoke, cancel, sendProgress } = setUp(
      { chooseExportFolder: async () => "/sites/my-site" },
      (_snapshot, _destination, { signal, onProgress }) =>
        new Promise((resolve) => {
          onProgress({ stage: "images", done: 0, total: 2 });
          signal.addEventListener("abort", () => resolve({ type: "cancelled" }));
        }),
    );

    const result = invoke(request);
    await vi.waitFor(() =>
      expect(sendProgress).toHaveBeenCalledWith({ stage: "images", done: 0, total: 2 }),
    );
    await expect(cancel()).resolves.toBeNull();

    await expect(result).resolves.toEqual({ status: "canceled" });
    // With nothing under way, a cancel does nothing.
    await expect(cancel()).resolves.toBeNull();
  });

  it("names images and documents by hash: their bytes are read only as the worker asks (R15)", async () => {
    const { invoke, runExport } = setUp({ chooseExportFolder: async () => "/sites/my-site" });
    const document = {
      id: "prices",
      name: "prices",
      mimeType: "application/pdf",
      hash: PDF,
    } as const;

    await invoke({ ...request, documents: [document] });

    // No bytes in this process: the build leaves out a file the site doesn't store, with a warning.
    expect(runExport).toHaveBeenCalledWith(
      { ...snapshot, media: request.media, documents: [document] },
      "/sites/my-site",
      expect.anything(),
    );
  });

  it("does nothing when the user cancels the dialog", async () => {
    const { invoke, runExport } = setUp({ chooseExportFolder: async () => undefined });

    await expect(invoke(request)).resolves.toEqual({ status: "canceled" });
    expect(runExport).not.toHaveBeenCalled();
  });

  it("rejects a snapshot that is not a valid site before asking for a folder", async () => {
    const chooseExportFolder = vi.fn(async () => "/sites/my-site");
    const { invoke } = setUp({ chooseExportFolder });

    await expect(invoke({ snapshot: { ...snapshot, pages: [] }, media: [] })).rejects.toThrow();
    await expect(
      invoke({ snapshot, media: [{ ...request.media[0], hash: "../secret" }] }),
    ).rejects.toThrow();
    expect(chooseExportFolder).not.toHaveBeenCalled();
  });
});

describe("toExportResult", () => {
  it("passes on the page to rename, but logs only the codes (R16)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = toExportResult(
      { type: "failed", code: "reserved-name", detail: "reserved-name", page: "Contact us" },
      "/sites/my-site",
    );

    expect(result).toEqual({ status: "failed", reason: "reserved-name", page: "Contact us" });
    expect(error).toHaveBeenCalledWith(
      "Webforge could not export a site (code=reserved-name, detail=reserved-name)",
    );
  });

  it("reports a cancelled export as the dialog's cancel: nothing changed on disk (R15)", () => {
    expect(toExportResult({ type: "cancelled" }, "/sites/my-site")).toEqual({ status: "canceled" });
  });

  it("passes on the failure reason and logs only codes", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = toExportResult(
      { type: "failed", code: "folder-not-empty", detail: "folder-not-empty" },
      "/Users/sam/Documents",
    );

    expect(result).toEqual({ status: "failed", reason: "folder-not-empty" });
    expect(error).toHaveBeenCalledWith(
      "Webforge could not export a site (code=folder-not-empty, detail=folder-not-empty)",
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("Users");
  });
});
