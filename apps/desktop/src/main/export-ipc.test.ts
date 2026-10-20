import type { SiteSnapshot } from "@webforge/model";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExportOutcome } from "../shared/export-worker-protocol.js";
import { type ExportDialogs, registerExportHandlers, toExportResult } from "./export-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";
const snapshot: SiteSnapshot = {
  name: "Bakery",
  language: "en",
  theme: { name: "light" },
  layout: { header: [], footer: [] },
  pages: [{ path: "index", title: "Home", doc: { root: { props: {} }, content: [] } }],
  media: [],
};
const exported: ExportOutcome = {
  type: "exported",
  pages: 1,
  files: 5,
  bytes: 1234,
  warnings: 0,
  durationMs: 900,
};

function setUp(dialogs: ExportDialogs, outcome: ExportOutcome = exported) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    },
  } as unknown as Pick<IpcMain, "handle">;
  const runExport = vi.fn(async () => outcome);
  registerExportHandlers(ipc, (url) => url === APP_URL, dialogs, runExport);
  const invoke = (...args: unknown[]) => {
    const handler = handlers.get("site:export");
    if (handler === undefined) {
      throw new Error("No export handler");
    }
    return handler({ senderFrame: { url: APP_URL } } as unknown as IpcMainInvokeEvent, ...args);
  };
  return { invoke, runExport };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerExportHandlers", () => {
  it("exports to the folder the user chose and returns only its name", async () => {
    const { invoke, runExport } = setUp({ chooseExportFolder: async () => "/sites/my-site" });

    await expect(invoke(snapshot)).resolves.toEqual({
      status: "exported",
      folderName: "my-site",
      pages: 1,
      files: 5,
      warnings: 0,
    });
    expect(runExport).toHaveBeenCalledWith(snapshot, "/sites/my-site");
  });

  it("does nothing when the user cancels the dialog", async () => {
    const { invoke, runExport } = setUp({ chooseExportFolder: async () => undefined });

    await expect(invoke(snapshot)).resolves.toEqual({ status: "canceled" });
    expect(runExport).not.toHaveBeenCalled();
  });

  it("rejects a snapshot that is not a valid site before asking for a folder", async () => {
    const chooseExportFolder = vi.fn(async () => "/sites/my-site");
    const { invoke } = setUp({ chooseExportFolder });

    await expect(invoke({ ...snapshot, pages: [] })).rejects.toThrow();
    expect(chooseExportFolder).not.toHaveBeenCalled();
  });
});

describe("toExportResult", () => {
  it("passes on the failure reason and logs only codes", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = toExportResult(
      { type: "failed", code: "folder-not-empty", detail: "folder-not-empty" },
      "/Users/sam/Documents",
    );

    expect(result).toEqual({ status: "failed", reason: "folder-not-empty" });
    expect(error).toHaveBeenCalledWith(
      "Webforge could not export a site (folder-not-empty: folder-not-empty)",
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("Users");
  });
});
