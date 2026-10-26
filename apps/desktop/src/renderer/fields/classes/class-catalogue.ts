import type { ThemeTokens } from "@webforge/model";
import { useEffect, useState } from "react";
import type { CanvasApi } from "../../../shared/ipc/canvas.js";
import type { ClassCatalogue } from "./class-match.js";

/** How many themes' catalogues are kept: the site's, and the few before a change. */
const KEPT = 4;

/** The catalogues asked for, by theme, most recently asked last. */
const catalogues = new Map<string, Promise<ClassCatalogue | undefined>>();

/**
 * Every class a site with `theme` supports (#276), asked of the canvas CSS worker once per theme:
 * Tailwind's, daisyUI's and the theme's colours. Undefined when it can't be listed: the field then
 * suggests nothing, and anything can still be typed.
 */
function classCatalogue(
  canvas: () => CanvasApi,
  theme: ThemeTokens,
): Promise<ClassCatalogue | undefined> {
  const key = JSON.stringify(theme);
  const kept = catalogues.get(key);
  if (kept !== undefined) {
    catalogues.delete(key);
    catalogues.set(key, kept);
    return kept;
  }
  const asked = Promise.resolve()
    .then(() => canvas().classCatalogue(theme))
    .then((result) =>
      result.status === "loaded"
        ? { classes: result.classes, variants: result.variants }
        : undefined,
    )
    .catch(() => undefined)
    .then((catalogue) => {
      // Not kept when it failed (a cold start that timed out): the next field asks again.
      if (catalogue === undefined && catalogues.get(key) === asked) catalogues.delete(key);
      return catalogue;
    });
  catalogues.set(key, asked);
  for (const old of [...catalogues.keys()].slice(0, Math.max(0, catalogues.size - KEPT))) {
    catalogues.delete(old);
  }
  return asked;
}

/** The catalogue for `theme`, once it's come; undefined until then, or if it can't be listed. */
export function useClassCatalogue(
  canvas: () => CanvasApi,
  theme: ThemeTokens,
): ClassCatalogue | undefined {
  const [shown, setShown] = useState<ClassCatalogue>();
  useEffect(() => {
    let live = true;
    void classCatalogue(canvas, theme).then((catalogue) => {
      if (live && catalogue !== undefined) setShown(catalogue);
    });
    return () => {
      live = false;
    };
  }, [canvas, theme]);
  // Another theme's catalogue is still close: its classes are the same but the colours.
  return shown;
}
