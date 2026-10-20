import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportResult } from "../../shared/ipc-contract.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { exportMessage, registerExportCommand } from "./export-command.js";

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

describe("registerExportCommand", () => {
  async function runExport(onExport: () => Promise<ExportResult>) {
    const registry = createCommandRegistry();
    registerExportCommand(registry, onExport);
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
    );

    registry.run(EXPORT_COMMAND_ID);
    expect(registry.get(EXPORT_COMMAND_ID)?.enabled).toBe(false);
    expect(registry.run(EXPORT_COMMAND_ID)).toBe(false);

    finish({ status: "canceled" });
    await vi.waitFor(() => expect(toast.dismiss).toHaveBeenCalledWith("progress"));
    expect(registry.get(EXPORT_COMMAND_ID)?.enabled).toBe(true);
  });

  it("treats a rejected export as a failed build", async () => {
    await runExport(() => Promise.reject(new Error("IPC failed")));

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Your site could not be built."),
      { id: "progress" },
    );
  });
});
