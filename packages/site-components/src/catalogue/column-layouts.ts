import { type Breakpoint, type Responsive, resolveResponsive } from "@webforge/model";
import { createContext } from "react";

/** The fewest and the most columns a Columns element has (2.17's toolbar adds and removes them). */
export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 4;

/**
 * How a Columns element shares its width, per device: equally, one column twice as wide as the
 * others (the first, the last or, with three, the middle one), or one under another.
 */
export const COLUMN_LAYOUTS = ["equal", "wideFirst", "wideLast", "wideMiddle", "stacked"] as const;
export type ColumnLayout = (typeof COLUMN_LAYOUTS)[number];

/**
 * The layouts that mean something with `count` columns, for 2.17's presets: ½·½, ⅔·⅓ and ⅓·⅔ with
 * two; ⅓·⅓·⅓, ½·¼·¼, ¼·½·¼ and ¼·¼·½ with three; equal with one or four. Stacked always applies.
 * Any other layout draws as equal.
 */
export function columnLayoutsFor(count: number): readonly ColumnLayout[] {
  if (count === 2) return ["equal", "wideFirst", "wideLast", "stacked"];
  if (count === 3) return ["equal", "wideFirst", "wideMiddle", "wideLast", "stacked"];
  return ["equal", "stacked"];
}

/**
 * Each layout's classes on the grid that holds the columns, written out in full. Columns sit side
 * by side in equal tracks; a wide column spans two. Each layout sets every span, so one set for a
 * device replaces another's: the first column is wide only with two or three columns, the last
 * likewise, the middle one only with three. Stacked puts them one under another.
 */
export const COLUMN_LAYOUT_CLASS: Readonly<Record<ColumnLayout, string>> = {
  equal:
    "grid-flow-col auto-cols-fr [&>*:first-child:nth-last-child(-n+3)]:col-span-1 [&>*:last-child:nth-child(-n+3)]:col-span-1 [&>*:nth-child(2):nth-last-child(2)]:col-span-1",
  wideFirst:
    "grid-flow-col auto-cols-fr [&>*:first-child:nth-last-child(-n+3)]:col-span-2 [&>*:last-child:nth-child(-n+3)]:col-span-1 [&>*:nth-child(2):nth-last-child(2)]:col-span-1",
  wideLast:
    "grid-flow-col auto-cols-fr [&>*:first-child:nth-last-child(-n+3)]:col-span-1 [&>*:last-child:nth-child(-n+3)]:col-span-2 [&>*:nth-child(2):nth-last-child(2)]:col-span-1",
  wideMiddle:
    "grid-flow-col auto-cols-fr [&>*:first-child:nth-last-child(-n+3)]:col-span-1 [&>*:last-child:nth-child(-n+3)]:col-span-1 [&>*:nth-child(2):nth-last-child(2)]:col-span-2",
  stacked:
    "grid-flow-row [&>*:first-child:nth-last-child(-n+3)]:col-span-1 [&>*:last-child:nth-child(-n+3)]:col-span-1 [&>*:nth-child(2):nth-last-child(2)]:col-span-1",
};

/**
 * The widest a column can be, as a share of its Columns, with a layout: a wide column takes ⅔ of
 * two, an equal one half. Columns don't know how many they hold on the canvas, so this assumes two
 * or more: an image in a column asks for a file this wide at most.
 */
const WIDEST_COLUMN: Readonly<Record<ColumnLayout, number>> = {
  equal: 1 / 2,
  wideFirst: 2 / 3,
  wideLast: 2 / 3,
  wideMiddle: 1 / 2,
  stacked: 1,
};

/** The layout of the Columns an element is in, per device; null outside Columns. */
export const ColumnsLayoutContext = createContext<Responsive<ColumnLayout> | null>(null);

/** How wide a section's column is at most (`max-w-4xl`), in pixels. */
const SECTION_COLUMN_PX = 896;

/**
 * How an image is cut to fill its frame on a device (3.19): to a shape, its width ÷ its height;
 * to a set height, in pixels; or, as its own shape, not at all.
 */
export type ImageFrame = { readonly ratio: number } | { readonly height: number } | null;

/**
 * The `sizes` of an image at most `maxPx` wide (none: as wide as it can be), in Columns laid out
 * as `layout` or in none: the widest it can show on Desktop (from 1024 px), on Tablet (from 768 px)
 * and on Mobile, so the browser fetches no larger a file than it shows (X2).
 *
 * Cut to a `frame`, a picture wider in proportion than the frame (`ratio`, its width ÷ its height)
 * shows wider than the frame, to cover its height, so it asks for that width: a 16:9 picture in a
 * 448 px wide 3:4 frame, 597 px high, shows 1061 px wide. Under a set height it shows at least as
 * wide as that height × its proportions.
 */
export function imageSizes(
  maxPx: (breakpoint: Breakpoint) => number | undefined,
  layout: Responsive<ColumnLayout> | null,
  frame: (breakpoint: Breakpoint) => ImageFrame = () => null,
  ratio = 1,
): string {
  const share = (breakpoint: Breakpoint) =>
    layout === null ? 1 : WIDEST_COLUMN[resolveResponsive(layout, breakpoint)];
  /** How much wider than its frame the picture shows, cut to a shape. */
  const scale = (cut: ImageFrame) =>
    cut !== null && "ratio" in cut ? Math.max(1, ratio / cut.ratio) : 1;
  /** `across` that much wider, rounded up once it is, so the file is never narrower than shown. */
  const widen = (across: number, wider: number) =>
    wider === 1 ? Math.round(across) : Math.ceil(across * wider);
  /** How wide a set height shows the picture at least. */
  const coverPx = (cut: { readonly height: number }) => Math.ceil(cut.height * ratio);
  const shown = (breakpoint: Breakpoint) => {
    const cap = maxPx(breakpoint);
    const cut = frame(breakpoint);
    const wider = scale(cut);
    const fluid = `${widen(share(breakpoint) * 100, wider)}vw`;
    const across = cap === undefined ? fluid : `min(${widen(cap, wider)}px, ${fluid})`;
    return cut !== null && "height" in cut ? `max(${across}, ${coverPx(cut)}px)` : across;
  };
  const desktopCap = Math.round(SECTION_COLUMN_PX * share("desktop"));
  const desktopMax = maxPx("desktop");
  const desktopCut = frame("desktop");
  const desktopFrame = desktopMax === undefined ? desktopCap : Math.min(desktopMax, desktopCap);
  const desktopWide = widen(desktopFrame, scale(desktopCut));
  const desktop =
    desktopCut !== null && "height" in desktopCut
      ? Math.max(desktopWide, coverPx(desktopCut))
      : desktopWide;
  return `(min-width: 1024px) ${desktop}px, (min-width: 768px) ${shown("tablet")}, ${shown("mobile")}`;
}
