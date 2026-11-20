/**
 * The window width below which the side columns take turns (#1166). At 960 × 600 with both open,
 * the canvas had 385 px and showed the page at 33%: its body text about 5 px tall. With one open
 * and the other a strip, the page is at 58%: its frame is 590 px against Desktop's 1024 px minimum
 * (PH2-18). Reaching 60% would narrow the Edit panel below #1007's width or take the canvas's
 * padding (#1166's acceptance).
 */
export const NARROW_WINDOW_PX = 1100;

/**
 * Whether the left column starts as its strip: in a narrow window, until the person first changes
 * the panels themselves. Their layout is the person's, not a site's: once they change it (dragging,
 * or a column's button), it's saved and kept from then on, at any width, for every site.
 */
export function startsLeftCollapsed(windowWidth: number, hasSavedLayout: boolean): boolean {
  return !hasSavedLayout && windowWidth < NARROW_WINDOW_PX;
}

/** A side column of the window. */
export type Side = "left" | "right";

/**
 * The side column to fold to its strip once `opened` has opened, if any: in a narrow window, the
 * other one, while it's open, so a column opening never takes the page under half its size
 * without the person choosing it (#1166). Dragging a column wider is that choice, and is left as
 * it is.
 */
export function sideToClose(
  windowWidth: number,
  opened: Side,
  otherOpen: boolean,
): Side | undefined {
  if (windowWidth >= NARROW_WINDOW_PX || !otherOpen) return undefined;
  return opened === "left" ? "right" : "left";
}
