import { CANVAS_EVEN_SECTIONS } from "@webforge/engine/puck-dom";
import { BODY_CLASS, buildSiteCss, type StyleResources } from "@webforge/pipeline";
import { FONT_CATALOGUE } from "@webforge/themes";
import type { CompileCssJob, CompileCssOutcome } from "../shared/export-worker-protocol.js";
import { CANVAS_FONT_URL } from "../shared/ipc/canvas.js";

/**
 * Compiles the site CSS for the canvas exactly as an export would (the same pipeline step), with
 * the classes the exported `<body>` gets; fonts point at {@link CANVAS_FONT_URL}, the downloaded ones
 * the job names included. A theme's alternating sections stripe the canvas's sections too, which
 * are in Puck's wrappers (A19). Never throws.
 */
export async function compileCss(
  job: CompileCssJob,
  loadResources: () => StyleResources | Promise<StyleResources>,
): Promise<CompileCssOutcome> {
  try {
    const css = await buildSiteCss(await loadResources(), {
      theme: job.theme,
      candidates: [...BODY_CLASS.split(" "), ...job.candidates],
      fontsUrl: CANVAS_FONT_URL,
      fonts: [...FONT_CATALOGUE, ...job.families],
      evenSections: [CANVAS_EVEN_SECTIONS],
    });
    return { type: "css", css, bodyClass: BODY_CLASS };
  } catch {
    return { type: "css-failed" };
  }
}
