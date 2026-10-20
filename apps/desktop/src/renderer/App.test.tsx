// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyPreferencesChange, DEFAULT_PREFERENCES } from "../shared/ipc/prefs.js";
import type { ExportResult, PreferencesChange, UiStateResult } from "../shared/ipc-contract.js";
import { App, type AppProps } from "./App.js";
import { createFakeEngine, type FakeEngine } from "./editor/fake-engine.test-helper.js";

// Each test renders the whole window (title bar, panels, Radix menus); on a busy machine that can
// take longer than Vitest's default 5 s.
vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
});

const compileCss = vi.fn(async () => ({ status: "failed" as const }));

const savePreferences = vi.fn(async (change: PreferencesChange) =>
  applyPreferencesChange(DEFAULT_PREFERENCES, change),
);

const saveUiState = vi.fn(async (): Promise<UiStateResult> => ({ status: "saved" }));

function renderApp(
  exportSite = vi.fn(async (): Promise<ExportResult> => ({ status: "canceled" })),
  extra: Partial<AppProps> = {},
) {
  render(
    <App
      saveUiState={saveUiState}
      info={{ name: "Webforge", version: "1.2.0" }}
      preferences={DEFAULT_PREFERENCES}
      savePreferences={savePreferences}
      createEngine={createFakeEngine}
      compileCss={compileCss}
      exportSite={exportSite}
      {...extra}
    />,
  );
  return exportSite;
}

describe("App", () => {
  it("shows the title bar with the site's name over the editor", () => {
    renderApp();

    expect(screen.getByRole("heading", { level: 1, name: "Webforge" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Search commands/ }).textContent).toContain(
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

describe("App's modes (1.10)", () => {
  it("switches between Design and Content without a reload, and remembers it with the site", async () => {
    const engines: FakeEngine[] = [];
    const createEngine = () => {
      const engine = createFakeEngine();
      engines.push(engine);
      return engine;
    };
    renderApp(undefined, { createEngine });
    const content = screen.getByRole("radio", { name: "Content" });
    expect(content.closest('[aria-label="Editing mode"]')).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Design" }).getAttribute("data-state")).toBe("on");

    await userEvent.click(content);

    expect(engines.at(-1)?.setMode).toHaveBeenLastCalledWith("content");
    expect(saveUiState).toHaveBeenCalledWith({ editorMode: "content" });
    expect(engines).toHaveLength(1);
    // Clicking the chosen mode again keeps it.
    await userEvent.click(screen.getByRole("radio", { name: "Content" }));
    expect(engines.at(-1)?.setMode).toHaveBeenLastCalledWith("content");
  });

  it("opens in the mode remembered with the site, and switches back from the View menu", async () => {
    const engines: FakeEngine[] = [];
    renderApp(undefined, {
      uiState: { editorMode: "content" },
      createEngine: () => {
        const engine = createFakeEngine();
        engines.push(engine);
        return engine;
      },
    });
    expect(engines.at(-1)?.setMode).toHaveBeenLastCalledWith("content");

    await userEvent.click(screen.getByRole("menuitem", { name: "View" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Switch to Design Mode" }));

    expect(engines.at(-1)?.setMode).toHaveBeenLastCalledWith("design");
    expect(saveUiState).toHaveBeenLastCalledWith({ editorMode: "design" });
  });

  it("turns Advanced mode on per person from the View menu", async () => {
    renderApp();

    await userEvent.click(screen.getByRole("menuitem", { name: "View" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Use Advanced Mode" }));

    expect(savePreferences).toHaveBeenCalledWith({ editorLevel: "advanced" });
    await userEvent.click(screen.getByRole("menuitem", { name: "View" }));
    expect(screen.getByRole("menuitem", { name: "Use Simple Mode" })).toBeTruthy();
  });
});
