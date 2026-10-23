import { DEFAULT_THEME } from "@webforge/model";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CssWorkerProcess, createCanvasStyles, registerCanvasHandlers } from "./canvas-css.js";

type Listener = (value: unknown) => void;

/** A worker the test answers for; it records the jobs it was sent. */
function fakeWorker() {
  const listeners = { message: [] as Listener[], exit: [] as Listener[] };
  const jobs: { id: number; candidates: string[] }[] = [];
  const worker: CssWorkerProcess = {
    postMessage: (job) => jobs.push(job as { id: number; candidates: string[] }),
    on: ((event: "message" | "exit", listener: Listener) =>
      listeners[event].push(listener)) as CssWorkerProcess["on"],
    kill: vi.fn(() => true),
  };
  return {
    worker,
    jobs,
    answer: (message: unknown) => {
      for (const listener of listeners.message) listener(message);
    },
    exit: () => {
      for (const listener of listeners.exit) listener(1);
    },
  };
}

const request = (candidates: string[]) => ({
  theme: { ...DEFAULT_THEME, preset: "light" },
  candidates,
});

describe("createCanvasStyles' compileCss", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps one worker and matches each answer to its request", async () => {
    const fake = fakeWorker();
    const start = vi.fn(() => fake.worker);
    const compile = createCanvasStyles(start).compileCss;

    const first = compile(request(["btn"]));
    const second = compile(request(["card"]));
    const [a, b] = fake.jobs;
    fake.answer({ type: "css", id: b?.id, css: ".card{}", bodyClass: "x" });
    fake.answer({ type: "css", id: a?.id, css: ".btn{}", bodyClass: "x" });

    expect(start).toHaveBeenCalledOnce();
    expect(fake.jobs.map((job) => job.candidates)).toEqual([["btn"], ["card"]]);
    expect(await first).toEqual({ status: "compiled", css: ".btn{}", bodyClass: "x" });
    expect(await second).toEqual({ status: "compiled", css: ".card{}", bodyClass: "x" });
  });

  it("fails a request the worker couldn't compile", async () => {
    const fake = fakeWorker();
    const compile = createCanvasStyles(() => fake.worker).compileCss;

    const result = compile(request([]));
    fake.answer({ type: "css-failed", id: fake.jobs[0]?.id });

    expect(await result).toEqual({ status: "failed" });
  });

  it("ignores unexpected messages and fails the request when it times out", async () => {
    const fake = fakeWorker();
    const compile = createCanvasStyles(() => fake.worker, 1_000).compileCss;

    const result = compile(request([]));
    fake.answer({ type: "css", id: "not a number", css: 1 });
    vi.advanceTimersByTime(1_000);

    expect(await result).toEqual({ status: "failed" });
    expect(fake.worker.kill).toHaveBeenCalled();
  });

  it("fails what was pending when the worker exits, then starts a new one", async () => {
    const workers = [fakeWorker(), fakeWorker()];
    const start = vi.fn(
      () => (workers[start.mock.calls.length - 1] ?? workers[1])?.worker as CssWorkerProcess,
    );
    const compile = createCanvasStyles(start).compileCss;

    const lost = compile(request([]));
    workers[0]?.exit();
    const next = compile(request(["btn"]));
    workers[1]?.answer({ type: "css", id: workers[1].jobs[0]?.id, css: ".btn{}", bodyClass: "" });

    expect(await lost).toEqual({ status: "failed" });
    expect(await next).toMatchObject({ status: "compiled" });
    expect(start).toHaveBeenCalledTimes(2);
  });
});

describe("createCanvasStyles' compileCss after a timeout", () => {
  it("doesn't let the stopped worker's exit fail the new worker's requests", async () => {
    vi.useFakeTimers();
    const old = fakeWorker();
    const fresh = fakeWorker();
    const start = vi.fn().mockReturnValueOnce(old.worker).mockReturnValueOnce(fresh.worker);
    const compile = createCanvasStyles(start, 1_000).compileCss;

    const stuck = compile(request([]));
    vi.advanceTimersByTime(1_000);
    const next = compile(request(["btn"]));
    old.exit();
    // A late answer from the stopped worker doesn't count either.
    old.answer({ type: "css", id: fresh.jobs[0]?.id, css: ".old{}", bodyClass: "" });
    fresh.answer({ type: "css", id: fresh.jobs[0]?.id, css: ".btn{}", bodyClass: "" });

    expect(await stuck).toEqual({ status: "failed" });
    expect(await next).toEqual({ status: "compiled", css: ".btn{}", bodyClass: "" });
    expect(old.worker.kill).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("createCanvasStyles' class catalogue (#276)", () => {
  it("asks the same worker for the catalogue and for classes' CSS", async () => {
    const fake = fakeWorker();
    const start = vi.fn(() => fake.worker);
    const styles = createCanvasStyles(start);

    const catalogue = styles.classCatalogue(DEFAULT_THEME);
    const css = styles.classCss(DEFAULT_THEME, ["p-4", "pading-4"]);
    const [a, b] = fake.jobs;
    fake.answer({ type: "class-catalogue", id: a?.id, classes: ["p-4"], variants: ["md"] });
    fake.answer({ type: "class-css", id: b?.id, css: [".p-4 {}", null] });

    expect(start).toHaveBeenCalledOnce();
    expect(fake.jobs.map((job) => (job as unknown as { type: string }).type)).toEqual([
      "class-catalogue",
      "class-css",
    ]);
    expect(await catalogue).toEqual({ status: "loaded", classes: ["p-4"], variants: ["md"] });
    expect(await css).toEqual({ status: "css", css: [".p-4 {}", null] });
  });

  it("fails a failed job, and an answer for a different number of classes", async () => {
    const fake = fakeWorker();
    const styles = createCanvasStyles(() => fake.worker);

    const catalogue = styles.classCatalogue(DEFAULT_THEME);
    const css = styles.classCss(DEFAULT_THEME, ["p-4", "m-2"]);
    const [a, b] = fake.jobs;
    fake.answer({ type: "classes-failed", id: a?.id });
    fake.answer({ type: "class-css", id: b?.id, css: [".p-4 {}"] });

    expect(await catalogue).toEqual({ status: "failed" });
    expect(await css).toEqual({ status: "failed" });
  });
});

describe("registerCanvasHandlers", () => {
  it("compiles for the app's own page only", async () => {
    type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;
    const handlers = new Map<string, Handler>();
    const ipc = {
      handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
    } as unknown as Pick<IpcMain, "handle">;
    const compile = vi.fn(async () => ({ status: "failed" }) as const);
    registerCanvasHandlers(ipc, (url) => url === "file:///app", {
      compileCss: compile,
      classCatalogue: vi.fn(),
      classCss: vi.fn(),
    });
    const handler = handlers.get("canvas:compile-css");
    const from = (url: string) => ({ senderFrame: { url } }) as unknown as IpcMainInvokeEvent;

    await expect(handler?.(from("file:///app"), request(["btn"]))).resolves.toEqual({
      status: "failed",
    });
    await expect(handler?.(from("https://evil.example"), request([]))).rejects.toThrow(
      "ipc-failed",
    );
    await expect(
      handler?.(from("file:///app"), { theme: { name: "Bad Theme" } }),
    ).rejects.toThrow();
    expect(compile).toHaveBeenCalledOnce();
  });
});
