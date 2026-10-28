import type { Theme, ThemeTokens } from "@webforge/model";
import type { CatalogueFont } from "@webforge/themes";
import type { IpcMain } from "electron";
import {
  type ClassCatalogueJob,
  type ClassCssJob,
  type ClassesOutcome,
  type CompileCssJob,
  type CompileCssOutcome,
  canvasStylesOutcomeSchema,
  type ItemHtmlJob,
  type ItemHtmlOutcome,
  type ItemHtmlRequest,
} from "../shared/export-worker-protocol.js";
import type {
  CanvasCssRequest,
  CanvasCssResult,
  ClassCatalogueResult,
  ClassCssResult,
  ItemHtmlResult,
} from "../shared/ipc/canvas.js";
import { registerIpcHandler } from "./ipc.js";
import type { WorkerProcess } from "./worker-process.js";
import { createWorkerRequests } from "./worker-requests.js";

/** What the canvas styles worker answers; see {@link createCanvasStyles}. */
export type CanvasStyles = {
  /** The site CSS the canvas shows the page with (1.12). */
  readonly compileCss: (request: CanvasCssRequest) => Promise<CanvasCssResult>;
  /** Every class a site with `theme` supports, for the CSS classes field (#276). */
  readonly classCatalogue: (theme: Theme) => Promise<ClassCatalogueResult>;
  /** The CSS each of `classes` produces with `theme`. */
  readonly classCss: (theme: Theme, classes: readonly string[]) => Promise<ClassCssResult>;
  /** An item of a page as the export writes it, for the CSS tab (3.14). */
  readonly itemHtml: (request: ItemHtmlRequest) => Promise<ItemHtmlResult>;
};

/** How long one job may take before it counts as failed (a cold start loads the pipeline). */
const COMPILE_TIMEOUT_MS = 60_000;

/**
 * The canvas's styles, from one long-lived utility process (see {@link createWorkerRequests}), so
 * a recompile costs no process start: the site CSS (1.12) and the class catalogue (#276), which
 * loads Tailwind the same way. `families` gives the downloaded fonts a theme uses (2.2), which the
 * renderer never names itself. Anything unexpected, a timeout or an exit fails the request instead
 * of trusting it.
 */
export function createCanvasStyles(
  startWorker: () => WorkerProcess,
  timeoutMs = COMPILE_TIMEOUT_MS,
  families?: (theme: ThemeTokens) => Promise<CatalogueFont[]>,
): CanvasStyles {
  const request = createWorkerRequests<
    CompileCssOutcome | ClassesOutcome | ItemHtmlOutcome,
    CompileCssJob | ClassCatalogueJob | ClassCssJob | ItemHtmlJob
  >(startWorker, canvasStylesOutcomeSchema, timeoutMs);
  return {
    compileCss: async (css) => {
      const outcome = await request({
        type: "compile-css",
        ...css,
        families: families === undefined ? [] : await families(css.theme),
      });
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
    itemHtml: async (item) => {
      const outcome = await request({ type: "item-html", ...item });
      return outcome?.type === "item-html"
        ? { status: "html", html: outcome.html }
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
  registerIpcHandler(ipc, "itemHtml", isTrustedSender, styles.itemHtml);
}
