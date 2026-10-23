import type { Theme } from "@webforge/model";
import type { IpcMain } from "electron";
import { canvasStylesOutcomeSchema } from "../shared/export-worker-protocol.js";
import type {
  CanvasCssRequest,
  CanvasCssResult,
  ClassCatalogueResult,
  ClassCssResult,
} from "../shared/ipc/canvas.js";
import { registerIpcHandler } from "./ipc.js";
import { createWorkerRequests, type WorkerProcess } from "./worker-requests.js";

/** The parts of an Electron `UtilityProcess` the canvas styles use; injectable for tests. */
export type CssWorkerProcess = WorkerProcess;

/** What the canvas styles worker answers; see {@link createCanvasStyles}. */
export type CanvasStyles = {
  /** The site CSS the canvas shows the page with (1.12). */
  readonly compileCss: (request: CanvasCssRequest) => Promise<CanvasCssResult>;
  /** Every class a site with `theme` supports, for the CSS classes field (#276). */
  readonly classCatalogue: (theme: Theme) => Promise<ClassCatalogueResult>;
  /** The CSS each of `classes` produces with `theme`. */
  readonly classCss: (theme: Theme, classes: readonly string[]) => Promise<ClassCssResult>;
};

/** How long one job may take before it counts as failed (a cold start loads the pipeline). */
const COMPILE_TIMEOUT_MS = 60_000;

/**
 * The canvas's styles, from one long-lived utility process (see {@link createWorkerRequests}), so
 * a recompile costs no process start: the site CSS (1.12) and the class catalogue (#276), which
 * loads Tailwind the same way. Anything unexpected, a timeout or an exit fails the request instead
 * of trusting it.
 */
export function createCanvasStyles(
  startWorker: () => CssWorkerProcess,
  timeoutMs = COMPILE_TIMEOUT_MS,
): CanvasStyles {
  const request = createWorkerRequests(startWorker, canvasStylesOutcomeSchema, timeoutMs);
  return {
    compileCss: async (css) => {
      const outcome = await request({ type: "compile-css", ...css });
      return outcome?.type === "css"
        ? { status: "compiled", css: outcome.css, bodyClass: outcome.bodyClass }
        : { status: "failed" };
    },
    classCatalogue: async (theme) => {
      const outcome = await request({ type: "class-catalogue", theme });
      return outcome?.type === "class-catalogue"
        ? { status: "loaded", classes: outcome.classes, variants: outcome.variants }
        : { status: "failed" };
    },
    classCss: async (theme, classes) => {
      const outcome = await request({ type: "class-css", theme, classes: [...classes] });
      return outcome?.type === "class-css" && outcome.css.length === classes.length
        ? { status: "css", css: outcome.css }
        : { status: "failed" };
    },
  };
}

/** Registers the canvas IPC calls. */
export function registerCanvasHandlers(
  ipc: Pick<IpcMain, "handle">,
  isTrustedSender: (senderUrl: string) => boolean,
  styles: CanvasStyles,
): void {
  registerIpcHandler(ipc, "compileCanvasCss", isTrustedSender, styles.compileCss);
  registerIpcHandler(ipc, "classCatalogue", isTrustedSender, styles.classCatalogue);
  registerIpcHandler(ipc, "classCss", isTrustedSender, styles.classCss);
}
