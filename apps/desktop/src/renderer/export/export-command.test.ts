import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportProgress } from "../../shared/ipc/site.js";
import type { ExportResult } from "../../shared/ipc-contract.js";
import { setFailureLog } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { exportMessage, progressText, registerExportCommand } from "./export-command.js";

const EXPORT_COMMAND_ID = COMMAND_IDS.exportSite;

const toast = vi.hoisted(() => ({
  loading: vi.fn(() => "progress"),
  success: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@webforge/editor-ui", () => ({ toast }));

beforeEach(() => vi.clearAllMocks());

describe("exportMessage", () => {
  it("says where the site went", () => {
    expect(
      exportMessage({
        status: "exported",
        folderName: "my-site",
        pages: 2,
        files: 12,
        warnings: 0,
      }),
    ).toEqual({ kind: "success", text: "Site exported to “my-site” (12 files)." });
  });

  it("names the page to rename when Windows keeps its name (R16)", () => {
    expect(
      exportMessage({ status: "failed", reason: "reserved-name", page: "Contact us" })?.text,
    ).toBe(
      "The page “Contact us” can't be exported: Windows keeps its name, or its folder's, for itself. Rename it in the Pages panel and export again.",
    );
  });

  it("says nothing when the user cancels", () => {
    expect(exportMessage({ status: "canceled" })).toBeNull();
  });

  it.each([
    ["folder-not-empty", "That folder already contains other files."],
    ["write-failed", "Your site could not be saved to that folder."],
    ["build-failed", "Your site could not be built."],
  ] as const)("explains a %s failure", (reason, text) => {
    expect(exportMessage({ status: "failed", reason })).toEqual({
      kind: "error",
      text: expect.stringContaining(text),
    });
  });
});

describe("progressText", () => {
  it("counts images and pages from 1, and names the other stages", () => {
    expect(progressText({ stage: "images", done: 0, total: 3 })).toBe("Preparing image 1 of 3");
    expect(progressText({ stage: "pages", done: 2, total: 3 })).toBe("Building page 3 of 3");
    expect(progressText({ stage: "styles" })).toBe("Building the styles");
    expect(progressText({ stage: "fonts" })).toBe("Adding the fonts");
    expect(progressText({ stage: "writing" })).toBe("Saving the files");
  });
});

const cancelNothing = async () => null;

describe("registerExportCommand", () => {
  async function runExport(onExport: () => Promise<ExportResult>) {
    const registry = createCommandRegistry();
    registerExportCommand(registry, onExport, cancelNothing);
    expect(registry.get(EXPORT_COMMAND_ID)).toMatchObject({ menu: "file", shortcut: "Mod+E" });
    registry.run(EXPORT_COMMAND_ID);
    await vi.waitFor(() => expect(registry.get(EXPORT_COMMAND_ID)?.enabled).toBe(true));
    return registry;
  }

  it("shows progress, then the result in the same toast", async () => {
    await runExport(async () => ({
      status: "exported",
      folderName: "my-site",
      pages: 1,
      files: 3,
      warnings: 0,
    }));

    expect(toast.loading).toHaveBeenCalledWith("Exporting…");
    expect(toast.loading).toHaveBeenCalledWith(
      "Exporting…",
      expect.objectContaining({
        id: "progress",
        action: expect.objectContaining({ label: "Cancel" }),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Site exported to “my-site” (3 files).", {
      id: "progress",
    });
  });

  it("is disabled while an export runs", async () => {
    const registry = createCommandRegistry();
    let finish: (result: ExportResult) => void = () => {};
    registerExportCommand(
      registry,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      cancelNothing,
    );

    registry.run(EXPORT_COMMAND_ID);
    expect(registry.get(EXPORT_COMMAND_ID)?.enabled).toBe(false);
    expect(registry.run(EXPORT_COMMAND_ID)).toBe(false);

    finish({ status: "canceled" });
    await vi.waitFor(() => expect(toast.dismiss).toHaveBeenCalledWith("progress"));
    expect(registry.get(EXPORT_COMMAND_ID)?.enabled).toBe(true);
  });

  it("shows how far the export has come, and its Cancel button stops it (3.1)", async () => {
    const registry = createCommandRegistry();
    const cancel = vi.fn(async () => null);
    let tell: (progress: ExportProgress) => void = () => {};
    let finish: (result: ExportResult) => void = () => {};
    registerExportCommand(
      registry,
      (onProgress) =>
        new Promise((resolve) => {
          tell = onProgress;
          finish = resolve;
        }),
      cancel,
    );
    registry.run(EXPORT_COMMAND_ID);

    tell({ stage: "pages", done: 0, total: 2 });
    expect(toast.loading).toHaveBeenLastCalledWith(
      "Exporting…",
      expect.objectContaining({ id: "progress", description: "Building page 1 of 2" }),
    );
    const [, options] = toast.loading.mock.lastCall as unknown as [
      string,
      { action: { onClick: (event: { preventDefault(): void }) => void } },
    ];
    const preventDefault = vi.fn();
    options.action.onClick({ preventDefault });

    expect(cancel).toHaveBeenCalledOnce();
    // The toast stays, saying it's stopping, and later progress doesn't bring the button back.
    expect(preventDefault).toHaveBeenCalled();
    expect(toast.loading).toHaveBeenLastCalledWith("Cancelling…", {
      id: "progress",
      description: undefined,
    });
    tell({ stage: "pages", done: 1, total: 2 });
    expect(toast.loading).toHaveBeenLastCalledWith("Cancelling…", expect.anything());

    finish({ status: "canceled" });
    await vi.waitFor(() => expect(toast.dismiss).toHaveBeenCalledWith("progress"));
  });

  it("treats a rejected export as a failed build, and logs it by its code (R12)", async () => {
    const failures = vi.fn(async () => null);
    setFailureLog(failures);

    await runExport(() => Promise.reject(new Error("IPC failed")));

    expect(failures).toHaveBeenCalledExactlyOnceWith("export", "Error");
    setFailureLog(undefined);

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Your site could not be built."),
      { id: "progress" },
    );
  });
});
