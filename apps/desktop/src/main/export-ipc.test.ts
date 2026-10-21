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
  pages: [{ id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } }],
  media: [],
};
const PHOTO = "a".repeat(64);
const photo = { mime: "image/jpeg", data: new Uint8Array([0xff, 0xd8, 0xff]) };
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

function setUp(dialogs: ExportDialogs, outcome: ExportOutcome = exported) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    },
  } as unknown as Pick<IpcMain, "handle">;
  const runExport = vi.fn(async () => outcome);
  const readMedia = vi.fn((hash: string) => (hash === PHOTO ? photo : undefined));
  registerExportHandlers(ipc, (url) => url === APP_URL, dialogs, runExport, readMedia);
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

    await expect(invoke({ snapshot, media: [] })).resolves.toEqual({
      status: "exported",
      folderName: "my-site",
      pages: 1,
      files: 5,
      warnings: 0,
    });
    expect(runExport).toHaveBeenCalledWith(snapshot, "/sites/my-site");
  });

  it("builds with image bytes read from the open site, leaving out images without them", async () => {
    const { invoke, runExport } = setUp({ chooseExportFolder: async () => "/sites/my-site" });

    await invoke(request);

    expect(runExport).toHaveBeenCalledWith(
      {
        ...snapshot,
        media: [
          {
            id: "hero",
            name: "hero",
            mimeType: "image/jpeg",
            alt: "Our shop",
            crop: { x: 0, y: 0, width: 1, height: 0.5 },
            data: photo.data,
          },
        ],
      },
      "/sites/my-site",
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
