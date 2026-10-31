import type { SiteSnapshot } from "@webforge/model";
import { DEFAULT_THEME } from "@webforge/model";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExportOutcome } from "../shared/export-worker-protocol.js";
import type { ExportChoices } from "../shared/ipc/site.js";
import {
  type ExportDeps,
  type ExportDialogs,
  type RunExport,
  registerExportHandlers,
  toExportResult,
} from "./export-ipc.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";
const snapshot: SiteSnapshot = {
  name: "Bakery",
  language: "en",
  theme: { ...DEFAULT_THEME, preset: "light" },
  layout: { header: [], footer: [] },
  pages: [{ id: "home", path: "index", title: "Home", doc: { root: { props: {} }, content: [] } }],
  media: [],
};
const PHOTO = "a".repeat(64);
const PDF = "d".repeat(64);
const folder: ExportChoices = {
  format: "folder",
  minify: false,
  developerFiles: false,
  askWebAddress: true,
};
const zip: ExportChoices = { ...folder, format: "zip", minify: true, developerFiles: true };
const request = {
  snapshot,
  media: [
    {
      id: "hero",
      name: "hero",
      mimeType: "image/jpeg",
      hash: PHOTO,
      alt: "Our shop",
      crop: { x: 0, y: 0, width: 1, height: 0.5 },
    },
    { id: "gone", name: "gone", mimeType: "image/png", hash: "b".repeat(64), alt: "" },
  ],
  choices: folder,
  output: { minify: false, developerFiles: false },
} as const;
const exported: ExportOutcome = {
  type: "exported",
  pages: 1,
  files: 5,
  bytes: 1234,
  warnings: [{ code: "broken-link", page: "index", detail: "contact" }],
  warningCount: 3,
  durationMs: 900,
};

const toFolder = (path: string | undefined): ExportDialogs => ({
  chooseExportFolder: async () => path,
  chooseExportZip: async () => undefined,
});

