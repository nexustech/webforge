import type { ThemeTokens } from "@webforge/model";
import { type ClassCatalogue, loadClassCatalogue, type StyleResources } from "@webforge/pipeline";
import type {
  ClassCatalogueJob,
  ClassCssJob,
  ClassesOutcome,
} from "../shared/export-worker-protocol.js";

/** Catalogues kept, by theme: a theme edit makes a new one, and Undo may bring the last back. */
const KEEP = 3;

/**
 * Answers the class catalogue's jobs (#276) in the canvas styles worker: the list of classes, or
 * the CSS some of them produce. Each theme's catalogue is loaded once and kept for the next jobs.
 * Never throws: a failure is `classes-failed`, with no details.
 */
export function createClassCatalogues(
  loadResources: () => StyleResources | Promise<StyleResources>,
): (job: ClassCatalogueJob | ClassCssJob) => Promise<ClassesOutcome> {
  const byTheme = new Map<string, Promise<ClassCatalogue>>();
  const catalogueFor = (theme: ThemeTokens): Promise<ClassCatalogue> => {
    const key = JSON.stringify(theme);
    let catalogue = byTheme.get(key);
    if (catalogue === undefined) {
      catalogue = Promise.resolve(loadResources()).then((resources) =>
        loadClassCatalogue(resources, theme),
      );
      catalogue.catch(() => byTheme.delete(key));
    }
    // The most recently used last, so the oldest goes first.
    byTheme.delete(key);
    byTheme.set(key, catalogue);
    for (const old of [...byTheme.keys()].slice(0, Math.max(0, byTheme.size - KEEP))) {
      byTheme.delete(old);
    }
    return catalogue;
  };
  return async (job) => {
    try {
      const catalogue = await catalogueFor(job.theme);
      return job.type === "class-catalogue"
        ? {
            type: "class-catalogue",
            classes: [...catalogue.classes],
            variants: [...catalogue.variants],
          }
        : { type: "class-css", css: catalogue.cssFor(job.classes) };
    } catch {
      return { type: "classes-failed" };
    }
  };
}
