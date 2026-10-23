import { BODY_CLASS, buildSiteCss, type StyleResources } from "@webforge/pipeline";
import type { CompileCssJob, CompileCssOutcome } from "../shared/export-worker-protocol.js";
import { CANVAS_FONT_URL } from "../shared/ipc/canvas.js";

/**
 * Compiles the site CSS for the canvas exactly as an export would (the same pipeline step), with
 * the classes the exported `<body>` gets; fonts point at {@link CANVAS_FONT_URL}. Never throws.
 */
export async function compileCss(
  job: CompileCssJob,
  loadResources: () => StyleResources | Promise<StyleResources>,
): Promise<CompileCssOutcome> {
  try {
    const css = await buildSiteCss(await loadResources(), {
      theme: job.theme.preset,
      candidates: [...BODY_CLASS.split(" "), ...job.candidates],
      fontsUrl: CANVAS_FONT_URL,
    });
    return { type: "css", id: job.id, css, bodyClass: BODY_CLASS };
  } catch {
    return { type: "css-failed", id: job.id };
  }
}
