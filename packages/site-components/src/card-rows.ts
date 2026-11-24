/**
 * Rows of cards, laid out as a grid lays them but with a last row that isn't full centred
 * (#1372): wrapping flex rows, each card the width of one column, so one or two Pricing plans
 * sit centred at a third of the width each, and a fourth feature under three is centred under
 * them. The width is on each direct child, which on the canvas is Puck's wrapper around the card.
 *
 * Each is a literal string, so Tailwind finds its classes in the source. A width is a column's
 * share of the row once the gaps between the columns are taken out, in the theme's spacing unit
 * as the gap is (`gap-6` is `var(--spacing) * 6`): a theme's Spacing changes that unit, and a
 * width in rem would leave too little room for the last column, so three would wrap to two.
 */
export const CARD_ROWS = {
  /** Three across from `md`, a `gap-6`. */
  threeGap6:
    "flex flex-wrap justify-center gap-6 *:w-full md:*:w-[calc((100%-var(--spacing)*12)/3)]",
  /** Three across from `md`, a `gap-10`. */
  threeGap10:
    "flex flex-wrap justify-center gap-10 *:w-full md:*:w-[calc((100%-var(--spacing)*20)/3)]",
  /** Two across from `md`, a `gap-8`. */
  twoGap8: "flex flex-wrap justify-center gap-8 *:w-full md:*:w-[calc((100%-var(--spacing)*8)/2)]",
  /** Two across from `md`, a `gap-10`. */
  twoGap10:
    "flex flex-wrap justify-center gap-10 *:w-full md:*:w-[calc((100%-var(--spacing)*10)/2)]",
  /** Two across from `sm`, three from `md`, a `gap-6`. */
  twoThreeGap6:
    "flex flex-wrap justify-center gap-6 *:w-full sm:*:w-[calc((100%-var(--spacing)*6)/2)] md:*:w-[calc((100%-var(--spacing)*12)/3)]",
  /** Two across from `sm`, three from `md`, a `gap-8`. */
  twoThreeGap8:
    "flex flex-wrap justify-center gap-8 *:w-full sm:*:w-[calc((100%-var(--spacing)*8)/2)] md:*:w-[calc((100%-var(--spacing)*16)/3)]",
  /** Two across from `sm`, four from `md`, a `gap-10`. */
  twoFourGap10:
    "flex flex-wrap justify-center gap-10 *:w-full sm:*:w-[calc((100%-var(--spacing)*10)/2)] md:*:w-[calc((100%-var(--spacing)*30)/4)]",
  /** Two across from `sm`, three from `lg`, a `gap-8`. */
  twoThreeLgGap8:
    "flex flex-wrap justify-center gap-8 *:w-full sm:*:w-[calc((100%-var(--spacing)*8)/2)] lg:*:w-[calc((100%-var(--spacing)*16)/3)]",
} as const;
