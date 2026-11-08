import {
  type ElementPlace,
  isNodeDoc,
  type NodeDoc,
  type Oklch,
  type Responsive,
  resolveResponsive,
  type SiteDoc,
  type TextStyle,
  type ThemeTokens,
  valuesWithLook,
} from "@webforge/model";
import { inverseColors, resolveColorRef } from "./colors.js";
import { AA_LARGE, AA_TEXT } from "./contrast.js";

/** Tailwind's text sizes in CSS pixels, as the type scale names them. */
export const TEXT_PX: Readonly<Record<ThemeTokens["typeScale"][TextStyle]["size"], number>> = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "5xl": 48,
  "6xl": 60,
};

/**
 * The least contrast WCAG AA asks of text in `styles` (F-DS-2): 3:1 for large text (at least 24 px,
 * or 18.66 px when bold), 4.5:1 for any other. Text set in several styles (a size per device)
 * needs what its smallest needs; text whose style isn't known, 4.5:1. The Edit panel's colour
 * field and Site Check ask the same (#670).
 */
export function contrastNeeded(theme: ThemeTokens, styles: readonly TextStyle[]): number {
  if (styles.length === 0) return AA_TEXT;
  return Math.max(
    ...styles.map((style) => {
      const { size, weight } = theme.typeScale[style];
      const px = TEXT_PX[size];
      return px >= 24 || (px >= 18.66 && weight >= 700) ? AA_LARGE : AA_TEXT;
    }),
  );
}

/**
 * What text is drawn on (#670): the palette its colours come from, the page's or a Reversed
 * section's (2.4), and the background colour behind it.
 */
export type Surface = {
  readonly palette: "colors" | "inverse";
  readonly background: Oklch;
};

/** `value`, set once or per device, as the desktop has it: the device most visitors' pages use. */
const onDesktop = (value: unknown) => resolveResponsive(value as Responsive<unknown>, "desktop");

/**
 * The surface under an element whose `chain` of values runs from its section to itself, each with
 * its kind's look (#670): a Reversed section (`colors: "inverse"`) switches to the inverse palette,
 * and the nearest Appearance background (`lookBackground`) is what's behind, else the palette's
 * page colour. A background's own opacity is left out: it's taken as drawn in full.
 */
export function surfaceOf(
  theme: ThemeTokens,
  chain: readonly Readonly<Record<string, unknown>>[],
): Surface {
  let palette: Surface["palette"] = "colors";
  let background: Oklch | undefined;
  for (const values of chain) {
    if (onDesktop(values.colors) === "inverse") {
      palette = "inverse";
      background = undefined;
    }
    const fill = onDesktop(values.lookBackground);
    if (typeof fill === "string") {
      const resolved = resolveColorRef(theme, fill, palette);
      if (resolved !== undefined) background = resolved.color;
    }
  }
  const colors = palette === "inverse" ? inverseColors(theme) : theme.colors;
  return { palette, background: background ?? colors["base-100"] };
}

/** The nodes kept at `on`: a page's content, the Header, the Footer, or a shared section. */
function nodesAt(site: SiteDoc, on: ElementPlace): readonly NodeDoc[] {
  if (on === "header") return site.layout.header;
  if (on === "footer") return site.layout.footer;
  const page = Object.hasOwn(site.pages, on) ? site.pages[on as keyof SiteDoc["pages"]] : undefined;
  if (page !== undefined) return page.doc.content;
  const shared = Object.hasOwn(site.sharedSections, on)
    ? site.sharedSections[on as keyof SiteDoc["sharedSections"]]
    : undefined;
  return shared === undefined ? [] : [shared.section];
}

/** The elements from the top of `nodes` down to element `nodeId`, or none if it isn't there. */
function chainTo(nodes: readonly NodeDoc[], nodeId: string): readonly NodeDoc[] {
  for (const node of nodes) {
    if (node.props.id === nodeId) return [node];
    for (const value of Object.values(node.props)) {
      if (!Array.isArray(value)) continue;
      const below = chainTo(value.filter(isNodeDoc), nodeId);
      if (below.length > 0) return [node, ...below];
    }
  }
  return [];
}

/**
 * The surface under element `nodeId` kept at `on` (#670), each element on the way with its kind's
 * look: the page's colours when it isn't found.
 */
export function surfaceAt(site: SiteDoc, on: ElementPlace, nodeId: string): Surface {
  const { looks } = site.theme;
  return surfaceOf(
    site.theme,
    chainTo(nodesAt(site, on), nodeId).map((node) =>
      valuesWithLook(node.props, looks?.[node.type]),
    ),
  );
}
