import type { SiteSnapshot } from "@webforge/model";
import { DEFAULT_THEME } from "@webforge/model";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExportOutcome } from "../shared/export-worker-protocol.js";
import type { ExportChoices } from "../shared/ipc/site.js";
import {
  type ExportDeps,
  type ExportDialogs,
  type ExportSite,
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

/** The opening of the site the window was loaded for, and the one a hand-off opens. */
const SITE_A = "11111111-1111-4111-8111-111111111111";
/** The operation an export runs as, unless a test names another (A14). */
const OPERATION = "44444444-4444-4444-8444-444444444444";
const SITE_B = "22222222-2222-4222-8222-222222222222";

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
  // The site that is open now, by its opening, and its export choices and Media.
  const opened = { sessionId: SITE_A as string | undefined };
  const choices = { read: vi.fn(async () => zip), write: vi.fn(async (_: ExportChoices) => {}) };
  const readMedia = vi.fn<ExportSite["readMedia"]>(async () => undefined);
  const deps = {
    dialogs,
    runExport: vi.fn<RunExport>(typeof run === "function" ? run : async () => run),
    sendProgress: vi.fn(),
    site: (sessionId: string): ExportSite => {
      const staleReason = () =>
        opened.sessionId === undefined
          ? ("no-site" as const)
          : opened.sessionId === sessionId
            ? undefined
            : ("stale-session" as const);
      return {
        staleReason,
        readMedia,
        exportChoices: async () => (staleReason() === undefined ? choices.read() : folder),
        setExportChoices: async (kept) => {
          if (staleReason() === undefined) await choices.write(kept);
        },
      };
    },
    open: vi.fn(async (): Promise<"opened" | "missing"> => "opened"),
  } satisfies ExportDeps;
  registerExportHandlers(ipc, (url) => url === APP_URL, deps);
  // Each call as the window loaded for opening A sends it.
  const call =
    (channel: string) =>
    (...args: unknown[]) => {
      const handler = handlers.get(channel);
      if (handler === undefined) {
        throw new Error(`No handler for ${channel}`);
      }
      return handler(
        { senderFrame: { url: APP_URL } } as unknown as IpcMainInvokeEvent,
        ...(channel === "site:cancel-export" ? args : [SITE_A, ...args]),
      );
    };
  const exportSite = call("site:export");
  const cancelExport = call("site:cancel-export");
  return {
    ...deps,
    choices,
    readMedia,
    opened,
    /** Exports `request` as operation `operationId` (A14). */
    invoke: (request: unknown, operationId = OPERATION) => exportSite(request, operationId),
    cancel: (operationId = OPERATION) => cancelExport(operationId),
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
    const { invoke, openLast, open, opened } = setUp(toFolder("/sites/my-site"));
    await invoke(request);

    open.mockResolvedValueOnce("missing");
    await expect(openLast()).resolves.toBe("missing");
    // File → Open of another site: it hasn't been exported yet.
    opened.sessionId = SITE_B;
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
      expect(sendProgress).toHaveBeenCalledWith(OPERATION, { stage: "images", done: 0, total: 2 }),
    );
    await expect(cancel()).resolves.toBeNull();

    await expect(result).resolves.toEqual({ status: "canceled" });
    // With nothing under way, a cancel does nothing.
    await expect(cancel()).resolves.toBeNull();
  });

  it("cancels the export a cancel names, and no other (A14)", async () => {
    const signals: AbortSignal[] = [];
    const { invoke, cancel } = setUp(
      toFolder("/sites/my-site"),
      (_snapshot, _target, { signal }) =>
        new Promise((resolve) => {
          signals.push(signal);
          signal.addEventListener("abort", () => resolve({ type: "cancelled" }));
        }),
    );
    const other = "33333333-3333-4333-8333-333333333333";

    const first = invoke(request);
    const second = invoke(request, other);
    await vi.waitFor(() => expect(signals).toHaveLength(2));
    await cancel(other);

    await expect(second).resolves.toEqual({ status: "canceled" });
    expect(signals.map((signal) => signal.aborted)).toEqual([false, true]);
    await cancel();
    await expect(first).resolves.toEqual({ status: "canceled" });
  });

  it("cancels an export whose choices are still being kept, before anything is built (A14)", async () => {
    let keep: () => void = () => undefined;
    const { invoke, cancel, runExport, choices } = setUp(toFolder("/sites/my-site"));
    // The choices wait at the store gate, behind an import or a save.
    choices.write.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          keep = resolve;
        }),
    );

    const result = invoke(request);
    await vi.waitFor(() => expect(choices.write).toHaveBeenCalled());
    await cancel();
    keep();

    await expect(result).resolves.toEqual({ status: "canceled" });
    expect(runExport).not.toHaveBeenCalled();
  });

  it("refuses a second export under an operation id already under way (A14)", async () => {
    let started = 0;
    const { invoke, cancel } = setUp(
      toFolder("/sites/my-site"),
      (_snapshot, _target, { signal }) =>
        new Promise((resolve) => {
          started += 1;
          signal.addEventListener("abort", () => resolve({ type: "cancelled" }));
        }),
    );

    const first = invoke(request);
    await vi.waitFor(() => expect(started).toBe(1));
    await expect(invoke(request)).resolves.toEqual({ status: "canceled" });
    expect(started).toBe(1);
    await cancel();
    await first;
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

  it("refuses an export as stale after a hand-off before the folder is picked, writing nothing to the next site (#663)", async () => {
    const site: { opened?: { sessionId: string | undefined } } = {};
    const { invoke, runExport, choices, openLast, opened } = setUp({
      chooseExportFolder: async () => {
        // The dialog is open while a double-clicked site replaces this one.
        if (site.opened !== undefined) site.opened.sessionId = SITE_B;
        return "/sites/my-site";
      },
      chooseExportZip: async () => undefined,
    });
    site.opened = opened;

    await expect(invoke(request)).resolves.toEqual({ status: "canceled" });
    // Nothing built, the next site's choices left as they were, and no export of it to open.
    expect(runExport).not.toHaveBeenCalled();
    expect(choices.write).not.toHaveBeenCalled();
    await expect(openLast()).resolves.toBe("none");
  });

  it("refuses an export, or its choices, for an opening that has gone before the dialog (#663)", async () => {
    const { invoke, choicesOf, setChoices, choices, opened } = setUp(toFolder("/sites/my-site"));
    opened.sessionId = SITE_B;

    await expect(invoke(request)).resolves.toEqual({ status: "canceled" });
    await expect(choicesOf()).resolves.toEqual(folder);
    await expect(setChoices(zip)).resolves.toBeNull();
    expect(choices.write).not.toHaveBeenCalled();
  });

  it("builds with the Media of the site it is of, and cancels once a hand-off replaces it (#663)", async () => {
    const run = vi.fn<RunExport>(async (_snapshot, _target, { readMedia, signal }) => {
      await readMedia(PHOTO);
      opened.sessionId = SITE_B;
      await readMedia(PHOTO);
      return signal.aborted ? { type: "cancelled" } : exported;
    });
    const { invoke, readMedia, opened, openLast } = setUp(toFolder("/sites/my-site"), run);

    await expect(invoke(request)).resolves.toEqual({ status: "canceled" });
    // Its first image read from its own site; none from the next.
    expect(readMedia).toHaveBeenCalledOnce();
    await expect(openLast()).resolves.toBe("none");
  });

  it("cancels when the hand-off comes between the check and the read, even on the last image (#663)", async () => {
    const run = vi.fn<RunExport>(async (_snapshot, _target, { readMedia: read, signal }) => {
      // The only image, and so the last read: no later one would notice the hand-off.
      expect(await read(PHOTO)).toBeUndefined();
      return signal.aborted ? { type: "cancelled" } : exported;
    });
    const { invoke, readMedia, opened, openLast } = setUp(toFolder("/sites/my-site"), run);
    // The hand-off takes the gate while the read waits for it: the gated read finds no site.
    readMedia.mockImplementationOnce(async () => {
      opened.sessionId = SITE_B;
      return undefined;
    });

    await expect(invoke(request)).resolves.toEqual({ status: "canceled" });
    await expect(openLast()).resolves.toBe("none");
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
