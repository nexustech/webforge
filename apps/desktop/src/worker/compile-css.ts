import { CANVAS_EVEN_SECTIONS } from "@webforge/engine/puck-dom";
import {
  BODY_CLASS,
  createStyleCompiler,
  type StyleCompiler,
  type StyleResources,
} from "@webforge/pipeline";
import { FONT_CATALOGUE } from "@webforge/themes";
import type { CompileCssJob, CompileCssOutcome } from "../shared/export-worker-protocol.js";
import { CANVAS_FONT_URL } from "../shared/ipc/canvas.js";

/**
 * The canvas styles worker's `compile-css` jobs: each compiles the site CSS for the canvas exactly
 * as an export would (the same pipeline step), with the classes the exported `<body>` gets; fonts
 * point at {@link CANVAS_FONT_URL}, the downloaded ones the job names included. A theme's
 * alternating sections stripe the canvas's sections too, which are in Puck's wrappers (A19).
 *
 * The Tailwind compiler is kept between jobs (`createStyleCompiler`, #945): preparing one costs
 * about as much as a whole compile, and the canvas asks for its shown page's classes, then for the
 * whole site's (#895), then again after each edit, mostly for more classes with the same theme.
 * A job never throws.
 */
export function createCompileCss(
  loadResources: () => StyleResources | Promise<StyleResources>,
): (job: CompileCssJob) => Promise<CompileCssOutcome> {
  // Kept from the first job on, so jobs arriving together share it; not kept if it fails to load.
  let styles: Promise<StyleCompiler> | undefined;
  const compiler = () => {
    if (styles !== undefined) return styles;
    const loading = Promise.resolve().then(loadResources).then(createStyleCompiler);
    styles = loading;
    loading.catch(() => {
      if (styles === loading) styles = undefined;
    });
    return loading;
  };
  return async (job) => {
    try {
      const css = await (await compiler()).css({
        theme: job.theme,
        candidates: [...BODY_CLASS.split(" "), ...job.candidates],
        fontsUrl: CANVAS_FONT_URL,
        fonts: [...FONT_CATALOGUE, ...job.families],
        evenSections: [CANVAS_EVEN_SECTIONS],
        keptVariables: job.variables ?? [],
      });
      return { type: "css", css, bodyClass: BODY_CLASS };
    } catch {
      return { type: "css-failed" };
    }
  };
}
