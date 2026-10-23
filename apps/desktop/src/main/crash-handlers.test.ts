import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { installWorkerCrashHandlers } from "../worker/crash-handlers.js";
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
  let clock = new Date("2026-10-23T12:00:00.000Z");
  const handlers = installCrashHandlers(
    sources,
    { write },
    { ...context, now: () => clock },
    onFatal,
  );
  const emit = (event: string, ...args: unknown[]) => listeners.get(event)?.(...args);
  const later = (ms: number) => {
    clock = new Date(clock.getTime() + ms);
  };
  return { crashReporter, written, write, onFatal, emit, handlers, later };
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
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { emit, write, onFatal } = setUp();
    write.mockImplementation(() => {
      throw new Error("ENOSPC");
    });

    expect(() => emit("uncaughtException", new Error("x"))).not.toThrow();
    expect(onFatal).toHaveBeenCalled();
  });

  it("reports a renderer's error as one the editor survived, at most 5 a minute (R3)", () => {
    const { handlers, written, later } = setUp();
    const error = { name: "TypeError", frames: ["at Panel (app:///index.js:1:2)"] };

    for (let n = 0; n < 7; n += 1) {
      handlers.report({ process: "renderer", kind: "render-error", error, fatal: false });
    }
    expect(written).toHaveLength(5);
    expect(written[0]).toMatchObject({
      process: "renderer",
      kind: "render-error",
      fatal: false,
      error: { name: "TypeError", stack: ["at Panel (app:///index.js:1:2)"] },
    });

    later(60_000);
    handlers.report({ process: "renderer", kind: "uncaught-error", error, fatal: false });
    expect(written).toHaveLength(6);
  });

  it("reports a worker that crashed on a job, with its frames and no message (R3)", () => {
    const { handlers, written } = setUp();
    // A worker as Electron gives it, and the crash handlers the worker installs in itself.
    const toMain = new Set<(message: unknown) => void>();
    const worker = handlers.watchWorker({
      on: (_event: "message", listener: (message: unknown) => void) => toMain.add(listener),
    });
    const workerEvents = new Map<string, (error: unknown) => void>();
    const exit = vi.fn();
    installWorkerCrashHandlers(
      { on: (event, listener) => workerEvents.set(event, listener) },
      (crash) => {
        for (const listener of toMain) listener(crash);
      },
      exit,
      (run) => run(),
    );
    const job = () => {
      throw new RangeError("Rosa's Bakery: 12 images");
    };
    try {
      job();
    } catch (error) {
      workerEvents.get("uncaughtException")?.(error);
    }

    expect(worker).toBeDefined();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      process: "utility",
      kind: "uncaught-exception",
      fatal: false,
      error: { name: "RangeError" },
    });
    expect(written[0]?.error?.stack[0]).toMatch(/^at job \(/);
    expect(JSON.stringify(written)).not.toMatch(/Rosa|Bakery|images/);
  });

  it("ignores a worker's other messages", () => {
    const { handlers, written } = setUp();
    let send: (message: unknown) => void = () => undefined;
    handlers.watchWorker({
      on: (_event: "message", listener: (message: unknown) => void) => {
        send = listener;
      },
    });

    send({ type: "compiled", id: 1, css: "" });
    send({
      type: "crashed",
      kind: "uncaught-exception",
      error: { name: "Error", frames: [] },
      x: 1,
    });

    expect(written).toEqual([]);
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
