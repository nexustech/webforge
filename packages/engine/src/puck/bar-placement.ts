import { COMPONENT } from "./puck-dom.js";

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
 * review's F5): off the element's own text where it can be, and inside the view. `null` for an
 * element wholly out of the view: its bar stays with it, where Puck puts it, rather than docking
 * over a section someone can see and acting on one they can't.
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
} | null {
  if (element.bottom <= 0 || element.top >= view.height) return null;
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

/** The part of `box` inside `clip`, or none. */
function clipped(box: Box, clip: Box): Box | undefined {
  const left = Math.max(box.left, clip.left);
  const top = Math.max(box.top, clip.top);
  const right = Math.min(box.right, clip.right);
  const bottom = Math.min(box.bottom, clip.bottom);
  return right > left && bottom > top ? { left, top, right, bottom } : undefined;
}

/**
 * The lines of text in `root` as the canvas shows them, leaving out what's in `skip` (the selected
 * element, inside its parent): one box per line of each text, cut to `root`'s box. None for blank
 * text, nor for text no one sees: hidden, see-through (a Carousel's other slides), or outside
 * `root`'s box.
 */
export function textLines(root: Element, skip?: Element): Box[] {
  const doc = root.ownerDocument;
  const clip = root.getBoundingClientRect();
  const lines: Box[] = [];
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const range = doc.createRange();
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if ((node.textContent ?? "").trim() === "" || skip?.contains(node) === true) continue;
    const parent = node.parentElement;
    const seen =
      parent === null ||
      typeof parent.checkVisibility !== "function" ||
      parent.checkVisibility({ visibilityProperty: true, opacityProperty: true });
    if (!seen) continue;
    range.selectNodeContents(node);
    for (const line of range.getClientRects()) {
      const part = clipped(line, clip);
      if (part !== undefined) lines.push(part);
    }
  }
  return lines;
}

/** `lines` moved by (`x`, `y`). */
function moved(lines: readonly Box[], x: number, y: number): Box[] {
  return lines.map((line) => ({
    left: line.left + x,
    top: line.top + y,
    right: line.right + x,
    bottom: line.bottom + y,
  }));
}

/** Space between the selected element's bar and the element, or the canvas's edge, on screen. */
const BAR_GAP = 4;

/**
 * Places the selected element's `bar` with {@link placeBar} and keeps it there: as the canvas
 * scrolls or changes size, as Puck measures the element again (its `overlay`'s style), as the
 * element's text changes (`wrapper`, Puck's wrapper around it) and as the bar changes size (the
 * format menu, while text is edited). Puck draws the bar above its element and keeps it in view by
 * sticking it inside the element, over its text; this moves it from there by a transform. Returns
 * what stops it, putting the bar back.
 *
 * Cheap on every scroll: it measures without first taking its move away, places once for whatever
 * happened in a task (in a microtask, not at the next frame, which a window behind others doesn't
 * get), and keeps the texts' lines, in the page's coordinates, until the page changes.
 */
export function followPlacement(
  bar: HTMLElement,
  overlay: Element,
  wrapper: Element | null,
): () => void {
  const doc = bar.ownerDocument;
  const view = doc.defaultView;
  bar.style.transform = "";
  if (view === null) return () => undefined;
  /** How far the bar is moved from where Puck puts it, in its own pixels. */
  let shift = { x: 0, y: 0 };
  /** The texts' lines in the page's coordinates, until the page changes. */
  let own: readonly Box[] | undefined;
  let parent: readonly Box[] | undefined;
  let pending = false;
  let stopped = false;

  /** `read`'s lines in the page's coordinates, from those in the view. */
  const inPage = (read: () => readonly Box[]) => moved(read(), view.scrollX, view.scrollY);
  const inView = (lines: readonly Box[]) => moved(lines, -view.scrollX, -view.scrollY);

  const place = () => {
    pending = false;
    if (stopped) return;
    const now = bar.getBoundingClientRect();
    if (now.height === 0 || bar.offsetHeight === 0) return;
    // The bar is scaled to stay the same size on screen: `scale` turns its pixels into the frame's.
    const scale = now.height / bar.offsetHeight;
    const natural = { left: now.left - shift.x * scale, top: now.top - shift.y * scale };
    const root = doc.documentElement;
    const target = placeBar({
      element: overlay.getBoundingClientRect(),
      bar: { width: now.width, height: now.height },
      // Inside the scrollbars.
      view: { width: root.clientWidth, height: root.clientHeight },
      gap: BAR_GAP * scale,
      ownText: () => {
        own ??= wrapper === null ? [] : inPage(() => textLines(wrapper));
        return inView(own);
      },
      parentText: () => {
        const around = wrapper?.parentElement?.closest(COMPONENT);
        parent ??=
          around === null || around === undefined || wrapper === null
            ? []
            : inPage(() => textLines(around, wrapper));
        return inView(parent);
      },
    });
    const next =
      target === null
        ? { x: 0, y: 0 }
        : { x: (target.left - natural.left) / scale, y: (target.top - natural.top) / scale };
    if (Math.abs(next.x - shift.x) <= 0.5 && Math.abs(next.y - shift.y) <= 0.5) return;
    const still = Math.abs(next.x) <= 0.5 && Math.abs(next.y) <= 0.5;
    shift = still ? { x: 0, y: 0 } : next;
    bar.style.transform = still ? "" : `translate(${next.x}px, ${next.y}px)`;
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(place);
  };
  /** The page changed: its texts' lines are read again when next needed. */
  const changed = () => {
    own = undefined;
    parent = undefined;
    schedule();
  };
  const ownChanged = () => {
    own = undefined;
    schedule();
  };

  schedule();
  view.addEventListener("scroll", schedule, { passive: true });
  view.addEventListener("resize", changed);
  const observers: { disconnect(): void }[] = [];
  // Puck moves and sizes the element's overlay through its style as the page changes.
  const restyled = new view.MutationObserver(changed);
  restyled.observe(overlay, { attributes: true, attributeFilter: ["style"] });
  observers.push(restyled);
  if (wrapper !== null) {
    const retyped = new view.MutationObserver(ownChanged);
    retyped.observe(wrapper, { characterData: true, childList: true, subtree: true });
    observers.push(retyped);
  }
  if (typeof view.ResizeObserver === "function") {
    // Its first call says only the size the bar has now.
    let first = true;
    const resized = new view.ResizeObserver(() => {
      if (first) first = false;
      else schedule();
    });
    resized.observe(bar);
    observers.push(resized);
  }
  return () => {
    stopped = true;
    view.removeEventListener("scroll", schedule);
    view.removeEventListener("resize", changed);
    for (const observer of observers) observer.disconnect();
    bar.style.transform = "";
  };
}
