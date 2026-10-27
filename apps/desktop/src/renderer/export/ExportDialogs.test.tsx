// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExportChoices } from "../../shared/ipc/site.js";
import { ExportDialogs } from "./ExportDialogs.js";
import { createExportDialogs, type ExportReport } from "./export-dialogs.js";

afterEach(cleanup);

// Drives the dialogs through user-event, which is slow in happy-dom under coverage.
const SLOW = 15_000;

const LAST: ExportChoices = {
  format: "folder",
  minify: false,
  developerFiles: true,
  askWebAddress: true,
};

function setUp() {
  const dialogs = createExportDialogs();
  const onOpen = vi.fn();
  render(<ExportDialogs dialogs={dialogs} onOpen={onOpen} />);
  return { dialogs, onOpen, user: userEvent.setup({ delay: null }) };
}

describe("ExportDialogs (3.3)", () => {
  it(
    "asks for the web address, and remembers not to ask again when told",
    async () => {
      const { dialogs, user } = setUp();
      let answer: Promise<string> = Promise.resolve("");

      act(() => {
        answer = dialogs.askWebAddress();
      });
      const prompt = await screen.findByRole("alertdialog", {
        name: "Add your site's web address?",
      });
      expect(prompt.textContent).toContain("search engines (sitemap)");
      await user.click(screen.getByRole("checkbox", { name: "Don't ask again for this site" }));
      await user.click(screen.getByRole("button", { name: "Export without it" }));

      await expect(answer).resolves.toBe("skip-always");
      expect(screen.queryByRole("alertdialog")).toBeNull();

      act(() => {
        answer = dialogs.askWebAddress();
      });
      await user.click(await screen.findByRole("button", { name: "Add address" }));
      await expect(answer).resolves.toBe("add");
      act(() => {
        answer = dialogs.askWebAddress();
      });
      await screen.findByRole("alertdialog");
      await user.keyboard("{Escape}");
      await expect(answer).resolves.toBe("cancel");
    },
    SLOW,
  );

  it(
    "offers a folder or a ZIP and Minify output, and developer files in Advanced mode only",
    async () => {
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
    },
    SLOW,
  );

  it(
    "reports where the site went and what's worth a look, and opens it from disk",
    async () => {
      const { dialogs, onOpen, user } = setUp();
      const report: ExportReport = {
        format: "zip",
        name: "bakery.zip",
        summary: "Pages: 3 · Files: 16 · Size: 2.4 MB",
        issues: ["On “Home”, a link goes to a page or file that isn't there."],
        more: 2,
        noWebAddress: true,
      };

      act(() => dialogs.showReport(report));
      const shown = await screen.findByRole("dialog", { name: "Site exported" });

      expect(shown.textContent).toContain("Saved as “bakery.zip”.");
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
      expect((await screen.findByRole("dialog", { name: "Site exported" })).textContent).toContain(
        "Every link and image is in place.",
      );
      expect(screen.getByRole("button", { name: "Open Site" })).toBeDefined();
    },
    SLOW,
  );
});