function setUp(dialogs: ExportDialogs, run: RunExport | ExportOutcome = exported) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    },
  } as unknown as Pick<IpcMain, "handle">;
  const deps = {
    dialogs,
    runExport: vi.fn<RunExport>(typeof run === "function" ? run : async () => run),
    sendProgress: vi.fn(),
    choices: { read: vi.fn(async () => zip), write: vi.fn(async () => undefined) },
    open: vi.fn(async (): Promise<"opened" | "missing"> => "opened"),
    currentSite: vi.fn((): string | undefined => "/sites/Bakery.wforge"),
  } satisfies ExportDeps;
  registerExportHandlers(ipc, (url) => url === APP_URL, deps);
  const call =
    (channel: string) =>
    (...args: unknown[]) => {
      const handler = handlers.get(channel);
      if (handler === undefined) {
        throw new Error(`No handler for ${channel}`);
      }
      return handler({ senderFrame: { url: APP_URL } } as unknown as IpcMainInvokeEvent, ...args);
    };
  return {
    ...deps,
    invoke: call("site:export"),
    cancel: call("site:cancel-export"),
    choicesOf: call("site:export-choices"),
    setChoices: call("site:set-export-choices"),
    openLast: call("site:open-export"),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerExportHandlers", () => {
  it("exports to the folder the person chose, returning its name and what the report needs", async () => {
    const { invoke, runExport, choices } = setUp(toFolder("/sites/my-site"));

    await expect(invoke({ ...request, media: [] })).resolves.toEqual({
      status: "exported",
      format: "folder",
      name: "my-site",
      pages: 1,
      files: 5,
      bytes: 1234,
      warnings: [{ code: "broken-link", page: "index", detail: "contact" }],
      warningCount: 3,
    });
    expect(runExport).toHaveBeenCalledWith(
      { ...snapshot, documents: [] },
      {
        destination: "/sites/my-site",
        format: "folder",
        output: { minify: false, developerFiles: false },
      },
      expect.anything(),
    );
    // The site remembers them for its next export.
    expect(choices.write).toHaveBeenCalledWith(folder);
  });

  it("saves a ZIP where the person chose, offering one named after the site (3.3)", async () => {
    const chooseExportZip = vi.fn(async () => "/sites/bakery.zip");
    const { invoke, runExport } = setUp({
      chooseExportFolder: async () => undefined,
      chooseExportZip,
    });

    await expect(
      invoke({ ...request, choices: zip, output: { minify: true, developerFiles: true } }),
    ).resolves.toMatchObject({
      status: "exported",
      format: "zip",
      name: "bakery.zip",
    });
    expect(chooseExportZip).toHaveBeenCalledWith("Bakery");
    expect(runExport).toHaveBeenCalledWith(
      expect.anything(),
      {
        destination: "/sites/bakery.zip",
        format: "zip",
        output: { minify: true, developerFiles: true },
      },
      expect.anything(),
    );
  });

  it("still exports when the site can't remember the choices", async () => {
    const { invoke, choices } = setUp(toFolder("/sites/my-site"));
    choices.write.mockRejectedValueOnce(new Error("read-only"));

    await expect(invoke(request)).resolves.toMatchObject({ status: "exported" });
  });

  it("answers the open site's last choices, and remembers new ones at once (3.3)", async () => {
    const { choicesOf, setChoices, choices } = setUp(toFolder(undefined));

    await expect(choicesOf()).resolves.toEqual(zip);
    await expect(setChoices({ ...folder, askWebAddress: false })).resolves.toBeNull();
    expect(choices.write).toHaveBeenCalledWith({ ...folder, askWebAddress: false });
  });

  it("writes what the export applies, and remembers the choices as they are (3.3)", async () => {
    const { invoke, runExport, choices } = setUp(toFolder("/sites/my-site"));
    // Simple mode: developer files not written, Advanced mode's choice kept.
    const kept = { ...folder, developerFiles: true };

    await invoke({ ...request, choices: kept, output: { minify: false, developerFiles: false } });

    expect(runExport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ output: { minify: false, developerFiles: false } }),
      expect.anything(),
    );
    expect(choices.write).toHaveBeenCalledWith(kept);
  });

  it("opens only the open site's export, and says when it's gone (3.3)", async () => {
    const { invoke, openLast, open, currentSite } = setUp(toFolder("/sites/my-site"));
    await invoke(request);

    open.mockResolvedValueOnce("missing");
    await expect(openLast()).resolves.toBe("missing");
    // File → Open of another site: it hasn't been exported yet.
    currentSite.mockReturnValue("/sites/Salon.wforge");
    await expect(openLast()).resolves.toBe("none");
    expect(open).toHaveBeenCalledOnce();
  });

  it("opens the last export from disk, and nothing before there is one (3.3)", async () => {
    let outcome: ExportOutcome = exported;
    const { invoke, openLast, open } = setUp(toFolder("/sites/my-site"), async () => outcome);
    await expect(openLast()).resolves.toBe("none");

    await invoke(request);
    // A failed export after it leaves it the last one.
    outcome = { type: "failed", code: "write-failed", detail: "write-failed" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    await invoke(request);

    await expect(openLast()).resolves.toBe("opened");
    expect(open).toHaveBeenCalledWith({
      destination: "/sites/my-site",
      format: "folder",
      output: { minify: false, developerFiles: false },
    });
  });

  it("passes the export's progress on to the window, and cancels it when asked (3.1)", async () => {
    const { invoke, cancel, sendProgress } = setUp(
      toFolder("/sites/my-site"),
      (_snapshot, _target, { signal, onProgress }) =>
        new Promise((resolve) => {
          onProgress({ stage: "images", done: 0, total: 2 });
          signal.addEventListener("abort", () => resolve({ type: "cancelled" }));
        }),
    );

    const result = invoke(request);
    await vi.waitFor(() =>
      expect(sendProgress).toHaveBeenCalledWith({ stage: "images", done: 0, total: 2 }),
    );
    await expect(cancel()).resolves.toBeNull();

    await expect(result).resolves.toEqual({ status: "canceled" });
    // With nothing under way, a cancel does nothing.
    await expect(cancel()).resolves.toBeNull();
  });

  it("names images and documents by hash: their bytes are read only as the worker asks (R15)", async () => {
    const { invoke, runExport } = setUp(toFolder("/sites/my-site"));
    const document = {
      id: "prices",
      name: "prices",
      mimeType: "application/pdf",
      hash: PDF,
    } as const;

    await invoke({ ...request, documents: [document] });

    // No bytes in this process: the build leaves out a file the site doesn't store, with a warning.
    expect(runExport).toHaveBeenCalledWith(
      { ...snapshot, media: request.media, documents: [document] },
      expect.anything(),
      expect.anything(),
    );
  });

  it("does nothing when the person cancels the dialog, and remembers nothing", async () => {
    const { invoke, runExport, choices } = setUp(toFolder(undefined));

    await expect(invoke(request)).resolves.toEqual({ status: "canceled" });
    expect(runExport).not.toHaveBeenCalled();
    expect(choices.write).not.toHaveBeenCalled();
  });

  it("rejects a snapshot that is not a valid site, or unknown choices, before asking for a folder", async () => {
    const chooseExportFolder = vi.fn(async () => "/sites/my-site");
    const { invoke } = setUp({ chooseExportFolder, chooseExportZip: async () => undefined });

    await expect(invoke({ ...request, snapshot: { ...snapshot, pages: [] } })).rejects.toThrow();
    await expect(
      invoke({ ...request, media: [{ ...request.media[0], hash: "../secret" }] }),
    ).rejects.toThrow();
    await expect(invoke({ ...request, choices: { ...folder, format: "tar" } })).rejects.toThrow();
    expect(chooseExportFolder).not.toHaveBeenCalled();
  });
});

describe("toExportResult", () => {
  const target = { destination: "/sites/my-site", format: "folder" } as const;

  it("passes on the page to rename, but logs only the codes (R16)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = toExportResult(
      { type: "failed", code: "reserved-name", detail: "reserved-name", page: "Contact us" },
      target,
    );

    expect(result).toEqual({ status: "failed", reason: "reserved-name", page: "Contact us" });
    expect(error).toHaveBeenCalledWith(
      "Webforge could not export a site (code=reserved-name, detail=reserved-name)",
    );
  });

  it("passes on the image to replace, but logs only the codes (S12)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = toExportResult(
      { type: "failed", code: "unreadable-image", detail: "unreadable-image", image: "huge-photo" },
      target,
    );

    expect(result).toEqual({ status: "failed", reason: "unreadable-image", image: "huge-photo" });
    expect(error).toHaveBeenCalledWith(
      "Webforge could not export a site (code=unreadable-image, detail=unreadable-image)",
    );
  });

  it("reports a cancelled export as the dialog's cancel: nothing changed on disk (R15)", () => {
    expect(toExportResult({ type: "cancelled" }, target)).toEqual({ status: "canceled" });
  });

  it("passes on the failure reason and logs only codes", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = toExportResult(
      { type: "failed", code: "folder-not-empty", detail: "folder-not-empty" },
      { destination: "/Users/sam/Documents", format: "folder" },
    );

    expect(result).toEqual({ status: "failed", reason: "folder-not-empty" });
    expect(error).toHaveBeenCalledWith(
      "Webforge could not export a site (code=folder-not-empty, detail=folder-not-empty)",
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("Users");
  });
});
