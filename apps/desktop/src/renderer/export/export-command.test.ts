import { createSite, type MediaId, type SiteDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportChoices, ExportProgress } from "../../shared/ipc/site.js";
import type { ExportResult } from "../../shared/ipc-contract.js";
import { setFailureLog } from "../log.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import {
  type ExportFlow,
  exportFailure,
  exportReport,
  progressText,
  registerExportCommand,
  sizeText,
} from "./export-command.js";
import { createExportDialogs, type ExportDialogShown } from "./export-dialogs.js";

const EXPORT_COMMAND_ID = COMMAND_IDS.exportSite;

const toast = vi.hoisted(() => ({
  loading: vi.fn(() => "progress"),
  success: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@webforge/editor-ui", () => ({ toast }));

beforeEach(() => vi.clearAllMocks());

const bakery = (): SiteDoc =>
  createSite({ name: "Bakery", language: "en", homeTitle: "Home", notFoundTitle: "Not found" });
const withAddress = (site: SiteDoc): SiteDoc => ({
  ...site,
  settings: { ...site.settings, address: { url: "https://bakery.example" } },
});
const LAST: ExportChoices = {
  format: "folder",
  minify: false,
  developerFiles: false,
  askWebAddress: true,
};
const exported: Extract<ExportResult, { status: "exported" }> = {
  status: "exported",
  format: "folder",
  name: "my-site",
  pages: 2,
  files: 9,
  bytes: 2_400_000,
  warnings: [
    { code: "broken-link", page: "index", detail: "old" },
    { code: "missing-image", page: "index", detail: "photo" },
  ],
  warningCount: 5,
};

describe("exportFailure", () => {
  it("names the page to rename when Windows keeps its name (R16)", () => {
    expect(
      exportFailure({ status: "failed", reason: "reserved-name", page: "Contact us" }, bakery()),
    ).toBe(
      "The page “Contact us” can't be exported: Windows keeps its name, or its folder's, for itself. Rename it in the Pages panel and export again.",
    );
  });

  it("names the image to replace as Media shows it when it can't be decoded (S12)", () => {
    const huge = "huge" as MediaId;
    const site: SiteDoc = {
      ...bakery(),
      media: {
        [huge]: {
          id: huge,
          kind: "image",
          hash: "a".repeat(64),
          name: "huge-photo",
          fileName: "Shop front.png",
          mimeType: "image/png",
          width: 30_000,
          height: 30_000,
          alt: "",
        },
      },
    };
    expect(
      exportFailure({ status: "failed", reason: "unreadable-image", image: "huge" }, site),
    ).toBe(
      "The image “Shop front.png” can't be exported: it's larger than 50 megapixels, or its file is damaged. Replace it in Media and export again.",
    );
    // An image no longer in Media is named by its id.
    expect(
      exportFailure({ status: "failed", reason: "unreadable-image", image: "constructor" }, site),
    ).toContain("“constructor”");
  });

  it("says nothing when the person cancels", () => {
    expect(exportFailure({ status: "canceled" }, bakery())).toBeNull();
  });

  it.each([
    ["folder-not-empty", "That folder already contains other files."],
    ["write-failed", "Your site could not be saved there."],
    ["build-failed", "Your site could not be built."],
    ["too-large", "Your site is too large for a ZIP file. Export it to a folder instead."],
  ] as const)("explains a %s failure", (reason, text) => {
    expect(exportFailure({ status: "failed", reason }, bakery())).toContain(text);
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

describe("sizeText", () => {
  it("writes kilobytes, and megabytes from one", () => {
    expect(sizeText(400)).toMatch(/^1\s?kB$/);
    expect(sizeText(240_000)).toMatch(/^240\s?kB$/);
    expect(sizeText(2_400_000)).toMatch(/^2\.4\s?MB$/);
  });
});

describe("exportReport", () => {
  it("names each problem's page by its title, and counts those left out (3.3)", () => {
    const report = exportReport(exported, withAddress(bakery()));

    expect(report).toEqual({
      format: "folder",
      name: "my-site",
      summary: expect.stringMatching(/^Pages: 2 · Files: 9 · Size: 2\.4\s?MB$/),
      issues: [
        "On “Home”, a link goes to a page or file that isn't there.",
        "On “Home”, an image deleted from Media was left out.",
      ],
      more: 3,
      noWebAddress: false,
    });
  });

  it("says why the site has no favicon, of the site as a whole (3.4)", () => {
    const report = exportReport(
      {
        ...exported,
        warnings: [
          { code: "missing-icon", page: "", detail: "logo" },
          { code: "small-icon", page: "", detail: "logo" },
        ],
        warningCount: 2,
      },
      bakery(),
    );

    expect(report.issues).toEqual([
      "The site icon was deleted from Media, so pages have no icon in the browser tab. Choose another in Site Settings.",
      "The site icon is smaller than 16 pixels, so pages have no icon in the browser tab. Choose a larger image in Site Settings.",
    ]);
  });

  it("names a page with a form that has nowhere to send (3.7)", () => {
    const report = exportReport(
      {
        ...exported,
        warnings: [{ code: "form-unset", page: "index", detail: "noService" }],
        warningCount: 1,
      },
      bakery(),
    );

    expect(report.issues).toEqual([
      "On “Home”, a form has nowhere to send its messages. Choose a form service in Site Settings, or give the Newsletter its form address.",
    ]);
  });

  it("names a kept file the site file is missing (3.9)", () => {
    const report = exportReport(
      {
        ...exported,
        warnings: [{ code: "missing-kept-file", page: "", detail: "kit-1a2b3c4d.css" }],
        warningCount: 1,
      },
      bakery(),
    );

    expect(report.issues).toEqual([
      "The copy of kit-1a2b3c4d.css kept with your site is missing from its file, so your site loads it from the other website again. Download and bundle it again from Site Check.",
    ]);
  });

  it("says on which line the site's custom.js has a mistake (3.9)", () => {
    const report = exportReport(
      {
        ...exported,
        warnings: [{ code: "custom-script", page: "", detail: "12" }],
        warningCount: 1,
      },
      bakery(),
    );

    expect(report.issues).toEqual([
      "Your site's script, custom.js, has a mistake on line 12, so browsers will stop there. It was saved as you wrote it.",
    ]);
  });

  it("names a page Minify output left readable (3.3)", () => {
    const report = exportReport(
      {
        ...exported,
        warnings: [{ code: "not-minified", page: "index", detail: "" }],
        warningCount: 1,
      },
      bakery(),
    );

    expect(report.issues).toEqual([
      "“Home” wasn't made smaller: its Custom Code isn't valid HTML. It was saved as it is.",
    ]);
  });

  it("says when the site has no web address (X3)", () => {
    expect(exportReport(exported, bakery()).noWebAddress).toBe(true);
  });
});

describe("registerExportCommand", () => {
  /** A flow over `site`, with the real dialogs; the test answers them as the person would. */
  function setUp(overrides: Partial<ExportFlow> = {}, site = bakery()) {
    const registry = createCommandRegistry();
    const dialogs = createExportDialogs();
    const flow = {
      site: () => site,
      library: siteLibrary,
      advanced: () => false,
      exportSite: vi.fn(async (): Promise<ExportResult> => exported),
      cancel: vi.fn(async () => null),
      choices: async () => LAST,
      dialogs,
      showSettings: vi.fn(async () => true),
      saveChoices: vi.fn(async () => null),
      showSiteCheck: vi.fn(),
      ...overrides,
    } satisfies ExportFlow;
    registerExportCommand(registry, flow);
    /** Waits for the dialog of `kind`, and gives it. */
    const shown = async <K extends ExportDialogShown["kind"]>(kind: K) => {
      await vi.waitFor(() => expect(dialogs.shown()?.kind).toBe(kind));
      return dialogs.shown() as Extract<ExportDialogShown, { kind: K }>;
    };
    const finished = () =>
      vi.waitFor(() => expect(registry.get(EXPORT_COMMAND_ID)?.enabled).toBe(true));
    return { registry, dialogs, flow, shown, finished };
  }

  it("stops at once for what Site Check must have fixed, and shows Site Check (3.6, X5)", async () => {
    const site = bakery();
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    const con = { ...home, id: "page-con" as never, slug: "con", title: "Con" };
    const { registry, flow, dialogs, finished } = setUp(
      {},
      {
        ...site,
        pages: { ...site.pages, [con.id]: con },
        pageOrder: [...site.pageOrder, con.id],
      },
    );

    registry.run(EXPORT_COMMAND_ID);
    await finished();

    expect(toast.error).toHaveBeenCalledWith("Fix 1 thing in Site Check before exporting");
    expect(flow.showSiteCheck).toHaveBeenCalled();
    expect(dialogs.shown()).toBeNull();
    expect(flow.exportSite).not.toHaveBeenCalled();
  });

  it("asks for the web address, exports with the chosen options, and shows the report", async () => {
    const { registry, flow, shown, finished, dialogs } = setUp();
    expect(registry.get(EXPORT_COMMAND_ID)).toMatchObject({ menu: "file", shortcut: "Mod+E" });

    registry.run(EXPORT_COMMAND_ID);
    expect(registry.get(EXPORT_COMMAND_ID)?.enabled).toBe(false);
    (await shown("web-address")).answer("skip");
    const options = await shown("options");
    expect(options).toMatchObject({ initial: LAST, advanced: false });
    options.answer({ ...LAST, format: "zip", minify: true });
    await finished();

    expect(flow.exportSite).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: { ...LAST, format: "zip", minify: true },
        snapshot: expect.objectContaining({ name: "Bakery" }),
      }),
      expect.any(Function),
    );
    expect(toast.loading).toHaveBeenCalledWith("Exporting…", {
      action: expect.objectContaining({ label: "Cancel" }),
    });
    expect(toast.dismiss).toHaveBeenCalledWith("progress");
    expect(dialogs.shown()).toMatchObject({ kind: "report", report: { name: "my-site" } });
  });

  it("remembers at once not to ask for the web address, even if the export is cancelled", async () => {
    const { registry, flow, shown, finished } = setUp();
    registry.run(EXPORT_COMMAND_ID);

    (await shown("web-address")).answer("skip-always");

    const options = await shown("options");
    expect(flow.saveChoices).toHaveBeenCalledWith({ ...LAST, askWebAddress: false });
    expect(options.initial.askWebAddress).toBe(false);
    options.answer(undefined);
    await finished();
    expect(flow.exportSite).not.toHaveBeenCalled();
  });

  it("exports from the defaults when the site's choices can't be read", async () => {
    const { registry, shown, finished } = setUp({
      choices: () => Promise.reject(new Error("IPC failed")),
    });
    registry.run(EXPORT_COMMAND_ID);

    (await shown("web-address")).answer("skip");
    const options = await shown("options");
    expect(options.initial).toEqual(LAST);
    options.answer(undefined);
    await finished();
  });

  it("writes no developer files in Simple mode, while the site keeps Advanced mode's choice", async () => {
    const remembered = { ...LAST, askWebAddress: false, developerFiles: true };
    const { registry, flow, shown, finished } = setUp({ choices: async () => remembered });
    registry.run(EXPORT_COMMAND_ID);

    (await shown("options")).answer(remembered);
    await finished();

    expect(flow.exportSite).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: remembered,
        output: { minify: false, developerFiles: false },
      }),
      expect.any(Function),
    );
  });

  it("asks nothing when the site has a web address, or was told not to", async () => {
    for (const [site, choices] of [
      [withAddress(bakery()), LAST],
      [bakery(), { ...LAST, askWebAddress: false }],
    ] as const) {
      const { registry, dialogs, finished } = setUp({ choices: async () => choices }, site);
      registry.run(EXPORT_COMMAND_ID);

      await vi.waitFor(() => expect(dialogs.shown()?.kind).toBe("options"));
      const options = dialogs.shown();
      if (options?.kind === "options") options.answer(undefined);
      await finished();
    }
  });

  it("opens Site Settings at the web address, and goes on with the site as saved", async () => {
    let site = bakery();
    const showSettings = vi.fn(async () => {
      site = withAddress(site);
      return true;
    });
    const { registry, flow, shown, finished, dialogs } = setUp({ site: () => site, showSettings });
    registry.run(EXPORT_COMMAND_ID);

    (await shown("web-address")).answer("add");
    (await shown("options")).answer(LAST);
    await finished();

    expect(showSettings).toHaveBeenCalledWith("site", "address");
    expect(flow.exportSite).toHaveBeenCalledOnce();
    // The report is of the site with its new web address.
    expect(dialogs.shown()).toMatchObject({ kind: "report", report: { noWebAddress: false } });
  });

  it("stops when Site Settings is closed without saving, or a dialog is cancelled", async () => {
    const closed = setUp({ showSettings: vi.fn(async () => false) });
    closed.registry.run(EXPORT_COMMAND_ID);
    (await closed.shown("web-address")).answer("add");
    await closed.finished();

    const cancelled = setUp();
    cancelled.registry.run(EXPORT_COMMAND_ID);
    (await cancelled.shown("web-address")).answer("cancel");
    await cancelled.finished();

    expect(closed.flow.exportSite).not.toHaveBeenCalled();
    expect(cancelled.flow.exportSite).not.toHaveBeenCalled();
  });

  it("offers developer files in Advanced mode only (T2)", async () => {
    const { registry, shown } = setUp({
      advanced: () => true,
      choices: async () => ({ ...LAST, askWebAddress: false }),
    });
    registry.run(EXPORT_COMMAND_ID);

    expect((await shown("options")).advanced).toBe(true);
  });

  it("shows how far the export has come, and its Cancel button stops it (3.1)", async () => {
    let tell: (progress: ExportProgress) => void = () => {};
    let finish: (result: ExportResult) => void = () => {};
    const { registry, flow, shown, finished } = setUp({
      choices: async () => ({ ...LAST, askWebAddress: false }),
      exportSite: vi.fn(
        (_request, onProgress) =>
          new Promise<ExportResult>((resolve) => {
            tell = onProgress;
            finish = resolve;
          }),
      ),
    });
    registry.run(EXPORT_COMMAND_ID);
    (await shown("options")).answer(LAST);
    await vi.waitFor(() => expect(flow.exportSite).toHaveBeenCalled());

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

    expect(flow.cancel).toHaveBeenCalledOnce();
    // The toast stays, saying it's stopping, and later progress doesn't bring the button back.
    expect(preventDefault).toHaveBeenCalled();
    expect(toast.loading).toHaveBeenLastCalledWith("Cancelling…", {
      id: "progress",
      description: null,
      action: null,
    });
    tell({ stage: "pages", done: 1, total: 2 });
    expect(toast.loading).toHaveBeenLastCalledWith("Cancelling…", expect.anything());

    finish({ status: "canceled" });
    await finished();
    expect(toast.dismiss).toHaveBeenCalledWith("progress");
  });

  it("says what went wrong in the toast, without its progress line or Cancel button", async () => {
    const { registry, shown, finished } = setUp({
      choices: async () => ({ ...LAST, askWebAddress: false }),
      exportSite: async () => ({ status: "failed", reason: "folder-not-empty" }),
    });
    registry.run(EXPORT_COMMAND_ID);
    (await shown("options")).answer(LAST);
    await finished();

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("That folder already contains other files."),
      { id: "progress", description: null, action: null },
    );
  });

  it("treats a rejected export as a failed build, and logs it by its code (R12)", async () => {
    const failures = vi.fn(async () => null);
    setFailureLog(failures);
    const { registry, shown, finished } = setUp({
      choices: async () => ({ ...LAST, askWebAddress: false }),
      exportSite: () => Promise.reject(new Error("IPC failed")),
    });
    registry.run(EXPORT_COMMAND_ID);
    (await shown("options")).answer(LAST);
    await finished();
    setFailureLog(undefined);

    expect(failures).toHaveBeenCalledExactlyOnceWith("export", "Error");
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Your site could not be built."),
      { id: "progress", description: null, action: null },
    );
  });
});
