import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { type CrashSources, installCrashHandlers, noticeAfterCrash } from "./crash-handlers.js";
import type { CrashContext, CrashReport } from "./crash-reports.js";

const context: CrashContext = {
  appVersion: "1.2.0",
  versions: { electron: "44.0.0", chrome: "142.0.0", node: "24.22.0" },
  os: { platform: "linux", arch: "x64", release: "6.1" },
  appPath: "/opt/webforge/resources/app.asar",
  privatePaths: ["/home/rosa"],
  memory: () => ({ rss: 1, heapUsed: 1 }),
};

type Listener = (...args: unknown[]) => void;

function setUp() {
  const listeners = new Map<string, Listener>();
  const on = (event: string, listener: Listener) => listeners.set(event, listener);
  const crashReporter = { start: vi.fn() };
  const sources = {
    process: { on },
    app: { on },
    crashReporter,
  } as unknown as CrashSources;
  const written: CrashReport[] = [];
  const write = vi.fn((report: CrashReport) => {
    written.push(report);
    return "/reports/crash.json";
  });
  const onFatal = vi.fn();
  installCrashHandlers(sources, { write }, context, onFatal);
  const emit = (event: string, ...args: unknown[]) => listeners.get(event)?.(...args);
  return { crashReporter, written, write, onFatal, emit };
}

describe("installCrashHandlers", () => {
  it("keeps native crash dumps on this computer: crashReporter never uploads", () => {
    const { crashReporter } = setUp();

    expect(crashReporter.start).toHaveBeenCalledWith({ uploadToServer: false, compress: true });
  });

  it("reports an uncaught exception in main, then ends the app", () => {
    const { emit, written, onFatal } = setUp();

    emit("uncaughtException", new RangeError("boom"));

    expect(written).toMatchObject([
      { process: "main", kind: "uncaught-exception", error: { name: "RangeError" } },
    ]);
    expect(onFatal).toHaveBeenCalledTimes(1);
  });

  it("reports an unhandled rejection and keeps running", () => {
    const { emit, written, onFatal } = setUp();

    emit("unhandledRejection", new Error("later"));

    expect(written).toMatchObject([{ process: "main", kind: "unhandled-rejection" }]);
    expect(onFatal).not.toHaveBeenCalled();
  });

  it("reports renderer, GPU and utility processes that went away, not clean exits", () => {
    const { emit, written } = setUp();

    emit("render-process-gone", {}, {}, { reason: "crashed", exitCode: 3 });
    emit("render-process-gone", {}, {}, { reason: "clean-exit", exitCode: 0 });
    emit("child-process-gone", {}, { type: "GPU", reason: "oom", exitCode: 9 });
    emit("child-process-gone", {}, { type: "Utility", reason: "crashed", exitCode: 1 });
    emit("child-process-gone", {}, { type: "Zygote", reason: "crashed", exitCode: 1 });
    emit("child-process-gone", {}, { type: "Utility", reason: "clean-exit", exitCode: 0 });
    // Webforge ends its export worker itself after each export.
    emit("child-process-gone", {}, { type: "Utility", reason: "killed", exitCode: 1 });

    expect(written.map((report) => [report.process, report.kind, report.exitCode])).toEqual([
      ["renderer", "crashed", 3],
      ["gpu", "oom", 9],
      ["utility", "crashed", 1],
      ["other", "crashed", 1],
    ]);
  });

  it("never fails itself when a report can't be written", () => {
    const { emit, write, onFatal } = setUp();
    write.mockImplementation(() => {
      throw new Error("ENOSPC");
    });

    expect(() => emit("uncaughtException", new Error("x"))).not.toThrow();
    expect(onFatal).toHaveBeenCalled();
  });

  it("uses no network code anywhere in crash reporting", () => {
    for (const file of ["crash-reports.ts", "crash-handlers.ts", "crash-wiring.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source, file).not.toMatch(/node:(?:http|https|net|tls|dgram)|\bfetch\(|net\.request/);
    }
  });
});

describe("noticeAfterCrash", () => {
  it("tells the user once after a crash and opens the folder if they ask", async () => {
    const reports = { hasUnseen: vi.fn(() => true), markSeen: vi.fn() };
    const openFolder = vi.fn(async () => undefined);

    await noticeAfterCrash(reports, async () => true, openFolder);

    expect(reports.markSeen).toHaveBeenCalled();
    expect(openFolder).toHaveBeenCalled();
  });

  it("says nothing without new reports, and opens nothing when dismissed", async () => {
    const ask = vi.fn(async () => false);
    const openFolder = vi.fn(async () => undefined);

    await noticeAfterCrash({ hasUnseen: () => false, markSeen: vi.fn() }, ask, openFolder);
    expect(ask).not.toHaveBeenCalled();

    await noticeAfterCrash({ hasUnseen: () => true, markSeen: vi.fn() }, ask, openFolder);
    expect(ask).toHaveBeenCalled();
    expect(openFolder).not.toHaveBeenCalled();
  });
});
