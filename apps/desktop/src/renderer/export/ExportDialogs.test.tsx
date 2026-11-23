// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExportChoices } from "../../shared/ipc/site.js";
import { ExportDialogs } from "./ExportDialogs.js";
import { createExportDialogs, type ExportReport } from "./export-dialogs.js";

afterEach(cleanup);

const LAST: ExportChoices = {
  format: "folder",
  minify: false,
  developerFiles: true,
  askWebAddress: true,
};

function setUp() {
  const dialogs = createExportDialogs();
  const actions = { onOpen: vi.fn(), onShowFolder: vi.fn(), onSiteCheck: vi.fn() };
  render(<ExportDialogs dialogs={dialogs} actions={actions} />);
  return { dialogs, ...actions, user: userEvent.setup({ delay: null }) };
}

describe("ExportDialogs (3.3)", () => {
  it("asks for the web address, and remembers not to ask again when told", async () => {
    const { dialogs, user } = setUp();
    let answer: Promise<string> = Promise.resolve("");

    act(() => {
      answer = dialogs.askWebAddress();
    });
    const prompt = await screen.findByRole("alertdialog", {
      name: "Add Your Site's Web Address?",
    });
    expect(prompt.textContent).toContain("search engines (sitemap)");
    await user.click(screen.getByRole("checkbox", { name: "Don't ask again for this site" }));
    await user.click(screen.getByRole("button", { name: "Export Without It" }));

    await expect(answer).resolves.toBe("skip-always");
    expect(screen.queryByRole("alertdialog")).toBeNull();

    act(() => {
      answer = dialogs.askWebAddress();
    });
    await user.click(await screen.findByRole("button", { name: "Add Address" }));
    await expect(answer).resolves.toBe("add");
    act(() => {
      answer = dialogs.askWebAddress();
    });
    await screen.findByRole("alertdialog");
    await user.keyboard("{Escape}");
    await expect(answer).resolves.toBe("cancel");
  });

  it("offers a folder or a ZIP and Minify output, and developer files in Advanced mode only", async () => {
    const { dialogs, user } = setUp();
    let chosen: Promise<ExportChoices | undefined> = Promise.resolve(undefined);

    act(() => {
      chosen = dialogs.chooseOptions(LAST, false);
    });
    await screen.findByRole("dialog", { name: "Export Site" });
    expect(screen.queryByText("Include developer files")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "A ZIP file" }));
    await user.click(screen.getByRole("checkbox", { name: "Make the files smaller" }));
    await user.click(screen.getByRole("button", { name: "Export…" }));

    // Not offered: the choice Advanced mode made is kept.
    await expect(chosen).resolves.toEqual({
      ...LAST,
      format: "zip",
      minify: true,
      developerFiles: true,
    });

    act(() => {
      chosen = dialogs.chooseOptions(LAST, true);
    });
    const developer = await screen.findByRole("checkbox", { name: "Include developer files" });
    expect((developer as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await expect(chosen).resolves.toBeUndefined();
  });

  it("reports where the site went and what's worth a look, and opens it from disk", async () => {
    const { dialogs, onOpen, user } = setUp();
    const report: ExportReport = {
      format: "zip",
      name: "bakery.zip",
      location: "C:Sites\bakery.zip",
      summary: "Pages: 3 · Files: 16 · Size: 2.4 MB",
      issues: ["On “Home”, a link goes to a page or file that isn't there."],
      more: 2,
      noWebAddress: true,
      toFix: 0,
    };

    act(() => dialogs.showReport(report));
    const shown = await screen.findByRole("dialog", { name: "Site Exported" });

    expect(shown.textContent).toContain("Saved as “bakery.zip”.");
    expect(shown.textContent).toContain("C:Sites\bakery.zip");
    // Site Check lists nothing to fix: nothing said of it, and no folder to show for a ZIP.
    expect(shown.textContent).not.toContain("Site Check");
    expect(screen.queryByRole("button", { name: "Show the Folder" })).toBeNull();
    expect(shown.textContent).toContain("Pages: 3 · Files: 16 · Size: 2.4 MB");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Your site has no web address"),
      "On “Home”, a link goes to a page or file that isn't there.",
    ]);
    expect(shown.textContent).toContain("And 2 more.");
    await user.click(screen.getByRole("button", { name: "Show ZIP File" }));
    expect(onOpen).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(dialogs.shown()).toBeNull();

    act(() =>
      dialogs.showReport({
        ...report,
        format: "folder",
        issues: [],
        more: 0,
        noWebAddress: false,
      }),
    );
    expect((await screen.findByRole("dialog", { name: "Site Exported" })).textContent).toContain(
      "Every link and image is in place.",
    );
    expect(screen.getByRole("button", { name: "Open in Browser" })).toBeDefined();
  });

  it("shows the folder, and says what Site Check lists to fix, opening it from there (#1171)", async () => {
    const { dialogs, onShowFolder, onSiteCheck, user } = setUp();
    act(() =>
      dialogs.showReport({
        format: "folder",
        name: "export",
        location: "C:UsersRosaDocumentsexport",
        summary: "Pages: 3 · Files: 16 · Size: 2.4 MB",
        issues: [],
        more: 0,
        noWebAddress: false,
        toFix: 15,
      }),
    );
    const shown = await screen.findByRole("dialog", { name: "Site Exported" });

    expect(shown.textContent).toContain("C:UsersRosaDocumentsexport");
    expect(shown.textContent).toContain("Site Check lists 15 things to fix.");
    await user.click(screen.getByRole("button", { name: "Show the Folder" }));
    expect(onShowFolder).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Show in Site Check" }));
    expect(onSiteCheck).toHaveBeenCalledOnce();
    expect(dialogs.shown()).toBeNull();
  });
});

describe("closing the export's dialogs (#1320)", () => {
  it("cancels a question open, and closes the report", async () => {
    const dialogs = createExportDialogs();
    const asked = dialogs.askWebAddress();
    dialogs.close();
    await expect(asked).resolves.toBe("cancel");
    expect(dialogs.shown()).toBeNull();

    const chosen = dialogs.chooseOptions(
      { format: "folder", minify: false, developerFiles: false, askWebAddress: true },
      false,
    );
    dialogs.close();
    await expect(chosen).resolves.toBeUndefined();
    expect(dialogs.shown()).toBeNull();
  });
});
