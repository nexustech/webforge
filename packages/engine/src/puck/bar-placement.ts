/** A box in the canvas's view, as `getBoundingClientRect` gives it. */
export type Box = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

/** What {@link placeBar} places the selected element's bar by, all in the canvas's own pixels. */
export type BarPlacement = {
  /** The selected element's box. */
  readonly element: Box;
  /** The bar's size. */
  readonly bar: { readonly width: number; readonly height: number };
  /** The canvas's view. */
  readonly view: { readonly width: number; readonly height: number };
  /** The space kept between the bar and the element, or the view's edge. */
  readonly gap: number;
  /** The element's own text, line by line: read only when a place could cover it. */
  readonly ownText: () => readonly Box[];
  /** Its parent's other text, line by line: read only when a place could cover it. */
  readonly parentText: () => readonly Box[];
};

/** How much of `boxes` the box `bar` covers: the area of their overlaps. */
function covered(bar: Box, boxes: readonly Box[]): number {
  let area = 0;
  for (const box of boxes) {
    const width = Math.min(bar.right, box.right) - Math.max(bar.left, box.left);
    const height = Math.min(bar.bottom, box.bottom) - Math.max(bar.top, box.top);
    if (width > 0 && height > 0) area += width * height;
  }
  return area;
}

/**
 * Where the selected element's bar goes, its top-left corner in the view (#1177, the UX/UI
 * review's F5): never over the element's own text, and inside the view.
 *
 * - **Above the element** when there's room, as it has always been, **otherwise below it**. Both
 *   start at the element's left edge.
 * - **Otherwise docked** to the view's top edge, then its bottom edge, at the element's left, then
 *   at its right: an element taller than the view, or one scrolled half out of it.
 * - The first of those that covers neither the element's text nor its parent's wins. Then the first
 *   that leaves the element's text clear, though it covers its parent's (a Button's bar over the
 *   Heading beside it, when nothing else fits). Then the one over the least of the element's text:
 *   a text taller than the view leaves nowhere else.
 */
export function placeBar({ element, bar, view, gap, ownText, parentText }: BarPlacement): {
  readonly left: number;
  readonly top: number;
} {
  const clampX = (x: number) => Math.max(0, Math.min(x, view.width - bar.width));
  const atLeft = clampX(element.left);
  const atRight = clampX(element.right - bar.width);
  const above = element.top - gap - bar.height;
  const below = element.bottom + gap;
  const topEdge = Math.min(gap, Math.max(0, view.height - bar.height));
  const bottomEdge = Math.max(0, view.height - gap - bar.height);
  const places = [
    { left: atLeft, top: above },
    { left: atLeft, top: below },
    { left: atLeft, top: topEdge },
    { left: atRight, top: topEdge },
    { left: atLeft, top: bottomEdge },
    { left: atRight, top: bottomEdge },
  ].filter((place) => place.top >= 0 && place.top + bar.height <= view.height);
  const fallback = { left: atLeft, top: topEdge };
  if (places.length === 0) return fallback;

  const boxOf = (place: { left: number; top: number }): Box => ({
    left: place.left,
    top: place.top,
    right: place.left + bar.width,
    bottom: place.top + bar.height,
  });
  // Each text is read once, and only when a place needs it.
  let own: readonly Box[] | undefined;
  let parent: readonly Box[] | undefined;
  const overOwn = (box: Box) => {
    own ??= ownText();
    return covered(box, own);
  };
  const overParent = (box: Box) => {
    parent ??= parentText();
    return covered(box, parent);
  };

  let best = fallback;
  let bestOwn = Number.POSITIVE_INFINITY;
  let clearOfOwn: { left: number; top: number } | undefined;
  for (const place of places) {
    const box = boxOf(place);
    // Above or below the element, the bar can't be over its text.
    const ownArea = covered(box, [element]) > 0 ? overOwn(box) : 0;
    if (ownArea > 0) {
      if (ownArea < bestOwn) {
        best = place;
        bestOwn = ownArea;
      }
      continue;
    }
    if (overParent(box) === 0) return place;
    clearOfOwn ??= place;
  }
  return clearOfOwn ?? best;
}

/**
 * The lines of text in `root` as the canvas shows them, leaving out what's in `skip` (the selected
 * element, inside its parent): one box per line of each text, none for blank ones.
 */
export function textLines(root: Element, skip?: Element): Box[] {
  const doc = root.ownerDocument;
  const lines: Box[] = [];
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const range = doc.createRange();
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if ((node.textContent ?? "").trim() === "" || skip?.contains(node) === true) continue;
    range.selectNodeContents(node);
    for (const line of range.getClientRects()) {
      if (line.width > 0 && line.height > 0) lines.push(line);
    }
  }
  return lines;
}
