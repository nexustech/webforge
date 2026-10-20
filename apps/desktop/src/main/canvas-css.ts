import type { IpcMain } from "electron";
import {
  type CompileCssOutcome,
  compileCssOutcomeSchema,
} from "../shared/export-worker-protocol.js";
import type { CanvasCssRequest, CanvasCssResult } from "../shared/ipc/canvas.js";
import { registerIpcHandler } from "./ipc.js";

/** The parts of an Electron `UtilityProcess` the compiler uses; injectable for tests. */
export type CssWorkerProcess = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (message: unknown) => void): unknown;
  on(event: "exit", listener: (code: number) => void): unknown;
  kill(): boolean;
};

/** Compiles canvas CSS; see {@link createCanvasCssCompiler}. */
export type CanvasCssCompiler = (request: CanvasCssRequest) => Promise<CanvasCssResult>;

/** How long one compile may take before it counts as failed (a cold start loads the pipeline). */
const COMPILE_TIMEOUT_MS = 60_000;

/**
 * Compiles the canvas's site CSS in one long-lived utility process, started on first use and again
 * after it exits, so a recompile costs no process start. Answers are matched to requests by id and
 * validated; anything unexpected, a timeout or an exit fails the request instead of trusting it.
 */
export function createCanvasCssCompiler(
  startWorker: () => CssWorkerProcess,
  timeoutMs = COMPILE_TIMEOUT_MS,
): CanvasCssCompiler {
  let worker: CssWorkerProcess | null = null;
  let nextId = 0;
  const pending = new Map<number, (outcome: CompileCssOutcome | null) => void>();

  const running = (): CssWorkerProcess => {
    if (worker !== null) {
      return worker;
    }
    const started = startWorker();
    started.on("message", (message) => {
      const outcome = compileCssOutcomeSchema.safeParse(message);
      if (outcome.success) {
        pending.get(outcome.data.id)?.(outcome.data);
      }
    });
    started.on("exit", () => {
      if (worker === started) {
        worker = null;
      }
      for (const finish of [...pending.values()]) finish(null);
    });
    worker = started;
    return started;
  };

  return (request) =>
    new Promise((resolve) => {
      const id = nextId++;
      const finish = (outcome: CompileCssOutcome | null) => {
        clearTimeout(timer);
        pending.delete(id);
        resolve(
          outcome?.type === "css"
            ? { status: "compiled", css: outcome.css, bodyClass: outcome.bodyClass }
            : { status: "failed" },
        );
      };
      const timer = setTimeout(() => {
        finish(null);
        // A stuck worker is replaced on the next request.
        worker?.kill();
        worker = null;
      }, timeoutMs);
      pending.set(id, finish);
      running().postMessage({ type: "compile-css", id, ...request });
    });
}

/** Registers the canvas IPC calls. */
export function registerCanvasHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  compile: CanvasCssCompiler,
): void {
  registerIpcHandler(ipc, "compileCanvasCss", isTrustedSender, compile);
}
