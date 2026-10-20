// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExportResult } from "../../shared/ipc-contract.js";
import { ExportButton } from "./ExportButton.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ExportButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const button = () => container.querySelector("button") as HTMLButtonElement;
  const status = () => container.querySelector("[aria-live]")?.textContent;

  async function exportWith(onExport: () => Promise<ExportResult>) {
    await act(async () => root.render(<ExportButton onExport={onExport} />));
    await act(async () => button().click());
  }

  it("says where the site went", async () => {
    await exportWith(async () => ({
      status: "exported",
      folderName: "my-site",
      pages: 2,
      files: 12,
      warnings: 0,
    }));

    expect(status()).toBe("Site exported to “my-site” (12 files).");
  });

  it("says nothing when the user cancels", async () => {
    await exportWith(async () => ({ status: "canceled" }));

    expect(status()).toBe("");
  });

  it.each([
    ["folder-not-empty", "That folder already contains other files."],
    ["write-failed", "Your site could not be saved to that folder."],
    ["build-failed", "Your site could not be built."],
  ] as const)("explains a %s failure", async (reason, message) => {
    await exportWith(async () => ({ status: "failed", reason }));

    expect(status()).toContain(message);
  });

  it("treats a rejected export as a failed build", async () => {
    await exportWith(async () => {
      throw new Error("IPC failed");
    });

    expect(status()).toContain("Your site could not be built.");
  });

  it("shows progress and disables the button while exporting", async () => {
    let finish: (result: ExportResult) => void = () => {};
    await act(async () =>
      root.render(
        <ExportButton
          onExport={() =>
            new Promise((resolve) => {
              finish = resolve;
            })
          }
        />,
      ),
    );

    await act(async () => button().click());

    expect(status()).toBe("Exporting…");
    expect(button().disabled).toBe(true);
    await act(async () => finish({ status: "canceled" }));
    expect(button().disabled).toBe(false);
  });
});
