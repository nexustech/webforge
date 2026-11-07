/** A box on screen, in CSS pixels from the window's top left. */
export type ScreenBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** Where a card goes: its top left, and which side of what it points at (or the centre). */
export type CardPlace = {
  readonly left: number;
  readonly top: number;
  readonly side: "below" | "above" | "right" | "left" | "centre";
};

/** Between the card and what it points at. */
const GAP = 8;
/** Kept clear at the window's edges. */
const MARGIN = 12;

/**
 * Where a card of size `card` goes beside `anchor` in a window of size `view` (OB-3): below it,
 * else above, right or left, whichever fits first, lined up with its middle and kept inside the
 * window. Centred in the window when there's nothing to point at, it's out of sight, or no side
 * has room.
 */
export function placeCard(
  anchor: ScreenBox | null,
  card: { readonly width: number; readonly height: number },
  view: { readonly width: number; readonly height: number },
): CardPlace {
  const centre: CardPlace = {
    side: "centre",
    left: Math.max(MARGIN, (view.width - card.width) / 2),
    top: Math.max(MARGIN, (view.height - card.height) / 2),
  };
  if (anchor === null || anchor.width <= 0 || anchor.height <= 0) return centre;
  const right = anchor.left + anchor.width;
  const bottom = anchor.top + anchor.height;
  if (right <= 0 || bottom <= 0 || anchor.left >= view.width || anchor.top >= view.height) {
    return centre;
  }
  const within = (value: number, size: number, room: number) =>
    Math.max(MARGIN, Math.min(value, room - size - MARGIN));
  const across = within(anchor.left + anchor.width / 2 - card.width / 2, card.width, view.width);
  const down = within(anchor.top + anchor.height / 2 - card.height / 2, card.height, view.height);
  const sides: readonly (CardPlace & { readonly fits: boolean })[] = [
    {
      side: "below",
      left: across,
      top: bottom + GAP,
      fits: bottom + GAP + card.height <= view.height - MARGIN,
    },
    {
      side: "above",
      left: across,
      top: anchor.top - GAP - card.height,
      fits: anchor.top - GAP - card.height >= MARGIN,
    },
    {
      side: "right",
      left: right + GAP,
      top: down,
      fits: right + GAP + card.width <= view.width - MARGIN,
    },
    {
      side: "left",
      left: anchor.left - GAP - card.width,
      top: down,
      fits: anchor.left - GAP - card.width >= MARGIN,
    },
  ];
  const fitting = sides.find((each) => each.fits);
  return fitting === undefined
    ? centre
    : { side: fitting.side, left: fitting.left, top: fitting.top };
}
