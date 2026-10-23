import type { ThemeTokens } from "@webforge/model";
import type { CatalogueFont } from "@webforge/themes";
import type { IpcMain } from "electron";
import { compileCssOutcomeSchema } from "../shared/export-worker-protocol.js";
import type { CanvasCssRequest, CanvasCssResult } from "../shared/ipc/canvas.js";
import { registerIpcHandler } from "./ipc.js";
import { createWorkerRequests, type WorkerProcess } from "./worker-requests.js";

/** The parts of an Electron `UtilityProcess` the compiler uses; injectable for tests. */
export type CssWorkerProcess = WorkerProcess;

/** Compiles canvas CSS; see {@link createCanvasCssCompiler}. */
export type CanvasCssCompiler = (request: CanvasCssRequest) => Promise<CanvasCssResult>;

/** How long one compile may take before it counts as failed (a cold start loads the pipeline). */
const COMPILE_TIMEOUT_MS = 60_000;

/**
 * Compiles the canvas's site CSS in one long-lived utility process (see
 * {@link createWorkerRequests}), so a recompile costs no process start. `families` gives the
 * downloaded fonts a theme uses (2.2), which the renderer never names itself. Anything unexpected,
 * a timeout or an exit fails the request instead of trusting it.
 */
export function createCanvasCssCompiler(
  startWorker: () => CssWorkerProcess,
  timeoutMs = COMPILE_TIMEOUT_MS,
  families?: (theme: ThemeTokens) => Promise<CatalogueFont[]>,
): CanvasCssCompiler {
  const request = createWorkerRequests(startWorker, compileCssOutcomeSchema, timeoutMs);
  return async (css) => {
    const outcome = await request({
      type: "compile-css",
      ...css,
      families: families === undefined ? [] : await families(css.theme),
    });
    return outcome?.type === "css"
      ? { status: "compiled", css: outcome.css, bodyClass: outcome.bodyClass }
      : { status: "failed" };
  };
}

/** Registers the canvas IPC calls. */
export function registerCanvasHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  compile: CanvasCssCompiler,
): void {
  registerIpcHandler(ipc, "compileCanvasCss", isTrustedSender, compile);
}
