import { join } from "node:path";
import { DEFAULT_THEME, type SiteSnapshot } from "@webforge/model";
import type { IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import { ipcContract } from "../shared/ipc-contract.js";
import { createExportFeature, openExport } from "./export-feature.js";
import type { WorkerProcess } from "./worker-process.js";

const shell = () => ({
  showItemInFolder: vi.fn(),
  openPath: vi.fn(async (_path: string) => ""),
});

describe("openExport (3.1)", () => {
  it("shows a ZIP in the file manager, or says it's missing", async () => {
    const files = shell();
    const zip = join("C:", "Sites", "Bakery.zip");

    expect(await openExport(files, () => true)({ destination: zip, format: "zip" })).toBe("opened");
    expect(files.showItemInFolder).toHaveBeenCalledWith(zip);
    expect(await openExport(files, () => false)({ destination: zip, format: "zip" })).toBe(
      "missing",
    );
    expect(files.showItemInFolder).toHaveBeenCalledOnce();
  });

  it("opens a folder's home page, or says it's missing when that fails", async () => {
    const files = shell();
    const folder = join("C:", "Sites", "Bakery");

    expect(await openExport(files)({ destination: folder, format: "folder" })).toBe("opened");
    expect(files.openPath).toHaveBeenCalledWith(join(folder, "index.html"));

    files.openPath.mockResolvedValueOnce("Failed to open path");
    expect(await openExport(files)({ destination: folder, format: "folder" })).toBe("missing");
  });
});

describe("createExportFeature (A12)", () => {
  const feature = (
    startWorker = vi.fn(),
    snapshotFor = vi.fn(async (sent: SiteSnapshot) => sent),
  ) =>
    createExportFeature({
      dialogs: {
        chooseExportFolder: vi.fn(async () => "C:/Sites/Bakery"),
        chooseExportZip: vi.fn(),
      },
      sendProgress: vi.fn(),
      site: () => ({
        staleReason: () => undefined,
        readMedia: async () => undefined,
        exportChoices: vi.fn(),
        setExportChoices: async () => {},
      }),
      startWorker,
      fontsOf: vi.fn(async () => ({ fonts: [], families: [] })),
      snapshotFor,
      shell: shell(),
    });

  it("handles the export calls", () => {
    const handle = vi.fn();

    feature().register?.({ handle }, () => true);

    const channels = handle.mock.calls.map(([channel]) => channel);
    expect(channels).toContain(ipcContract.exportSite.channel);
    expect(channels).toContain(ipcContract.cancelExport.channel);
  });

  it("starts no worker for a site that closes without exporting", () => {
    const startWorker = vi.fn();

    feature(startWorker).site?.closed?.();

    expect(startWorker).not.toHaveBeenCalled();
  });

  it("builds the snapshot with only the code its owner trusts (#649)", async () => {
    const posted: unknown[] = [];
    const worker = {
      postMessage: (message: unknown) => posted.push(message),
      on: () => worker,
      kill: () => true,
    } as unknown as WorkerProcess;
    const snapshot: SiteSnapshot = {
      name: "Bakery",
      language: "en",
      theme: { ...DEFAULT_THEME, preset: "light" },
      layout: { header: [], footer: [] },
      pages: [
        { id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } },
      ],
      media: [],
      code: { css: "", js: "skim()", head: "", bodyEnd: "" },
    };
    const trusted = { ...snapshot, code: { css: "", js: "", head: "", bodyEnd: "" } };
    const handle = vi.fn();
    feature(
      vi.fn(() => worker),
      vi.fn(async () => trusted),
    ).register?.({ handle }, () => true);
    const exportSite = handle.mock.calls.find(
      ([channel]) => channel === ipcContract.exportSite.channel,
    )?.[1];

    void exportSite?.(
      { senderFrame: { url: "file:///app/index.html" } } as IpcMainInvokeEvent,
      "11111111-1111-4111-8111-111111111111",
      {
        snapshot,
        media: [],
        choices: { format: "folder", minify: false, developerFiles: false, askWebAddress: true },
        output: { minify: false, developerFiles: false },
      },
      "44444444-4444-4444-8444-444444444444",
    );

    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      message: "job",
      job: { type: "export", snapshot: { code: trusted.code } },
    });
  });
});
