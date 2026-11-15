import { type RefObject, useLayoutEffect, useRef, useState } from "react";

/** A toolbar's width and the width its content takes, in CSS pixels. */
export type ToolbarMeasure = { readonly width: number; readonly content: number };

/**
 * How compact a toolbar is drawn next (#1008): 0 shows everything, and each level up moves one
 * more group of its controls into a menu, up to `most`. A toolbar whose content is wider than it
 * goes up a level, noting in `needed` how wide the level it left needed; one with room again for
 * the level below goes back down. The content is measured as drawn, so another language's longer
 * words, or a longer size read-out, are fitted too.
 */
export function nextFitLevel(
  level: number,
  { width, content }: ToolbarMeasure,
  needed: number[],
  most: number,
): number {
  // A pixel's leeway: widths are fractional at some interface zooms.
  if (content > width + 1) {
    if (level >= most) return level;
    needed[level] = content;
    return level + 1;
  }
  const below = level > 0 ? needed[level - 1] : undefined;
  return below !== undefined && width >= below ? level - 1 : level;
}

/**
 * The level {@link nextFitLevel} gives the toolbar `ref` points at, measured after every render
 * and whenever the toolbar is resized. The toolbar hides its overflow, so its scroll width is
 * what its content takes.
 */
export function useFitLevel(ref: RefObject<HTMLElement | null>, most: number): number {
  const [level, setLevel] = useState(0);
  const state = useRef({ level: 0, needed: [] as number[] });
  const fit = useRef<() => void>(() => undefined);
  // After every render, before paint: a level that doesn't fit is never seen, and a read-out
  // grown longer is fitted as it changes.
  useLayoutEffect(() => {
    fit.current = () => {
      const element = ref.current;
      if (element === null) return;
      const next = nextFitLevel(
        state.current.level,
        { width: element.clientWidth, content: element.scrollWidth },
        state.current.needed,
        most,
      );
      if (next !== state.current.level) {
        state.current.level = next;
        setLevel(next);
      }
    };
    fit.current();
  });
  // And whenever the toolbar is resized: a window or a side column resized.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const observer = new ResizeObserver(() => fit.current());
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return level;
}
