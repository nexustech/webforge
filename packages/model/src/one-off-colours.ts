import { parseColorRef } from "./color-ref.js";
import { isResponsiveValue } from "./responsive.js";
import type { SiteDoc } from "./site-doc.js";
import { eachElement } from "./site-elements.js";

/** How many of the site's one-off colours the colour picker offers. */
const MOST = 12;

/** The one-off colour `value` holds, as `#rrggbb`, if it is a reference to one. */
function hexOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const ref = parseColorRef(value);
  return ref !== undefined && "hex" in ref.base ? ref.base.hex : undefined;
}

/**
 * The one-off colours (`[#rrggbb]`, ADR 0009) the site's elements already use, as `#rrggbb`, each
 * once, the most used first, at most 12 (TC-2, #1219). What the colour picker offers, so a colour
 * used before is used again without its code typed again. Read from the site itself: nothing is
 * stored for it. A value set per device counts on each device; elements in slots count too.
 */
export function oneOffColours(site: SiteDoc): readonly string[] {
  const uses = new Map<string, number>();
  const count = (value: unknown) => {
    const hex = hexOf(value);
    if (hex !== undefined) uses.set(hex, (uses.get(hex) ?? 0) + 1);
  };
  eachElement(site, (node) => {
    for (const value of Object.values(node.props)) {
      if (isResponsiveValue(value)) {
        for (const each of Object.values(value.$responsive)) count(each);
      } else {
        count(value);
      }
    }
  });
  // The most used first; a tie in the order they were first met.
  return [...uses.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, MOST)
    .map(([hex]) => hex);
}
