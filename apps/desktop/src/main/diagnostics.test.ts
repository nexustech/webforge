import type { IpcMainInvokeEvent } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { DIAGNOSTIC_COUNTS, DIAGNOSTIC_TIMINGS, diagnosticsSchema } from "../shared/diagnostics.js";
import { flattenSummary } from "./diagnostics.js";
import { registerDiagnosticsHandlers } from "./diagnostics-ipc.js";
import {
  loadUsageLists,
  type UsageSummary,
  type UsageSummaryData,
  usageSummarySchema,
} from "./usage-summary.js";

const INSTALL = "5d0c1f6e-6a2b-4c3d-8e9f-0a1b2c3d4e5f";
const NEW_INSTALL = "9b8a7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

/** A summary with something counted in each kind of count. */
function summary(installId = INSTALL): UsageSummaryData {
  return {
    version: 1,
    installId,
    since: 1_700_000_000_000,
    saved: 1_700_000_100_000,
    computer: {
      version: [0, 3, 0],
      channel: "beta",
      platform: "win32",
      arch: "x64",
      osVersion: [10, 0, 26300],
      memoryGb: 16,
      scale: 1.5,
      language: "en",
    },
    sites: {
      started: { template: 3, brief: 1 },
      templates: { cafe: 2 },
      firstEdits: 4,
      siteChecks: 2,
      previews: 5,
      phonePreviews: 0,
      exports: 1,
      published: {},
    },
    quickStart: { created: { details: 2 }, cancelled: {} },
    tour: { taken: 1, declined: 0, finished: 0, closedAt: [0, 1] },
    used: { commands: {}, added: { Hero: 2 } },
    failures: { export: {}, publish: {}, save: {}, files: {}, previews: 0, crashReports: 1 },
    siteCheck: { must: {}, should: {}, tip: {} },
    aiApps: { apps: {}, tools: {}, outcomes: {} },
    assistant: { messages: {}, tools: {}, toolStates: {} },
    timings: {
      startup: [
        { at: 1, ms: 900 },
        { at: 2, ms: 1100 },
        { at: 3, ms: 2000 },
      ],
      openSite: [],
      export: [],
      preview: [],
    },
  };
}

/** The leaves of `schema`'s object shape, as `section.field`, but those that aren't counts. */
function countFields(schema: z.ZodType): string[] {
  const shape = (
    schema as unknown as { shape: Record<string, { shape?: Record<string, unknown> }> }
  ).shape;
  const notCounts = new Set(["version", "installId", "since", "saved", "computer", "timings"]);
  return Object.entries(shape).flatMap(([section, value]) =>
    notCounts.has(section)
      ? []
      : Object.keys(value.shape ?? {}).map((field) => `${section}.${field}`),
  );
}

describe("Help › Diagnostics… in main (5.41, BD-2)", () => {
  it("knows every count the summary holds: one added without its wording fails here", async () => {
    const schema = usageSummarySchema(await loadUsageLists());
    expect(countFields(schema).sort()).toEqual([...DIAGNOSTIC_COUNTS].sort());
    const timings = (schema.shape.timings as unknown as { shape: Record<string, unknown> }).shape;
    expect(Object.keys(timings).sort()).toEqual([...DIAGNOSTIC_TIMINGS].sort());
  });

  it("flattens the summary into counts by field and name, the computer and the timings", () => {
    const shown = flattenSummary(summary());
    expect(diagnosticsSchema.parse(shown)).toEqual(shown);
    expect(shown.computer).toMatchObject({ version: "0.3.0", osVersion: "10.0.26300" });
    expect(shown.counts).toContainEqual({ field: "sites.started", name: "template", count: 3 });
    expect(shown.counts).toContainEqual({ field: "sites.firstEdits", count: 4 });
    // A count of its own is listed even at 0; one by name only when it's counted.
    expect(shown.counts).toContainEqual({ field: "sites.phonePreviews", count: 0 });
    expect(shown.counts.some(({ field }) => field === "sites.published")).toBe(false);
    // The tour's closes by the step's number, from 1.
    expect(shown.counts).toContainEqual({ field: "tour.closedAt", name: "2", count: 1 });
    expect(shown.timings).toContainEqual({ field: "startup", samples: 3, medianMs: 1100 });
    expect(shown.timings).toContainEqual({ field: "export", samples: 0, medianMs: 0 });
  });

  it("saves one file, the summary and the newest crash reports, and clears with a new number", async () => {
    let held = summary();
    const usage: UsageSummary = {
      start: async () => undefined,
      record: () => undefined,
      read: async () => held,
      clear: async () => {
        held = summary(NEW_INSTALL);
      },
      idle: async () => undefined,
    };
    const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
    const writeFile = vi.fn(async () => undefined);
    const crashReports = vi.fn(() => [
      { name: "crash-20261121-120000-main.json", report: { a: 1 } },
    ]);
    const openPath = vi.fn(async () => "");
    registerDiagnosticsHandlers(
      { handle: (channel, handler) => handlers.set(channel, handler) },
      () => true,
      {
        summary: async () => usage,
        crashReports,
        folder: "C:/Users/rosa/AppData/Roaming/Webforge",
        openPath,
        chooseFile: async () => "C:/Users/rosa/Desktop/diagnostics.json",
        writeFile,
      },
    );
    const invoke = (channel: string) =>
      handlers.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent);

    expect(await invoke("app:save-diagnostics")).toBe("saved");
    expect(crashReports).toHaveBeenCalledWith(5);
    const [path, text] = writeFile.mock.calls[0] as unknown as [string, string];
    expect(path).toBe("C:/Users/rosa/Desktop/diagnostics.json");
    const saved = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(saved)).toEqual(["summary", "crashReports"]);
    expect(saved.summary).toEqual(summary());
    // Nothing of where it was kept: no path.
    expect(text).not.toContain("AppData");

    expect(await invoke("app:open-diagnostics-folder")).toBe(true);
    expect(openPath).toHaveBeenCalledWith("C:/Users/rosa/AppData/Roaming/Webforge");

    const cleared = (await invoke("app:clear-diagnostics")) as { installId: string };
    expect(cleared.installId).toBe(NEW_INSTALL);
  });

  it("answers nothing while the summary hasn't loaded, and saves nothing", async () => {
    const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
    const writeFile = vi.fn(async () => undefined);
    registerDiagnosticsHandlers(
      { handle: (channel, handler) => handlers.set(channel, handler) },
      () => true,
      {
        summary: async () => undefined,
        crashReports: () => [],
        folder: "x",
        openPath: async () => "",
        chooseFile: async () => "y",
        writeFile,
      },
    );
    const invoke = (channel: string) =>
      handlers.get(channel)?.({ senderFrame: { url: "app" } } as IpcMainInvokeEvent);
    expect(await invoke("app:get-diagnostics")).toBeNull();
    expect(await invoke("app:save-diagnostics")).toBe("failed");
    expect(writeFile).not.toHaveBeenCalled();
  });
});
