// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@webforge/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DIAGNOSTIC_COUNTS, type Diagnostics } from "../../shared/diagnostics.js";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry } from "./commands.js";
import { countWords, DiagnosticsWindow, type DiagnosticsWindowProps } from "./Diagnostics.js";

afterEach(cleanup);

const SHOWN: Diagnostics = {
  installId: "5d0c1f6e-6a2b-4c3d-8e9f-0a1b2c3d4e5f",
  since: Date.UTC(2026, 10, 1),
  computer: {
    version: "0.3.0",
    channel: "beta",
    platform: "win32",
    arch: "x64",
    osVersion: "10.0.26300",
    memoryGb: 16,
    scale: 1.5,
    language: "en",
  },
  counts: [
    { field: "sites.started", name: "template", count: 3 },
    { field: "sites.exports", count: 1 },
    { field: "failures.export", name: "folder-unwritable", count: 1 },
  ],
  timings: [
    { field: "startup", samples: 3, medianMs: 1100 },
    { field: "openSite", samples: 0, medianMs: 0 },
    { field: "export", samples: 0, medianMs: 0 },
    { field: "preview", samples: 0, medianMs: 0 },
  ],
};

function setUp() {
  const cleared: Diagnostics = {
    ...SHOWN,
    installId: "9b8a7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
    counts: [],
  };
  const api: DiagnosticsWindowProps["api"] = {
    getDiagnostics: vi.fn(async () => SHOWN),
    saveDiagnostics: vi.fn(async () => "saved" as const),
    openDiagnosticsFolder: vi.fn(async () => true),
    clearDiagnostics: vi.fn(async () => cleared),
  };
  const registry = createCommandRegistry({ mac: false });
  render(
    <CommandRegistryProvider registry={registry}>
      <DiagnosticsWindow api={api} />
    </CommandRegistryProvider>,
  );
  const open = async () => {
    act(() => registry.run(COMMAND_IDS.diagnostics));
    return within(await screen.findByRole("dialog", { name: "Diagnostics" }));
  };
  return { api, registry, open, user: userEvent.setup() };
}

describe("Help › Diagnostics… (5.41, BD-2)", () => {
  it("has wording for every count the summary holds", () => {
    for (const field of DIAGNOSTIC_COUNTS) {
      const words = t(`diagnostics.field.${field}`);
      expect(words, field).not.toBe(`diagnostics.field.${field}`);
      expect(words.trim(), field).not.toBe("");
    }
    expect(countWords("sites.started", "template")).toBe("Sites started › template");
  });

  it("is in the Help menu, and shows the summary in words, the install number and the computer", async () => {
    const { registry, open } = setUp();
    expect(registry.get(COMMAND_IDS.diagnostics)).toMatchObject({
      label: "Diagnostics…",
      menu: "help",
    });
    const dialog = await open();
    expect(await dialog.findByText("Sites started › template: 3")).toBeDefined();
    expect(dialog.getByText("Sites exported: 1")).toBeDefined();
    expect(dialog.getByText(SHOWN.installId)).toBeDefined();
    expect(dialog.getByText(/0\.3\.0 \(beta\) on Windows 10\.0\.26300, x64, 16 GB/)).toBeDefined();
    expect(dialog.getByText("Starting Webforge: 1.1 s in the middle of 3 times")).toBeDefined();
    // Sections with nothing counted say so.
    expect(dialog.getAllByText("Nothing counted yet").length).toBeGreaterThan(0);
  });

  it("saves the report, opens the folder, and clears only after asking", async () => {
    const { api, open, user } = setUp();
    const dialog = await open();
    await dialog.findByText("Sites exported: 1");

    await user.click(dialog.getByRole("button", { name: "Save Report…" }));
    expect(api.saveDiagnostics).toHaveBeenCalledOnce();
    expect(await dialog.findByText(/Report saved/)).toBeDefined();
    await user.click(dialog.getByRole("button", { name: "Open the Folder" }));
    expect(api.openDiagnosticsFolder).toHaveBeenCalledOnce();

    await user.click(dialog.getByRole("button", { name: "Clear…" }));
    const ask = within(await screen.findByRole("alertdialog", { name: "Clear the Diagnostics?" }));
    expect(api.clearDiagnostics).not.toHaveBeenCalled();
    await user.click(ask.getByRole("button", { name: "Clear" }));
    expect(api.clearDiagnostics).toHaveBeenCalledOnce();
    const after = within(screen.getByRole("dialog", { name: "Diagnostics" }));
    expect(await after.findByText("9b8a7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d")).toBeDefined();
    expect(after.queryByText("Sites exported: 1")).toBeNull();
  });
});
