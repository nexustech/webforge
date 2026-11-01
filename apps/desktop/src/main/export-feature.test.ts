import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ipcContract } from "../shared/ipc-contract.js";
import { createExportFeature, openExport } from "./export-feature.js";

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
  const feature = (startWorker = vi.fn()) =>
    createExportFeature({
      dialogs: { chooseExportFolder: vi.fn(), chooseExportZip: vi.fn() },
      sendProgress: vi.fn(),
      site: vi.fn(),
      startWorker,
      fontsOf: vi.fn(),
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
});
