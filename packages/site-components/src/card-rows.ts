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
 *
 * Heights (#1511): the browser stretches each direct child to its row's height, so cards in a row
 * are the same height. On the canvas Puck's wrapper is the one stretched, and the canvas's own
 * styles make the card fill it (the engine's `WRAPPING_ROW_ELEMENT`). Not `h-full` on the card: on
 * the site that stops Chromium stretching it. `items-start` on a row draws each card at its own
 * height (Features' *Fit the text*).
 */
export const CARD_ROWS = {
  /** Three across from `md`, a `gap-6`. */
  threeGap6:
    "flex flex-wrap justify-center gap-6 *:w-full md:*:w-[calc((100%-var(--spacing)*12)/3)]",
  /**
   * Three across from `md`, a `gap-6`, every card as tall as the tallest on any row (#1511): from
   * `md` a grid of six columns, each card spanning two, its rows `1fr`, so all of them take the
   * tallest row's height. A last row that isn't full is centred as the flex rows centre it, by
   * counting the cards: one alone starts at the third column, the first of two at the second.
   * Below `md`, one card across, each as tall as its own text. It keeps `flex-wrap`, which the
   * canvas reads to take drops on either side of a card.
   */
  threeGap6EveryRow:
    "flex flex-wrap justify-center gap-6 *:w-full md:grid md:auto-rows-fr md:grid-cols-6 md:*:col-span-2 md:[&>:last-child:nth-child(3n+1)]:col-start-3 md:[&>:nth-last-child(2):nth-child(3n+1)]:col-start-2",
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
