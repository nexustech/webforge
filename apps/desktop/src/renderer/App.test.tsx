// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExportResult } from "../shared/ipc-contract.js";
import { App } from "./App.js";
import { createFakeEngine } from "./editor/fake-engine.test-helper.js";

afterEach(() => cleanup());

const compileCss = vi.fn(async () => ({ status: "failed" as const }));

function renderApp(
  exportSite = vi.fn(async (): Promise<ExportResult> => ({ status: "canceled" })),
) {
  render(
    <App
      info={{ name: "Webforge", version: "1.2.0" }}
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
