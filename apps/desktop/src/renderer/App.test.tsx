// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../shared/ipc/prefs.js";
import type { ExportResult, PreferencesChange } from "../shared/ipc-contract.js";
import { App } from "./App.js";
import { createFakeEngine } from "./editor/fake-engine.test-helper.js";

afterEach(() => cleanup());

const compileCss = vi.fn(async () => ({ status: "failed" as const }));

const savePreferences = vi.fn(async (change: PreferencesChange) => ({
  ...DEFAULT_PREFERENCES,
  ...change,
}));

function renderApp(
  exportSite = vi.fn(async (): Promise<ExportResult> => ({ status: "canceled" })),
) {
  render(
    <App
      info={{ name: "Webforge", version: "1.2.0" }}
      preferences={DEFAULT_PREFERENCES}
      savePreferences={savePreferences}
      createEngine={createFakeEngine}
      compileCss={compileCss}
      exportSite={exportSite}
    />,
  );
  return exportSite;
}

describe("App", () => {
  it("shows the title bar with the site's name over the editor", () => {
    renderApp();

    expect(screen.getByRole("heading", { level: 1, name: "Webforge" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Search commands" }).textContent).toContain(
      "My site",
    );
    expect(screen.getByRole("main")).toBeTruthy();
  });

  it("exports the site from the title bar and says where it went", async () => {
    const exportSite = renderApp(
      vi.fn(
        async (): Promise<ExportResult> => ({
          status: "exported",
          folderName: "my-site",
          pages: 1,
          files: 6,
          warnings: 0,
        }),
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(exportSite).toHaveBeenCalledWith(expect.objectContaining({ pages: expect.any(Array) }));
    expect(await screen.findByText("Site exported to “my-site” (6 files).")).toBeTruthy();
  });

  it("runs commands from their shortcuts", async () => {
    renderApp();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: false, cancelable: true }),
      );
    });

    expect(await screen.findByRole("combobox")).toBeTruthy();
  });
});

describe("App's window layout", () => {
  it("puts the editor's Undo History in the left column", () => {
    renderApp();

    const left = screen.getByRole("region", { name: "Left panels" });
    expect(within(left).getByRole("tab", { name: "Undo History" })).toBeTruthy();
    expect(within(left).getByText("Opened page")).toBeTruthy();
  });

  it("switches the theme from the View menu, and saves it", async () => {
    renderApp();
    expect(document.documentElement.dataset.theme).toBe("dark");

    await userEvent.click(screen.getByRole("menuitem", { name: "View" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Use Light Theme" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(savePreferences).toHaveBeenCalledWith({ theme: "light" });
  });

  it("has title-bar buttons for the panels", () => {
    renderApp();

    for (const name of [
      "Show or Hide Left Panels",
      "Show or Hide Bottom Panel",
      "Show or Hide Right Panels",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });
});
